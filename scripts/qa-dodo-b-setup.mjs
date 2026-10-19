// Isolated block B test fixtures. Never deploy this entry point or its credentials.
import {mkdir,readFile,writeFile,access} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomBytes,randomUUID} from 'node:crypto';
const dir=resolve('.wrangler/dodo-qa-b');
if(await access(dir+'/accounts.json').then(()=>true,()=>false))throw Error('Existing block B fixtures: reuse them instead of resetting payment references');
await mkdir(dir,{recursive:true});
const vars=await readFile('.dev.vars.dodo-test','utf8');
if(!/^DODO_PAYMENTS_ENVIRONMENT=test_mode\r?$/m.test(vars))throw Error('Explicit Dodo test mode required');
const accounts=Object.fromEntries(['business','threeDS','decline','funds'].map(name=>[name,{id:randomUUID(),token:randomBytes(32).toString('hex'),alias:'qa_b_'+name.toLowerCase()}]));
await writeFile(dir+'/accounts.json',JSON.stringify(accounts),{mode:0o600});
await writeFile(dir+'/.dev.vars',vars+`\nAPP_URL=http://127.0.0.1:8798\nAUTH_COOKIE_SECRET=${randomBytes(32).toString('hex')}\nAUTH_PROVIDERS=\nEMAIL_AUTH_ENABLED=false\nTURNSTILE_SITE_KEY=1x00000000000000000000AA\nTURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA\nQA_ACCOUNTS=${JSON.stringify(accounts)}\n`,{mode:0o600});
const config={name:'badgewars-qa-b',main:'entry.mjs',compatibility_date:'2026-10-18',compatibility_flags:['nodejs_compat'],triggers:{crons:['*/5 * * * *']},assets:{directory:resolve('public'),binding:'ASSETS',not_found_handling:'single-page-application',run_worker_first:['/api/*','/badges/*','/b/*','/__qa/*']},d1_databases:[{binding:'DB',database_name:'badgewars-qa-b',database_id:randomUUID(),migrations_dir:resolve('migrations')}],kv_namespaces:[{binding:'BADGES',id:randomUUID().replaceAll('-','')}]};
await writeFile(dir+'/wrangler.json',JSON.stringify(config,null,2));
await writeFile(dir+'/entry.mjs',`import worker from '../../src/worker.mjs';
import {hash} from '../../src/auth.mjs';
const upstream=globalThis.fetch.bind(globalThis),accounts=${JSON.stringify(accounts)};
globalThis.fetch=async(input,init)=>{
 const request=new Request(input,init),url=new URL(request.url);
 if(url.origin==='https://test.dodopayments.com'&&url.pathname==='/checkouts'&&request.method==='POST'){
  const body=await request.clone().json(),name=Object.keys(accounts).find(k=>accounts[k].id===body.metadata?.user_id);
  if(name){body.customer={email:'support@badgewars.com',name:'BadgeWars QA '+name};body.billing_address={country:'ES',city:'Madrid',state:'Madrid',street:'Calle de prueba 1',zipcode:'28001'};if(name==='threeDS')body.force_3ds=true;if(name==='business'){body.customer_business_name='BadgeWars QA Test Company';body.tax_id='ESB12345674';}
   console.log('QA checkout scenario',name,'forced3DS',body.force_3ds===true);
   const headers=new Headers(request.headers);headers.delete('Content-Length');try{const response=await upstream(new Request(request,{headers,body:JSON.stringify(body)}));if(!response.ok)console.log('QA checkout provider error',response.status);return response;}catch(error){console.log('QA checkout transport error',error.message);throw error;}}
 }
 return upstream(request);
};
export default {...worker,async fetch(request,env,ctx){
 const url=new URL(request.url);
 if(url.pathname==='/__qa/login'){
  if(env.APP_URL!=='http://127.0.0.1:8798'||url.origin!==env.APP_URL||env.DODO_PAYMENTS_ENVIRONMENT!=='test_mode')return new Response('Forbidden',{status:403});
  const account=accounts[url.searchParams.get('account')];if(!account||account.token!==url.searchParams.get('token'))return new Response('Forbidden',{status:403});
  await env.DB.batch([env.DB.prepare("INSERT INTO bw_users(id,provider,subject,name) VALUES(?,'github',?,?) ON CONFLICT DO NOTHING").bind(account.id,'qa-b-'+account.id,account.alias),env.DB.prepare('INSERT INTO bw_sessions(token_hash,user_id,expires) VALUES(?,?,?) ON CONFLICT(token_hash) DO UPDATE SET expires=excluded.expires').bind(await hash(account.token),account.id,Date.now()+86400000)]);
  return new Response(null,{status:302,headers:{Location:'/collection','Set-Cookie':'bw_session='+account.token+'; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400','Cache-Control':'no-store'}});
 }
 const publicOrigin=env.QA_PUBLIC_ORIGIN;
 if(url.pathname==='/api/me/embed'&&publicOrigin&&/^https:\/\/[a-z-]+\.trycloudflare\.com$/.test(publicOrigin))return worker.fetch(request,{...env,APP_URL:publicOrigin},ctx);
 return worker.fetch(request,env,ctx);
}};`);
console.log('Block B: native D1/KV fixtures prepared on loopback 8798; no production credentials or resources copied.');
