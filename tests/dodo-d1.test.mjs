import test from 'node:test';
import assert from 'node:assert/strict';
import {createD1,seedUser,consent} from './helpers/d1.mjs';
import {env,input,fixture,providerMock,product,paymentId,business,makePayment} from './helpers/dodo.mjs';
import {createTopup,reconcilePayment,receiveEvent,processEvents,recoverTopups,paymentsReady,billingPortalUrl,apiKeyReady} from '../src/dodo.mjs';
import {settle} from '../src/settlement.mjs';
import {catalog} from '../public/badges.js';
const wallet=(db,user)=>db.sqlite.prepare('SELECT * FROM bw_wallets WHERE user_id=?').get(user);

test('opaque dashboard API keys are supported without inferring the environment from their format',()=>{
 assert.equal(apiKeyReady('opaque-test-credential-without-a-mode-prefix','test_mode'),true);
 assert.equal(apiKeyReady('dodo_live_wrong-environment','test_mode'),false);
 assert.equal(apiKeyReady('dodo_test_wrong-environment','live_mode'),false);
 for(const value of ['',undefined,'replace'])assert.equal(apiKeyReady(value,'test_mode'),false);
 assert.equal(paymentsReady({...env,DODO_PAYMENTS_API_KEY:'opaque-dashboard-credential'}),true);
});

