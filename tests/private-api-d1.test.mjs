import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createD1,seedUser,consent} from './helpers/d1.mjs';
import worker from '../src/worker.mjs';
import {hash} from '../src/auth.mjs';
import {settle} from '../src/settlement.mjs';
import {catalog} from '../public/badges.js';
import {TERMS_VERSION,termsDocument} from '../public/terms.js';
import {legalRoutes,legalSections} from '../public/legal.js';
const origin='https://badges.example';
async function setup(){const DB=createD1(),user=await seedUser(DB,{credits:200}),other=await seedUser(DB,{credits:200}),token='opaque-private-test-session';await DB.prepare('INSERT INTO bw_sessions(token_hash,user_id,expires) VALUES(?,?,?)').bind(await hash(token),user,Date.now()+600000).run();return {env:{DB,APP_URL:origin,AUTH_COOKIE_SECRET:'a-long-cookie-secret-for-private-tests'},user,other,headers:{Cookie:'bw_session='+token,Origin:origin},tasks:[]};}
const call=(ctx,path,method='GET',body,headers={})=>worker.fetch(new Request(origin+path,{method,headers:{...ctx.headers,...headers},...(body===undefined?{}:{body:JSON.stringify(body)})}),ctx.env,{waitUntil:job=>ctx.tasks.push(job)});

test('private inventory and embed generation require the session owner; visibility is never mutated by GET',async()=>{
 const ctx=await setup();try{
  const badge=await settle(ctx.env.DB,catalog[0],{...consent,userId:ctx.other,amount:10000,owner:'someone'},crypto.randomUUID());
  assert.equal((await worker.fetch(new Request(origin+'/api/me/badges'),ctx.env,{})).status,401);
  assert.equal((await call(ctx,'/api/me/embed?badge='+badge.holderId)).status,404);
  assert.equal((await call(ctx,'/api/me/supporters?badge='+badge.holderId)).status,404);
  const owned=await settle(ctx.env.DB,catalog[3],{...consent,userId:ctx.user,amount:2000,owner:'mine'},crypto.randomUUID());
  const embed=await call(ctx,'/api/me/embed?badge='+owned.holderId+'&lang=es');assert.equal(embed.status,200);assert.equal(embed.headers.get('Cache-Control'),'no-store');const code=await embed.json();assert.ok(JSON.stringify(code).includes('/badges/quality/'+owned.holderId+'/es.svg'));
  assert.equal((await call(ctx,'/api/me/visibility')).status,404);
  assert.equal((await call(ctx,'/api/me/visibility','POST',{badge:owned.holderId,count:6})).status,400);
  assert.equal((await call(ctx,'/api/me/visibility','POST',{badge:owned.holderId,count:2},{Origin:'https://evil.example'})).status,403);
  assert.equal(ctx.env.DB.sqlite.prepare('SELECT show_top FROM bw_user_badges WHERE id=?').get(owned.holderId).show_top,0);
 }finally{await Promise.all(ctx.tasks);ctx.env.DB.close();}
});

test('spending checks current consent and safe input before the atomic wallet mutation',async()=>{
 const ctx=await setup();try{
  const input={badge:'bait',owner:'mine',amount:500},headers={'Idempotency-Key':crypto.randomUUID()};
  assert.equal((await call(ctx,'/api/wallet/spend','POST',input,headers)).status,400);assert.equal(ctx.env.DB.sqlite.prepare('SELECT balance FROM bw_wallets WHERE user_id=?').get(ctx.user).balance,200);
  const result=await call(ctx,'/api/wallet/spend','POST',{...input,...consent},headers);assert.equal(result.status,200);assert.equal((await result.json()).balance,195);
  const retry=await call(ctx,'/api/wallet/spend','POST',{...input,...consent},headers);assert.equal((await retry.json()).balance,195);
  assert.equal(ctx.env.DB.sqlite.prepare('SELECT terms_version FROM bw_actions').get().terms_version,TERMS_VERSION);
  assert.equal((await call(ctx,'/api/wallet/spend','POST',null,headers)).status,400);
  assert.equal((await call(ctx,'/api/wallet/spend','POST',{large:'x'.repeat(9000)},headers)).status,413);
 }finally{await Promise.all(ctx.tasks);ctx.env.DB.close();}
});

