import {readFile,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {TERMS_VERSION} from '../public/terms.js';
const dir='.wrangler/dodo-qa-b',origin='http://127.0.0.1:8798';
const accounts=JSON.parse(await readFile(dir+'/accounts.json','utf8')),checkouts=await readFile(dir+'/checkouts.json','utf8').then(JSON.parse,()=>({}));
for(const [name,account] of Object.entries(accounts)){
 if(checkouts[name]){if(!checkouts[name].url)throw Error('Uncertain checkout: inspect before retrying');console.log(name,'existing checkout retained');continue;}
 const login=await fetch(origin+'/__qa/login?'+new URLSearchParams({account:name,token:account.token}),{redirect:'manual'});assert.equal(login.status,302);
 const id=randomUUID();checkouts[name]={id};await writeFile(dir+'/checkouts.json',JSON.stringify(checkouts,null,2),{mode:0o600});
 const response=await fetch(origin+'/api/wallet/topup',{method:'POST',headers:{Cookie:'bw_session='+account.token,Origin:origin,'Content-Type':'application/json','Idempotency-Key':id},body:JSON.stringify({credits:5,currency:'auto',locale:'es',accepted:true,immediateDelivery:true,adultConfirmed:true,termsVersion:TERMS_VERSION,turnstileToken:'XXXX.DUMMY.TOKEN.XXXX'})});
 const data=await response.json();assert.equal(response.status,200,JSON.stringify(data));checkouts[name]=data;
 await writeFile(dir+'/checkouts.json',JSON.stringify(checkouts,null,2),{mode:0o600});
 console.log(name,data.id,data.url);
}