test('D1 rejects new payment rows from an unsupported provider or unspecified environment',async()=>{
 const db=createD1(),user=await seedUser(db);
 try{
  const insert=db.sqlite.prepare('INSERT INTO bw_topups(id,user_id,credits,currency,product_id,terms_version,provider,environment) VALUES(?,?,5,?,?,?,?,?)');
  for(const [provider,mode] of [['retired','test_mode'],['dodo','sandbox'],['dodo','']])assert.throws(()=>insert.run(crypto.randomUUID(),user,'eur',product,'test',provider,mode));
  assert.equal(db.sqlite.prepare('SELECT count(*) AS n FROM bw_topups').get().n,0);
 }finally{db.close();}
});
test('Dodo fixed-price packs preserve consents, quantity, currency and idempotency without minting on redirect',async()=>{
 const previous=globalThis.fetch,{db,user,id,state}=await fixture();try{
  const call=state.calls.find(c=>c.path==='/checkouts'),body=JSON.parse(call.init.body);
  assert.deepEqual(body.product_cart,[{product_id:product,quantity:15}]);assert.equal(body.billing_currency,undefined);assert.equal(body.feature_flags.allow_currency_selection,true);assert.equal(body.metadata.base_currency,'EUR');assert.equal(body.metadata.base_amount,'1500');assert.equal(body.feature_flags.allow_discount_code,false);assert.equal(body.metadata.credits,'15');assert.equal(body.metadata.environment,'test_mode');assert.equal(new Headers(call.init.headers).get('Idempotency-Key'),'dodo:test_mode:'+id);
  assert.equal(wallet(db,user).balance,0);await createTopup(db,env,input,user,id);assert.equal(state.calls.filter(c=>c.path==='/checkouts').length,1);
  const row=db.sqlite.prepare('SELECT * FROM bw_topups').get();assert.equal(row.provider,'dodo');assert.equal(row.immediate_delivery,1);assert.equal(row.adult_confirmed,1);assert.equal(JSON.parse(row.terms_snapshot).merchantOfRecord.name,'Dodo Payments');
  for(const bad of [{credits:4},{credits:5.5},{accepted:false},{immediateDelivery:false},{adultConfirmed:false},{termsVersion:'old'}])await assert.rejects(createTopup(db,env,{...input,...bad},user,crypto.randomUUID()),/invalid_topup/);
  await assert.rejects(createTopup(db,env,{...input,credits:16},user,id),/idempotency_conflict/);
  assert.equal(paymentsReady(env),true);assert.equal(paymentsReady({...env,DODO_PAYMENTS_ENVIRONMENT:'live_mode'}),false);assert.equal(paymentsReady({...env,DODO_PAYMENTS_ENVIRONMENT:'typo'}),false);
  const live={...env,DODO_PAYMENTS_ENVIRONMENT:'live_mode',DODO_PAYMENTS_API_KEY:'dodo_live_verified_key',DODO_CHECKOUT_ENABLED:'true'};assert.equal(paymentsReady(live),false);assert.equal(paymentsReady({...live,DODO_LIVE_APPROVAL_REFERENCE:'written decision 123'}),true);
 }finally{db.close();globalThis.fetch=previous;}
});
test('misconfigured products cannot create discounted, FX or pay-what-you-want topups',async()=>{
 const previous=globalThis.fetch;try{for(const price of [{price:99},{currency:'USD'},{tax_inclusive:true},{pay_what_you_want:true},{discount_bps:100},{purchasing_power_parity:true}]){
  const db=createD1(),user=await seedUser(db),id=crypto.randomUUID(),state={calls:[],price,payment:{}};globalThis.fetch=providerMock(state);
  await assert.rejects(createTopup(db,env,input,user,id),/checkout_recovering/);assert.equal(state.calls.some(c=>c.path==='/checkouts'),false);assert.equal(wallet(db,user).balance,0);db.close();
 }}finally{globalThis.fetch=previous;}
});
test('only authoritative matching successful Dodo payments credit once; webhooks are durable and isolated',async()=>{
 const previous=globalThis.fetch,{db,user,id,state}=await fixture();try{
  state.payment.status='processing';await reconcilePayment(db,env,paymentId);assert.equal(wallet(db,user).balance,0);
  state.payment.status='succeeded';await reconcilePayment(db,env,paymentId);await reconcilePayment(db,env,paymentId);assert.equal(wallet(db,user).balance,15);
  assert.equal(db.sqlite.prepare('SELECT reference FROM bw_ledger').get().reference,'dodo:test_mode:'+paymentId);
  for(const extra of [{business_id:'bus_foreign'},{currency:'XXX!'},{total_amount:1500},{product_cart:[{product_id:product,quantity:14}]},{checkout_session_id:'cks_foreign'},{discount_id:'dis_discount'},{subscription_ids:['sub_recurring']},{customer:{customer_id:'bad'}},{metadata:{...state.payment.metadata,user_id:'foreign'}}]){state.payment=makePayment(user,id,extra);await assert.rejects(reconcilePayment(db,env,paymentId),/payment_mismatch/);assert.equal(wallet(db,user).balance,15);}
  state.payment=makePayment(user,id);const event={business_id:business,type:'payment.succeeded',data:{payment_id:paymentId}};
  await receiveEvent(db,env,event,'event_one');await receiveEvent(db,env,event,'event_one');assert.equal(db.sqlite.prepare('SELECT count(*) n FROM bw_webhooks').get().n,1);await processEvents(db,env);assert.equal(db.sqlite.prepare('SELECT state FROM bw_webhooks').get().state,'complete');
  await assert.rejects(receiveEvent(db,env,{...event,business_id:'bus_other'},'bad'),/invalid_event/);
  assert.equal(await receiveEvent(db,env,{...event,type:'subscription.active'},'ignored'),false);
  assert.equal(await billingPortalUrl(db,env,user,'cus_testCustomer'),'https://test.customer.dodopayments.com/session/owned');assert.equal(await billingPortalUrl(db,env,user,'cus_foreign'),null);
 }finally{db.close();globalThis.fetch=previous;}
});
test('gross Dodo refunds exclude tax, reconcile once, and preserve debt after spending without allowing negative spend',async()=>{
 const previous=globalThis.fetch,{db,user,state}=await fixture();try{
  await reconcilePayment(db,env,paymentId);await settle(db,catalog[1],{...consent,userId:user,owner:'used',amount:1000},crypto.randomUUID());assert.equal(wallet(db,user).balance,5);
  state.payment.refunds=[{refund_id:'ref_whole',status:'succeeded',payment_id:paymentId,amount:1815,currency:'EUR'}];await reconcilePayment(db,env,paymentId);await reconcilePayment(db,env,paymentId);
  assert.equal(wallet(db,user).balance,0);assert.equal(wallet(db,user).debt,10);assert.equal(wallet(db,user).frozen,1);assert.equal(db.sqlite.prepare('SELECT reversed FROM bw_orders').get().reversed,15);
  await assert.rejects(settle(db,catalog[1],{...consent,userId:user,owner:'locked',amount:1100},crypto.randomUUID()),/wallet_frozen/);
 }finally{db.close();globalThis.fetch=previous;}
});
test('partial and pending refunds or disputes reserve the wallet; refunded payments never mint undelivered BC',async()=>{
 const previous=globalThis.fetch;try{
  for(const variant of ['partial','pending','dispute','before']){
   const {db,user,state}=await fixture();if(variant!=='before')await reconcilePayment(db,env,paymentId);
   if(variant==='dispute')state.payment.disputes=[{dispute_status:'dispute_opened'}];else state.payment.refunds=[{refund_id:'ref_partial',status:variant==='pending'?'pending':'succeeded',payment_id:paymentId,amount:variant==='before'?1815:182,currency:'EUR'}];
   await reconcilePayment(db,env,paymentId);assert.equal(wallet(db,user).frozen,1);assert.equal(wallet(db,user).balance,variant==='before'?0:variant==='partial'?14:15);db.close();
  }
 }finally{globalThis.fetch=previous;}
});
test('cron recovers lost payment and refund webhooks within the configured Dodo environment',async()=>{
 const previous=globalThis.fetch,{db,user,state}=await fixture();try{
  db.sqlite.exec('UPDATE bw_topups SET next_check=0');await recoverTopups(db,env);assert.equal(wallet(db,user).balance,15);
  state.payment.refunds=[{refund_id:'ref_lost',status:'succeeded',payment_id:paymentId,amount:1815,currency:'EUR'}];db.sqlite.exec('UPDATE bw_orders SET next_check=0');await recoverTopups(db,env);assert.equal(wallet(db,user).balance,0);assert.equal(wallet(db,user).frozen,1);
 }finally{db.close();globalThis.fetch=previous;}
});

