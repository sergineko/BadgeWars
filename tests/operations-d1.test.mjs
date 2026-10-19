import test from 'node:test';
import assert from 'node:assert/strict';
import {createD1,seedUser} from './helpers/d1.mjs';
import {recordIncident,reviewIncident,operationalStatus,operationSignals,notifyOperations,runtime,serviceHealth} from '../src/operations.mjs';
import {quotaSignals,monitorQuota,collectQuota} from '../src/quota.mjs';
import worker from '../src/worker.mjs';
import {createHmac} from 'node:crypto';
import {env as dodoEnv,business,paymentId} from './helpers/dodo.mjs';

test('incident reviews preserve an immutable trail, reject races and never release a frozen wallet',async()=>{
 const db=createD1();try{
  const user=await seedUser(db,{credits:5});db.sqlite.prepare('UPDATE bw_wallets SET frozen=1,debt=2 WHERE user_id=?').run(user);
  await recordIncident(db,'payment_mismatch','test-payment');let row=db.sqlite.prepare('SELECT * FROM bw_operations').get();
  await reviewIncident(db,row.id,'acknowledged','SergioTech','Investigating the provider reference',1);
  await recordIncident(db,'payment_mismatch','test-payment');
  await assert.rejects(reviewIncident(db,row.id,'resolved','SergioTech','Provider checked and evidence retained',1),/operation_changed/);
  await reviewIncident(db,row.id,'resolved','SergioTech','Provider checked and evidence retained',2);
  await recordIncident(db,'payment_mismatch','test-payment');row=db.sqlite.prepare('SELECT * FROM bw_operations').get();assert.equal(row.state,'open');assert.equal(row.occurrences,3);
  assert.equal(db.sqlite.prepare('SELECT count(*) n FROM bw_operation_events').get().n,3);
  assert.throws(()=>db.sqlite.exec("DELETE FROM bw_operation_events"),/immutable_operation_event/);
  assert.equal(db.sqlite.prepare('SELECT frozen FROM bw_wallets').get().frozen,1);assert.equal(db.sqlite.prepare('SELECT debt FROM bw_wallets').get().debt,2);
 }finally{db.close();}
});

test('operational alerts use counts only, serialize concurrent sends, retry failures and notify recovery once',async()=>{
 const db=createD1(),sent=[],env={OPS_EMAIL_TO:'verified@example.com',OPS_EMAIL_FROM:'support@badges.example',OPS_EMAIL:{async send(message){sent.push(message);}}},now=Date.now();try{
  assert.equal(await notifyOperations(db,env,'cases',[],now),false);
  const signals=[{code:'refunds',level:'critical',value:2}];
  await Promise.all([notifyOperations(db,env,'cases',signals,now),notifyOperations(db,env,'cases',signals,now)]);assert.equal(sent.length,1);
  assert.equal(await notifyOperations(db,env,'cases',signals,now+3600000),false);
  assert.equal(await notifyOperations(db,env,'cases',[],now+660000),true);assert.equal(await notifyOperations(db,env,'cases',[],now+1260000),false);
  assert.ok(!JSON.stringify(sent).includes('payment_id'));assert.ok(sent[0].text.includes('refunds = 2'));
  const broken={...env,OPS_EMAIL:{async send(){throw Error('transport');}}};await notifyOperations(db,broken,'failed',signals,now);assert.equal(db.sqlite.prepare("SELECT last_sent FROM bw_alerts WHERE key='failed'").get().last_sent,0);
  assert.equal(await notifyOperations(db,env,'failed',signals,now),true);
 }finally{db.close();}
});

test('health fails closed on stale cron, pending projections, maintenance and database failure without exposing accounts',async()=>{
 const db=createD1(),now=Date.now(),env={DB:db,BADGES:{async get(){return 'projection';}}};try{
  assert.equal((await serviceHealth(env,now)).status,503);
  db.sqlite.exec('UPDATE bw_badges SET dirty=0');await runtime(db,'scheduler',{finishedAt:now,failed:[]},now);await runtime(db,'publisher',{finishedAt:now,failed:[]},now);
  assert.equal((await serviceHealth(env,now)).status,200);
  assert.equal((await serviceHealth({...env,BADGES:{async get(){return null;}}},now)).status,503);
  assert.equal((await serviceHealth(env,now+1200001)).status,503);
  assert.equal((await serviceHealth({...env,MAINTENANCE_MODE:'true'},now)).status,503);
  assert.equal((await serviceHealth({DB:{prepare(){throw Error('private secret');}}},now)).status,503);
 }finally{db.close();}
});

