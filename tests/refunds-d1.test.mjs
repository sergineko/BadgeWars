import test from 'node:test';
import assert from 'node:assert/strict';
import {seedUser,consent} from './helpers/d1.mjs';
import {fixture,env,paymentId,providerMock} from './helpers/dodo.mjs';
import {reconcilePayment} from '../src/dodo.mjs';
import {requestDeliveryRefund,refundPolicy} from '../src/refunds.mjs';
import {settle} from '../src/settlement.mjs';
import {catalog} from '../public/badges.js';
test('paid uncredited Dodo topups reserve a review atomically; no automatic monetary refund',async()=>{
 const previous=globalThis.fetch,{db,user,id,state}=await fixture();try{
  const a=await requestDeliveryRefund(db,env,user,id),b=await requestDeliveryRefund(db,env,user,id);assert.deepEqual(a,b);assert.equal(a.status,'review');
  assert.equal(db.sqlite.prepare('SELECT balance FROM bw_wallets WHERE user_id=?').get(user).balance,0);assert.equal(db.sqlite.prepare('SELECT frozen FROM bw_wallets WHERE user_id=?').get(user).frozen,1);
  await assert.rejects(reconcilePayment(db,env,paymentId),/refund_review_pending/);
  await assert.rejects(settle(db,catalog[1],{...consent,userId:user,owner:'blocked',amount:500},crypto.randomUUID()),/wallet_frozen/);
  assert.equal(db.sqlite.prepare('SELECT count(*) n FROM bw_orders').get().n,0);assert.equal(state.calls.some(c=>c.path.startsWith('/refunds')),false);
  assert.throws(()=>db.sqlite.exec('UPDATE bw_refund_requests SET amount=1'),/immutable_refund_request/);
 }finally{db.close();globalThis.fetch=previous;}
});
test('credited or subsequently consumed topups cannot request a commercial refund even after replenishment',async()=>{
 const previous=globalThis.fetch,{db,user,id}=await fixture();try{
  await reconcilePayment(db,env,paymentId);await assert.rejects(requestDeliveryRefund(db,env,user,id),/refund_already_credited/);
  await settle(db,catalog[1],{...consent,userId:user,owner:'used_service',amount:500},crypto.randomUUID());
  await assert.rejects(requestDeliveryRefund(db,env,user,id),/refund_service_used/);
  await db.prepare("INSERT INTO bw_ledger(id,user_id,delta,kind,reference) VALUES(?,?,100,'topup',?)").bind(crypto.randomUUID(),user,crypto.randomUUID()).run();
  assert.equal((await refundPolicy(db,user,id)).reason,'refund_service_used');assert.equal(db.sqlite.prepare('SELECT count(*) n FROM bw_refund_requests').get().n,0);
 }finally{db.close();globalThis.fetch=previous;}
});
test('refund reservation rechecks consumption after the Dodo API lookup',async()=>{
 const previous=globalThis.fetch,{db,user,id,state}=await fixture();try{
  await db.prepare("INSERT INTO bw_ledger(id,user_id,delta,kind,reference) VALUES(?,?,10,'topup',?)").bind(crypto.randomUUID(),user,crypto.randomUUID()).run();
  const mock=providerMock(state);globalThis.fetch=async(url,init)=>{if(new URL(String(url)).pathname.startsWith('/payments/'))await settle(db,catalog[1],{...consent,userId:user,owner:'racer',amount:500},crypto.randomUUID());return mock(url,init);};
  await assert.rejects(requestDeliveryRefund(db,env,user,id),/refund_service_used/);assert.equal(db.sqlite.prepare('SELECT frozen FROM bw_wallets WHERE user_id=?').get(user).frozen,0);
 }finally{db.close();globalThis.fetch=previous;}
});
test('foreign ownership, debt and mismatched payments cannot approve a refund; prior refunds never mint credits',async()=>{
 const previous=globalThis.fetch,{db,user,id,state}=await fixture();try{
  const other=await seedUser(db);await assert.rejects(requestDeliveryRefund(db,env,other,id),/refund_not_found/);
  db.sqlite.prepare('UPDATE bw_wallets SET debt=1 WHERE user_id=?').run(user);await assert.rejects(requestDeliveryRefund(db,env,user,id),/refund_wallet_unavailable/);db.sqlite.prepare('UPDATE bw_wallets SET debt=0 WHERE user_id=?').run(user);
  state.payment.metadata.user_id=other;await assert.rejects(requestDeliveryRefund(db,env,user,id),/refund_payment_unverified/);state.payment.metadata.user_id=user;
  state.payment.refunds=[{refund_id:'ref_before',payment_id:paymentId,status:'succeeded',amount:1815,currency:'EUR'}];
  await reconcilePayment(db,env,paymentId);assert.equal(db.sqlite.prepare('SELECT balance FROM bw_wallets WHERE user_id=?').get(user).balance,0);assert.equal(db.sqlite.prepare('SELECT count(*) n FROM bw_orders').get().n,0);
 }finally{db.close();globalThis.fetch=previous;}
});
