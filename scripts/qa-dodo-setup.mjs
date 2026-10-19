// Opt-in test preparation. Never deploy the generated loopback-only harness.
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomBytes,randomUUID} from 'node:crypto';
const directory=resolve('.wrangler/dodo-qa');
await mkdir(directory,{recursive:true});
const paymentVars=await readFile('.dev.vars.dodo-test','utf8');
if(!/^DODO_PAYMENTS_ENVIRONMENT=test_mode$/m.test(paymentVars))throw Error('Explicit test mode required');
const accounts=Object.fromEntries(['owner','rival'].map(name=>[name,{id:randomUUID(),token:randomBytes(32).toString('hex'),alias:'dodo_'+name}]));
await writeFile(directory+'/accounts.json',JSON.stringify(accounts),{mode:0o600});
await writeFile(directory+'/.dev.vars',paymentVars+`\nAPP_URL=http://127.0.0.1:8792\nAUTH_COOKIE_SECRET=${randomBytes(32).toString('hex')}\nAUTH_PROVIDERS=\nEMAIL_AUTH_ENABLED=false\nTURNSTILE_SITE_KEY=1x00000000000000000000AA\nTURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA\nQA_ACCOUNTS=${JSON.stringify(accounts)}\n`,{mode:0o600});
const config={name:'badgewars-dodo-qa',main:'entry.mjs',compatibility_date:'2026-10-18',compatibility_flags:['nodejs_compat'],assets:{directory:resolve('public'),binding:'ASSETS',not_found_handling:'single-page-application',run_worker_first:['/api/*','/badges/*','/b/*','/__qa/*','/terms','/refunds','/privacy','/legal','/cookies']},d1_databases:[{binding:'DB',database_name:'badgewars-dodo-qa',database_id:randomUUID(),migrations_dir:resolve('migrations')}],kv_namespaces:[{binding:'BADGES',id:randomUUID().replaceAll('-','')}]};
await writeFile(directory+'/wrangler.json',JSON.stringify(config,null,2));
await writeFile(directory+'/entry.mjs',`import worker from '../../src/worker.mjs';
import {hash} from '../../src/auth.mjs';
export default {...worker,async fetch(request,env,ctx){
 const url=new URL(request.url);
 if(url.pathname==='/__qa/login'){
  if(env.APP_URL!=='http://127.0.0.1:8792'||url.origin!==env.APP_URL||env.DODO_PAYMENTS_ENVIRONMENT!=='test_mode')return new Response('Forbidden',{status:403});
  const account=JSON.parse(env.QA_ACCOUNTS||'{}')[url.searchParams.get('account')];
  if(!account||account.token!==url.searchParams.get('token'))return new Response('Forbidden',{status:403});
  await env.DB.batch([env.DB.prepare("INSERT INTO bw_users(id,provider,subject,name) VALUES(?,'github',?,?) ON CONFLICT DO NOTHING").bind(account.id,'dodo-qa-'+account.id,account.alias),env.DB.prepare('INSERT INTO bw_sessions(token_hash,user_id,expires) VALUES(?,?,?) ON CONFLICT(token_hash) DO UPDATE SET expires=excluded.expires').bind(await hash(account.token),account.id,Date.now()+86400000)]);
  return new Response(null,{status:302,headers:{Location:'/collection','Set-Cookie':'bw_session='+account.token+'; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400','Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
 }
 return worker.fetch(request,env,ctx);
}};`);
console.log('Isolated loopback harness prepared; no production bindings or social credentials copied.');