test('quota monitor alerts at 80/95 percent, respects account-wide usage and reports unknown metrics instead of zero',async()=>{
 assert.equal(quotaSignals({workerRequests:79999}).length,0);assert.equal(quotaSignals({workerRequests:80000})[0].level,'warning');assert.equal(quotaSignals({kvWrites:950})[0].level,'critical');
 const previous=globalThis.fetch,db=createD1(),now=Date.now(),env={CF_ACCOUNT_ID:'a'.repeat(32),CF_ANALYTICS_TOKEN:'read-only-test'};let calls=0;
 try{
  globalThis.fetch=async()=>{calls++;return Response.json({data:{viewer:{accounts:[{workersInvocationsAdaptive:[{sum:{requests:40000}},{sum:{requests:40001}}],d1AnalyticsAdaptiveGroups:[{sum:{rowsRead:100,rowsWritten:2}}],d1StorageAdaptiveGroups:[],kvStorageAdaptiveGroups:[],kvOperationsAdaptiveGroups:[{dimensions:{actionType:'read'},sum:{requests:5}}]}]}}});};
  const quota=await collectQuota(env,now);assert.equal(quota.values.workerRequests,80001);
  await monitorQuota(db,env,now);await monitorQuota(db,env,now+300000);assert.equal(calls,2);
  globalThis.fetch=async()=>Response.json({errors:[{message:'Access denied'}]});await monitorQuota(db,env,now+3600001);assert.equal((await runtime(db,'quota')).ok,false);
 }finally{globalThis.fetch=previous;db.close();}
});

test('maintenance pauses purchases and public SVGs before any mutation',async()=>{
 for(const [path,method]of [['/api/wallet/spend','POST'],['/api/wallet/topup','POST'],['/api/arena','GET'],['/badges/flex.svg','GET']]){
  const r=await worker.fetch(new Request('https://badges.example'+path,{method}),{MAINTENANCE_MODE:'true'},{});assert.equal(r.status,503);assert.equal((await r.json()).error,'maintenance');assert.equal(r.headers.get('Cache-Control'),'no-store');
 }
});

test('maintenance durably accepts a signed webhook without querying the payment or delivering credits',async()=>{
 const db=createD1(),tasks=[],previous=globalThis.fetch,key=Buffer.from('standard-webhooks-maintenance-only-key'),env={...dodoEnv,DB:db,MAINTENANCE_MODE:'true',DODO_PAYMENTS_WEBHOOK_KEY:'whsec_'+key.toString('base64')};
 try{
  globalThis.fetch=()=>{throw Error('Payment lookup must stay paused');};
  const body=JSON.stringify({business_id:business,type:'payment.succeeded',data:{payment_id:paymentId}}),id='evt_maintenance',time=String(Math.floor(Date.now()/1000)),signature=createHmac('sha256',key).update(id+'.'+time+'.'+body).digest('base64');
  const r=await worker.fetch(new Request(dodoEnv.APP_URL+'/api/dodo/webhook',{method:'POST',body,headers:{'webhook-id':id,'webhook-timestamp':time,'webhook-signature':'v1,'+signature}}),env,{waitUntil:task=>tasks.push(task)});
  assert.equal(r.status,202);assert.equal(db.sqlite.prepare('SELECT state FROM bw_webhooks').get().state,'pending');assert.equal(tasks.length,0);assert.equal(db.sqlite.prepare('SELECT count(*) n FROM bw_ledger').get().n,0);
 }finally{globalThis.fetch=previous;db.close();}
});

test('scheduled publication failures retain dirty work and an auditable incident instead of failing silently',async()=>{
 const db=createD1(),tasks=[];try{
  await worker.scheduled({cron:'1-59/5 * * * *',scheduledTime:Date.now()},{DB:db,APP_URL:'https://badges.example',BADGES:{async put(){throw Error('KV unavailable');}}},{waitUntil:task=>tasks.push(task)});await Promise.all(tasks);
  assert.deepEqual((await runtime(db,'publisher')).failed,['projections']);assert.equal(db.sqlite.prepare("SELECT count(*) n FROM bw_badges WHERE dirty=1").get().n,5);assert.equal(db.sqlite.prepare('SELECT kind FROM bw_operations').get().kind,'scheduled_stage_failed');
 }finally{db.close();}
});
