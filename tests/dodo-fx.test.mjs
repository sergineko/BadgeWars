import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,env,product,paymentId,makePayment} from './helpers/dodo.mjs';
import {reconcilePayment,paymentsReady} from '../src/dodo.mjs';
const wallet=(db,user)=>db.sqlite.prepare('SELECT balance,debt,frozen FROM bw_wallets WHERE user_id=?').get(user);
const basis=(amount=1680,tax=0,currency='USD')=>({currency,items:[{items_id:product,amount,tax,refundable_amount:amount}]});

test('one EUR reference supports USD and zero-decimal JPY without equating their minor units to BC',async()=>{
 const previous=globalThis.fetch;
 try{for(const [currency,total] of [['USD',1686],['JPY',2772]]){
  const {db,user,state}=await fixture();try{
   state.payment.currency=currency;state.payment.total_amount=total;state.payment.tax=0;state.items=basis();
   await reconcilePayment(db,env,paymentId);await reconcilePayment(db,env,paymentId);
   assert.equal(wallet(db,user).balance,15);
   const order=db.sqlite.prepare('SELECT * FROM bw_orders').get();
   assert.equal(order.currency,'eur');assert.equal(order.amount,1500);
   assert.equal(order.charged_currency,currency);assert.equal(order.charged_total,total);
   assert.equal(order.refund_basis_currency,'USD');assert.equal(order.refund_basis_total,1680);
   state.payment.refund_status='partial';state.payment.refunds=[{refund_id:'ref_fx',status:'succeeded',payment_id:paymentId,amount:currency==='JPY'?1062:672,currency}];
   state.items.items[0].refundable_amount=1008;
   await reconcilePayment(db,env,paymentId);await reconcilePayment(db,env,paymentId);
   assert.equal(wallet(db,user).balance,9);assert.equal(wallet(db,user).frozen,1);
   assert.equal(db.sqlite.prepare('SELECT reversed FROM bw_orders').get().reversed,6);
   state.payment.refund_status='full';await reconcilePayment(db,env,paymentId);
   assert.equal(wallet(db,user).balance,0);
  }finally{db.close();}
 }}finally{globalThis.fetch=previous;}
});

test('FX checkout quantity, EUR base metadata, session and original charged totals stay bound to the purchase',async()=>{
 const previous=globalThis.fetch;
 try{for(const bad of ['base','session','amount','basis','currency']){
  const {db,user,state}=await fixture();try{
   state.payment.currency='USD';state.payment.total_amount=1686;state.payment.tax=0;state.items=basis();
   await reconcilePayment(db,env,paymentId);
   if(bad==='base')state.payment.metadata.base_amount='1';
   if(bad==='session')state.session={payment_id:'pay_foreign'};
   if(bad==='amount')state.payment.total_amount++;
   if(bad==='basis')state.items.items[0].amount++;
   if(bad==='currency')state.payment.currency='JPY';
   await assert.rejects(reconcilePayment(db,env,paymentId),/payment_mismatch/);
   assert.equal(wallet(db,user).balance,15);
  }finally{db.close();}
 }}finally{globalThis.fetch=previous;}
});

test('unknown refund currency freezes access without guessing a cross-currency credit reversal',async()=>{
 const previous=globalThis.fetch,{db,user,state}=await fixture();try{
  state.payment.currency='JPY';state.payment.total_amount=2772;state.payment.tax=0;state.items=basis();
  await reconcilePayment(db,env,paymentId);
  state.payment.refunds=[{status:'succeeded',payment_id:paymentId,amount:100,currency:'GBP'}];
  await assert.rejects(reconcilePayment(db,env,paymentId),/payment_mismatch/);
  assert.equal(wallet(db,user).balance,15);assert.equal(wallet(db,user).frozen,1);
 }finally{db.close();globalThis.fetch=previous;}
});

test('Dodo line-item amounts already include tax; a gross partial reversal never counts tax twice',async()=>{
 const previous=globalThis.fetch,{db,user,state}=await fixture();try{
  state.items=basis(1815,315,'EUR');await reconcilePayment(db,env,paymentId);
  state.payment.refund_status='partial';state.payment.refunds=[{status:'succeeded',payment_id:paymentId,amount:363,currency:'EUR'}];
  state.items.items[0].refundable_amount=1452;await reconcilePayment(db,env,paymentId);
  assert.equal(wallet(db,user).balance,12);
  assert.equal(db.sqlite.prepare('SELECT refund_basis_total FROM bw_orders').get().refund_basis_total,1815);
 }finally{db.close();globalThis.fetch=previous;}
});

test('a refund snapshot racing the payment response never mints BC or reverses a pending refund early',async()=>{
 const previous=globalThis.fetch;
 try{for(const pending of [false,true]){
  const {db,user,state}=await fixture();try{
   state.items=basis(1815,315,'EUR');
   if(pending){await reconcilePayment(db,env,paymentId);state.payment.refunds=[{status:'pending',payment_id:paymentId,amount:363,currency:'EUR'}];}
   state.items.items[0].refundable_amount=1452;await reconcilePayment(db,env,paymentId);
   assert.equal(wallet(db,user).balance,pending?15:0);assert.equal(wallet(db,user).frozen,1);
  }finally{db.close();}
 }}finally{globalThis.fetch=previous;}
});

test('USD product configuration is unnecessary and old fixed-currency receipts retain their original contract',async()=>{
 const previous=globalThis.fetch,{db,user,id,state}=await fixture();try{
  assert.equal(paymentsReady({...env,DODO_PRODUCT_ID_USD:undefined}),true);
  assert.throws(()=>db.sqlite.prepare("UPDATE bw_topups SET pricing_model='fixed' WHERE id=?").run(id),/immutable_topup_pricing/);
  const legacy=crypto.randomUUID();
  db.sqlite.prepare("INSERT INTO bw_topups(id,user_id,credits,currency,product_id,terms_version,provider,environment,checkout_id) VALUES(?,?,15,'usd',?,?,'dodo','test_mode',?)").run(legacy,user,product,'legacy-version','cks_legacySession');
  state.payment=makePayment(user,legacy,{currency:'USD',checkout_session_id:'cks_legacySession',metadata:{app:'badgewars',topup_id:legacy,user_id:user,credits:'15',terms_version:'legacy-version',environment:'test_mode'}});
  await reconcilePayment(db,env,paymentId);assert.equal(wallet(db,user).balance,15);
  assert.equal(db.sqlite.prepare('SELECT currency FROM bw_orders').get().currency,'usd');
  assert.equal(db.sqlite.prepare('SELECT pricing_model FROM bw_topups WHERE id=?').get(legacy).pricing_model,'fixed');
 }finally{db.close();globalThis.fetch=previous;}
});
