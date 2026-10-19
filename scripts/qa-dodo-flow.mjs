// Run only against the isolated native harness after both Dodo test payments.
import {readFile,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {TERMS_VERSION} from '../public/terms.js';
const origin='http://127.0.0.1:8792';
const accounts=JSON.parse(await readFile('.wrangler/dodo-qa/accounts.json','utf8'));
const checkouts=JSON.parse(await readFile('.wrangler/dodo-qa/checkouts.json','utf8'));
const headers=name=>({Cookie:'bw_session='+accounts[name].token,Origin:origin,'Content-Type':'application/json'});
async function call(name,path,body,id){const r=await fetch(origin+path,{headers:{...headers(name),...(body?{'Idempotency-Key':id||randomUUID()}:{})},...(body?{method:'POST',body:JSON.stringify(body)}:{})});const value=await r.json();assert.equal(r.status,200,JSON.stringify(value));return value;}
const consent={accepted:true,executionRequested:true,withdrawalAcknowledged:true,termsVersion:TERMS_VERSION};
const spend=(name,level,id)=>call(name,'/api/wallet/spend',{...consent,badge:'flex',owner:accounts[name].alias,amount:level*100},id);
for(const name of ['owner','rival'])assert.equal((await call(name,'/api/me/wallet')).balance,5);
// Redirects and unsigned requests cannot create any additional credits.
for(const name of ['owner','rival'])await fetch(origin+'/api/checkout/return?topup='+checkouts[name].id,{redirect:'manual'});
const unsigned=await fetch(origin+'/api/dodo/webhook',{method:'POST',body:'{}'});assert.equal(unsigned.status,403);
const first=await spend('owner',1);
const before=await call('owner','/api/me/embed?badge='+first.holderId+'&format=html&lang=es');
const second=await spend('rival',2);
assert.equal((await call('owner','/api/me/badges')).items[0].rank,2);
const renewalId=randomUUID(),renewed=await spend('owner',3,renewalId);
const repeated=await spend('owner',3,renewalId);
assert.equal(renewed.cost,2);assert.equal(repeated.balance,2);assert.equal(renewed.holderId,first.holderId);
const after=await call('owner','/api/me/embed?badge='+first.holderId+'&format=html&lang=es');
const markdown=await call('owner','/api/me/embed?badge='+first.holderId+'&format=md&lang=es');
assert.equal(before.imageUrl,after.imageUrl);assert.equal(new URL(after.imageUrl).search,'');
assert.ok(after.code.includes(after.imageUrl));assert.ok(markdown.code.includes(after.imageUrl));
const inventory=await call('owner','/api/me/badges');assert.equal(inventory.items.length,1);assert.equal(inventory.items[0].rank,1);
assert.equal((await fetch(origin+'/api/me/embed?badge='+first.holderId)).status,401);
assert.equal((await fetch(origin+'/api/me/embed?badge='+first.holderId,{headers:headers('rival')})).status,404);
const denied=await fetch(origin+'/api/me/refund-request',{method:'POST',headers:headers('owner'),body:JSON.stringify({topupId:checkouts.owner.id})});assert.equal(denied.status,409);
const portalLinks={};
for(const name of ['owner','rival'])portalLinks[name]=(await call(name,'/api/me/billing-portal',{})).url;
const foreignPayment=JSON.parse(await readFile('.wrangler/dodo-qa/payment-rival.json','utf8'));
const foreign=await fetch(origin+'/api/me/billing-portal',{method:'POST',headers:headers('owner'),body:JSON.stringify({customerId:foreignPayment.customer.customer_id})});assert.equal(foreign.status,503);
const report={mode:'test_mode',nativeD1:true,simulatedPaidCreditsPerAccount:5,minimumBasePerCurrency:5,ownerBalance:(await call('owner','/api/me/wallet')).balance,rivalBalance:(await call('rival','/api/me/wallet')).balance,renewalCost:renewed.cost,oneCurrentBadge:true,stableSvgUrl:true,privateEmbedIsolation:true,foreignPortalDenied:true,commercialRefundAfterUseDenied:true,unsignedWebhookDenied:true};
await writeFile('.wrangler/dodo-qa/flow.json',JSON.stringify({first,second,renewed,before,after,markdown,portalLinks},null,2),{mode:0o600});
await writeFile('artifacts/dodo-flow-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