test('signed webhook is durably queued before acknowledgement; forged and oversized events never touch D1',async()=>{
 const original=globalThis.fetch,ctx=await setup(),key=Buffer.from('new-standard-webhook-key-for-tests');globalThis.fetch=async()=>Response.json({metadata:{app:'another-project'}});ctx.env.POLAR_WEBHOOK_SECRET='whsec_'+key.toString('base64');
 try{
  const body=JSON.stringify({type:'order.paid',data:{id:crypto.randomUUID()}}),id='event_durable',stamp=String(Math.floor(Date.now()/1000)),signature=createHmac('sha256',key).update(id+'.'+stamp+'.'+body).digest('base64'),headers={'webhook-id':id,'webhook-timestamp':stamp,'webhook-signature':'v1,'+signature};
  const response=await worker.fetch(new Request(origin+'/api/polar/webhook',{method:'POST',body,headers}),ctx.env,{waitUntil:job=>ctx.tasks.push(job)});assert.equal(response.status,202);assert.equal(ctx.env.DB.sqlite.prepare('SELECT count(*) AS n FROM bw_webhooks').get().n,1);
  assert.equal((await worker.fetch(new Request(origin+'/api/polar/webhook',{method:'POST',body:body+' ',headers}),ctx.env,{})).status,403);
  assert.equal((await worker.fetch(new Request(origin+'/api/polar/webhook',{method:'POST',body:'x'.repeat(65537)}),ctx.env,{})).status,413);
 }finally{await Promise.all(ctx.tasks);globalThis.fetch=original;ctx.env.DB.close();}
});

test('ES/EN legal documents include all five badges, mandatory rights and SergioTech identity without telephone fields',async()=>{
 for(const locale of ['es','en']){
  const doc=termsDocument({},locale);assert.equal(doc.locale,locale);assert.equal(doc.operator.name,'Sergio Moreno García');assert.ok(doc.operator.address);assert.ok(doc.operator.taxId);assert.equal(doc.operator.phone,undefined);
  for(const name of ['The Apex Flex','Don’t Click This','Build Funded','Genesis Edition'])assert.ok(doc.sections.some(s=>s.title.includes(name)));
  assert.ok(doc.sections.some(s=>/Trust Bag/.test(s.title)));assert.ok(doc.sections.some(s=>locale==='es'?s.text.includes('catorce'):s.text.includes('fourteen')));
  for(const path of legalRoutes)assert.ok(legalSections(path,locale).length>=3);
  const response=await worker.fetch(new Request(origin+'/api/legal/terms/'+locale+'.txt'),{},{});assert.equal(response.status,200);assert.ok(response.headers.get('Content-Disposition').includes('attachment'));assert.ok((await response.text()).includes(doc.operator.email));
 }
 const ctx=await setup();try{const id=crypto.randomUUID();ctx.env.DB.sqlite.prepare('INSERT INTO bw_topups(id,user_id,credits,currency,product_id,terms_version,terms_snapshot,immediate_delivery,adult_confirmed) VALUES(?,?,5,?,?,?, ?,1,1)').run(id,ctx.other,'usd',crypto.randomUUID(),TERMS_VERSION,JSON.stringify(termsDocument()));assert.equal((await call(ctx,'/api/me/confirmation/'+id)).status,404);}finally{ctx.env.DB.close();}
});

test('action confirmations preserve separate consent and terms; only their owner can download them',async()=>{
 const ctx=await setup();try{
  const missing={...consent,executionRequested:false,userId:ctx.user,owner:'mine',amount:500};await assert.rejects(settle(ctx.env.DB,catalog[1],missing,crypto.randomUUID()),/invalid_consent/);
  const action=await settle(ctx.env.DB,catalog[1],{...consent,userId:ctx.user,owner:'mine',amount:500,locale:'en'},crypto.randomUUID());
  const response=await call(ctx,'/api/me/action-confirmation/'+action.id);assert.equal(response.status,200);assert.ok(response.headers.get('Content-Disposition').includes('attachment'));
  const doc=await response.json();assert.equal(doc.execution_requested,1);assert.equal(doc.withdrawal_acknowledged,1);assert.equal(doc.document.locale,'en');assert.equal(doc.document.merchantOfRecord.name,'Polar Software, Inc.');assert.ok(doc.document.sections.some(s=>s.text.includes('Article 103')));
  assert.throws(()=>ctx.env.DB.sqlite.exec("UPDATE bw_terms_documents SET document='{}'"),/immutable_terms/);
  const foreign=await settle(ctx.env.DB,catalog[2],{...consent,userId:ctx.other,owner:'other',amount:5000},crypto.randomUUID());assert.equal((await call(ctx,'/api/me/action-confirmation/'+foreign.id)).status,404);
 }finally{ctx.env.DB.close();}
});

test('billing portal uses the configured Polar organization and keeps invoice access independent of new checkout availability',async()=>{
 const ctx=await setup();try{
  ctx.env.POLAR_ORGANIZATION_SLUG='badgewars-test';const response=await call(ctx,'/api/me/billing-portal','POST');assert.equal(response.status,200);assert.equal((await response.json()).url,'https://sandbox.polar.sh/badgewars-test/portal');
  ctx.env.POLAR_ENVIRONMENT='production';assert.equal((await (await call(ctx,'/api/me/billing-portal','POST')).json()).url,'https://polar.sh/badgewars-test/portal');
  assert.equal((await call(ctx,'/api/me/billing-portal','POST',undefined,{Origin:'https://evil.example'})).status,403);
  ctx.env.POLAR_ORGANIZATION_SLUG='../another';assert.equal((await call(ctx,'/api/me/billing-portal','POST')).status,503);
 }finally{ctx.env.DB.close();}
});