test('declined and cancelled payments close pending receipts without credits and recover a later success',async()=>{
 const previous=globalThis.fetch;try{
  for(const status of ['failed','cancelled']){
   const {db,user,id,state}=await fixture();try{
    state.payment.status=status;db.sqlite.exec('UPDATE bw_topups SET next_check=0');
    await recoverTopups(db,env);
    assert.equal(db.sqlite.prepare('SELECT state FROM bw_topups').get().state,status);
    assert.equal(wallet(db,user).balance,0);assert.equal(wallet(db,user).frozen,0);
    assert.equal(db.sqlite.prepare('SELECT count(*) n FROM bw_ledger').get().n,0);
    state.payment.status='succeeded';db.sqlite.exec('UPDATE bw_topups SET next_check=0');
    await recoverTopups(db,env);await reconcilePayment(db,env,paymentId);
    assert.equal(wallet(db,user).balance,15);
    assert.equal(db.sqlite.prepare('SELECT state FROM bw_topups').get().state,'accepted');
    state.payment.status=status;await reconcilePayment(db,env,paymentId);
    assert.equal(db.sqlite.prepare('SELECT state FROM bw_topups').get().state,'accepted');
    assert.equal(wallet(db,user).balance,15);
   }finally{db.close();}
  }
 }finally{globalThis.fetch=previous;}
});

test('rejected checkout retries are bounded and cannot overwrite a payment review',async()=>{
 const previous=globalThis.fetch,{db,user,state}=await fixture();try{
  state.payment.status='failed';await reconcilePayment(db,env,paymentId);
  db.sqlite.exec("UPDATE bw_topups SET created_at='2020-01-01T00:00:00Z',next_check=0");
  const calls=state.calls.length;await recoverTopups(db,env);assert.equal(state.calls.length,calls);
  assert.equal(db.sqlite.prepare('SELECT state FROM bw_topups').get().state,'failed');
  db.sqlite.exec("UPDATE bw_topups SET state='review'");await reconcilePayment(db,env,paymentId);
  assert.equal(db.sqlite.prepare('SELECT state FROM bw_topups').get().state,'review');assert.equal(wallet(db,user).balance,0);
 }finally{db.close();globalThis.fetch=previous;}
});
test('authoritative full refunds reverse all BC without assuming refund API input units; incomplete partial details never mint',async()=>{
 const previous=globalThis.fetch;try{
  const first=await fixture();await reconcilePayment(first.db,env,paymentId);first.state.payment.refund_status='full';first.state.payment.refunds=[];await reconcilePayment(first.db,env,paymentId);assert.equal(wallet(first.db,first.user).balance,0);assert.equal(first.db.sqlite.prepare('SELECT reversed FROM bw_orders').get().reversed,15);first.db.close();
  const second=await fixture();second.state.payment.refund_status='partial';second.state.payment.refunds=[];await reconcilePayment(second.db,env,paymentId);assert.equal(wallet(second.db,second.user).balance,0);assert.equal(wallet(second.db,second.user).frozen,1);assert.equal(second.db.sqlite.prepare('SELECT count(*) n FROM bw_orders').get().n,0);second.db.close();
 }finally{globalThis.fetch=previous;}
});
test('uncertain Dodo checkout creation never blindly creates a second session',async()=>{
 const previous=globalThis.fetch,db=createD1(),user=await seedUser(db),id=crypto.randomUUID(),state={calls:[],payment:{}};try{
  const mock=providerMock(state);let creates=0;globalThis.fetch=async(url,init)=>{if(new URL(String(url)).pathname==='/checkouts'){creates++;throw Error('lost response');}return mock(url,init);};
  await assert.rejects(createTopup(db,env,input,user,id),/checkout_recovering/);await assert.rejects(createTopup(db,env,input,user,id),/checkout_review/);assert.equal(creates,1);assert.equal(wallet(db,user).balance,0);
 }finally{db.close();globalThis.fetch=previous;}
});
