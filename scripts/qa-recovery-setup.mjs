// Local-only recovery drill with the real Dodo test payment references from B.
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
const dir='.wrangler/block-c/financial';
if(await access(dir+'/source.json').then(()=>true,()=>false))throw Error('Recovery fixtures already exist; retain and inspect them');
await mkdir(dir,{recursive:true});
const vars=await readFile('.dev.vars.dodo-test','utf8');if(!/^DODO_PAYMENTS_ENVIRONMENT=test_mode\r?$/m.test(vars))throw Error('Test only');
const payments={};for(const name of ['business','threeDS'])payments[name]=JSON.parse(await readFile('.wrangler/dodo-qa-b/payment-'+name+'.json','utf8'));
await writeFile(dir+'/payments.json',JSON.stringify(payments),{mode:0o600});
for(const [name,port]of [['source',8801],['restored',8802]]){
 const folder=dir+'/'+name;await mkdir(folder,{recursive:true});await writeFile(folder+'/.dev.vars',vars+'\nAPP_URL=http://127.0.0.1:'+port+'\n');
 const config={name:'badgewars-recovery-'+name,main:resolve(dir+'/entry.mjs'),compatibility_date:'2026-10-18',compatibility_flags:['nodejs_compat'],d1_databases:[{binding:'DB',database_name:'badgewars-recovery-'+name,database_id:randomUUID(),migrations_dir:resolve('migrations')}],kv_namespaces:[{binding:'BADGES',id:randomUUID().replaceAll('-','')}]};await writeFile(folder+'/wrangler.json',JSON.stringify(config));
 // Secrets stay beside this local config and are never published.
}
await writeFile(dir+'/entry.mjs',`import worker from '../../../src/worker.mjs';
import {reconcilePayment} from '../../../src/dodo.mjs';
import {settle} from '../../../src/settlement.mjs';
import {publishDirty} from '../../../src/projection.mjs';
import {catalog} from '../../../public/badges.js';
import {TERMS_VERSION,termsDocument} from '../../../public/terms.js';
import payments from './payments.json';
let checkpoint=false;const upstream=globalThis.fetch.bind(globalThis);
globalThis.fetch=(input,init)=>{const url=new URL(input.url||input);const p=Object.values(payments).find(p=>url.origin==='https://test.dodopayments.com'&&url.pathname==='/payments/'+p.payment_id);if(checkpoint&&p)return Promise.resolve(Response.json({...p,refunds:[],refund_status:null}));return upstream(input,init);};
export default {...worker,async fetch(request,env,ctx){const url=new URL(request.url);
 if(!url.pathname.startsWith('/__qa/'))return worker.fetch(request,env,ctx);
 if(!['http://127.0.0.1:8801','http://127.0.0.1:8802'].includes(env.APP_URL)||url.origin!==env.APP_URL||env.DODO_PAYMENTS_ENVIRONMENT!=='test_mode'||request.headers.get('Origin')!==env.APP_URL)return new Response('Forbidden',{status:403});
 if(url.pathname==='/__qa/prepare'){
  if((await env.DB.prepare('SELECT count(*) n FROM bw_users').first()).n)throw Error('Do not reset an existing checkpoint');
  for(const [name,p]of Object.entries(payments)){await env.DB.batch([
   env.DB.prepare("INSERT INTO bw_users(id,provider,subject,name) VALUES(?,'github',?,?)").bind(p.metadata.user_id,'recovery-'+p.metadata.user_id,'recovery_'+name),
   env.DB.prepare("INSERT INTO bw_topups(id,user_id,credits,currency,product_id,terms_version,terms_snapshot,checkout_id,state,provider,environment) VALUES(?,?,?,?,?,?,?,?,'open','dodo','test_mode')").bind(p.metadata.topup_id,p.metadata.user_id,5,p.currency.toLowerCase(),p.product_cart[0].product_id,p.metadata.terms_version,JSON.stringify(termsDocument()),p.checkout_session_id)
  ]);}
  checkpoint=true;try{for(const p of Object.values(payments))await reconcilePayment(env.DB,env,p.payment_id);}finally{checkpoint=false;}
  const consent={accepted:true,executionRequested:true,withdrawalAcknowledged:true,termsVersion:TERMS_VERSION};
  const owned=[];for(const [name,level]of [['business',1],['threeDS',2]])owned.push(await settle(env.DB,catalog[0],{...consent,userId:payments[name].metadata.user_id,owner:'recovery_'+name,amount:level*100},crypto.randomUUID()));
  await env.DB.prepare('UPDATE bw_badges SET published_at=0,dirty=1').run();await publishDirty(env.DB,env);return Response.json({owned});
 }
 if(url.pathname==='/__qa/reconcile'){for(const p of Object.values(payments))await reconcilePayment(env.DB,env,p.payment_id);return Response.json({reconciled:true});}
 if(url.pathname==='/__qa/rebuild'){await env.DB.batch([env.DB.prepare('DELETE FROM bw_sessions'),env.DB.prepare('DELETE FROM bw_oauth_states'),env.DB.prepare('DELETE FROM bw_email_codes'),env.DB.prepare('UPDATE bw_badges SET dirty=1,revision=revision+1,published_at=0,lease_until=0,lease_token=NULL')]);await publishDirty(env.DB,env);return Response.json({rebuilt:true});}
 if(url.pathname==='/__qa/projections'){const values={};for(const b of catalog)values[b.id]=await env.BADGES.get('badge:'+b.id,'json');return Response.json(values);}
 if(url.pathname==='/__qa/stale-cache'){const values=await request.json();for(const b of catalog)await env.BADGES.put('badge:'+b.id,JSON.stringify(values[b.id]));return Response.json({stale:true});}
 if(url.pathname==='/__qa/status')return Response.json((await env.DB.prepare("SELECT u.name,w.balance,w.debt,w.frozen,b.id badge_id,b.status badge_status,(SELECT count(*) FROM bw_ledger l WHERE l.user_id=u.id) ledger_count FROM bw_users u JOIN bw_wallets w ON w.user_id=u.id LEFT JOIN bw_user_badges b ON b.user_id=u.id ORDER BY u.name").all()).results);
 return new Response('Missing',{status:404});
}};`);
console.log('Recovery checkpoint prepared. The checkpoint deliberately models pre-refund state; actual reconciliation uses live Dodo TEST reads only.');
