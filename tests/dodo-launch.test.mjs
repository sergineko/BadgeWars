import test from 'node:test';
import assert from 'node:assert/strict';
import {apiKeyReady,createTopup,paymentsReady,receiveEvent,processEvents,billingPortalUrl,paymentEvents} from '../src/dodo.mjs';
import {liveChecks,inspectLive,webhookMatches} from '../scripts/dodo-launch.mjs';
import {env,input,fixture,providerMock,business,paymentId} from './helpers/dodo.mjs';
import worker from '../src/worker.mjs';
const live={...env,APP_URL:'https://badgewars.com',DODO_PAYMENTS_ENVIRONMENT:'live_mode',DODO_PAYMENTS_API_KEY:'dodo_live_opaque_verified',DODO_CHECKOUT_ENABLED:'false',DODO_LIVE_APPROVAL_REFERENCE:'Dashboard approval confirmed by owner 2026-10-20',DODO_WEBHOOK_ID:'ep_permanentLive'};
const webhook={id:live.DODO_WEBHOOK_ID,url:'https://badgewars.com/api/dodo/webhook',disabled:false,filter_types:[...paymentEvents]};

test('live approval and complete credentials never enable checkout without the explicit launch switch',()=>{
 assert.equal(Object.values(liveChecks(live)).every(Boolean),true);
 assert.equal(paymentsReady(live),false);
 for(const value of [undefined,'false','TRUE','1','yes','typo'])assert.equal(paymentsReady({...live,DODO_CHECKOUT_ENABLED:value}),false);
 assert.equal(paymentsReady({...live,DODO_CHECKOUT_ENABLED:'true'}),true);
 assert.equal(paymentsReady({...live,DODO_CHECKOUT_ENABLED:'true',DODO_LIVE_APPROVAL_REFERENCE:''}),false);
 assert.equal(paymentsReady({...env,DODO_CHECKOUT_ENABLED:'false'}),false);
 assert.equal(paymentsReady(env),true);
 assert.equal(apiKeyReady('dodo_test_wrong','live_mode'),false);
});

test('paused topups reject before provider calls or durable payment attempts',async()=>{
 const previous=globalThis.fetch,{db,user,state}=await fixture();try{
  const calls=state.calls.length,attempts=db.sqlite.prepare('SELECT count(*) n FROM bw_topups').get().n;
  await assert.rejects(createTopup(db,live,input,user,crypto.randomUUID()),/payments_unavailable/);
  assert.equal(state.calls.length,calls);assert.equal(db.sqlite.prepare('SELECT count(*) n FROM bw_topups').get().n,attempts);
  assert.equal(db.sqlite.prepare('SELECT balance FROM bw_wallets WHERE user_id=?').get(user).balance,0);
 }finally{db.close();globalThis.fetch=previous;}
});

test('pausing new checkout preserves signed-event reconciliation, idempotency and existing invoices portal',async()=>{
 const previous=globalThis.fetch,{db,user,state}=await fixture(),paused={...env,DODO_CHECKOUT_ENABLED:'false'};try{
  globalThis.fetch=providerMock(state);
  await receiveEvent(db,paused,{business_id:business,type:'payment.succeeded',data:{payment_id:paymentId}},'event_while_paused');
  await processEvents(db,paused);await processEvents(db,paused);
  assert.equal(db.sqlite.prepare('SELECT balance FROM bw_wallets WHERE user_id=?').get(user).balance,15);
  assert.equal(db.sqlite.prepare('SELECT count(*) n FROM bw_orders').get().n,1);
  assert.equal(await billingPortalUrl(db,paused,user,'cus_testCustomer'),'https://test.customer.dodopayments.com/session/owned');
  await assert.rejects(createTopup(db,paused,input,user,crypto.randomUUID()),/payments_unavailable/);
 }finally{db.close();globalThis.fetch=previous;}
});

test('read-only preflight validates one EUR product, FX previews and every reconciliation event',async()=>{
 const products=[{product_id:live.DODO_PRODUCT_ID_EUR,business_id:business,tax_category:'saas',is_recurring:false,credit_entitlements:[],price:{type:'one_time_price',price:100,currency:'EUR',tax_inclusive:false}}];
 const calls=[],client={products:{async retrieve(id){calls.push('GET '+id);return products.find(p=>p.product_id===id);},async *list(){calls.push('GET active-products');yield*products;}},webhooks:{async retrieve(id){calls.push('GET '+id);return webhook;}},checkoutSessions:{async preview(input){calls.push('PREVIEW '+input.billing_currency);return {currency:input.billing_currency,current_breakup:{total_amount:562}};}}};
 assert.equal(Object.values(await inspectLive({...live,DODO_PRODUCT_ID_USD:undefined},client)).every(Boolean),true);assert.equal(calls.length,5);
 for(const bad of [{disabled:true},{url:'https://other.example/api/dodo/webhook'},{filter_types:['payment.succeeded']},{id:'ep_foreign'}])assert.equal(webhookMatches({...webhook,...bad},live),false);
 products[0].price.price=99;assert.equal(Object.values(await inspectLive(live,client)).every(Boolean),false);
 await assert.rejects(inspectLive({...live,DODO_PAYMENTS_ENVIRONMENT:'test_mode'},client),/incomplete_live_configuration/);
});

test('public payment status exposes only environment, availability and minimum; never credentials or provider IDs',async()=>{
 const response=await worker.fetch(new Request('https://badgewars.com/api/payments/status'),live,{});
 assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');
 assert.deepEqual(await response.json(),{provider:'dodo',environment:'live_mode',topupsEnabled:false,minimumCredits:5,baseCurrency:'EUR',baseMinorUnitsPerCredit:100,billingCurrency:'adaptive'});
});
