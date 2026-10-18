import test from 'node:test';
import assert from 'node:assert/strict';
import {createD1,seedUser,consent} from './helpers/d1.mjs';
import {requestDeliveryRefund,refundPolicy} from '../src/refunds.mjs';
import {createTopup,reconcileOrder,TERMS_VERSION} from '../src/polar.mjs';
import {settle} from '../src/settlement.mjs';
import {catalog} from '../public/badges.js';
const product=crypto.randomUUID(),organization=crypto.randomUUID(),checkout=crypto.randomUUID(),orderId=crypto.randomUUID();
const env={APP_URL:'https://badges.example',POLAR_ENVIRONMENT:'sandbox',POLAR_ACCESS_TOKEN:'test',POLAR_PRODUCT_ID:product,POLAR_ORGANIZATION_ID:organization,TURNSTILE_SITE_KEY:'configured-site',TURNSTILE_SECRET_KEY:'configured-secret'};
async function fixture(){const db=createD1(),user=await seedUser(db),id=crypto.randomUUID();globalThis.fetch=async()=>Response.json({id:checkout,url:'https://sandbox.polar.sh/checkout/test'});await createTopup(db,env,{credits:15,currency:'eur',accepted:true,immediateDelivery:true,adultConfirmed:true,termsVersion:TERMS_VERSION},user,id);const order={id:orderId,checkout_id:checkout,paid:true,product_id:product,product:{organization_id:organization},currency:'eur',net_amount:1500,refunded_amount:0,discount_amount:0,applied_balance_amount:0,subscription_id:null,customer:{external_id:'bw:'+user},metadata:{app:'badgewars',topup_id:id,user_id:user,credits:15,terms_version:TERMS_VERSION}};globalThis.fetch=async url=>Response.json(String(url).includes('orders/?')?{items:[order]}:order);return {db,user,id,order};}

test('a paid but uncredited top-up can only reserve a review; spending and delivery cannot race it',async()=>{
 const previous=globalThis.fetch,{db,user,id,order}=await fixture();try{
  const a=await requestDeliveryRefund(db,env,user,id),b=await requestDeliveryRefund(db,env,user,id);assert.deepEqual(a,b);assert.equal(a.status,'review');
  assert.equal(db.sqlite.prepare('SELECT balance FROM bw_wallets WHERE user_id=?').get(user).balance,0);assert.equal(db.sqlite.prepare('SELECT frozen FROM bw_wallets WHERE user_id=?').get(user).frozen,1);
  await assert.rejects(reconcileOrder(db,env,order.id),/refund_review_pending/);
  await assert.rejects(settle(db,catalog[1],{...consent,userId:user,owner:'blocked',amount:500},crypto.randomUUID()),/wallet_frozen/);
  assert.equal(db.sqlite.prepare('SELECT count(*) AS n FROM bw_orders').get().n,0);
  assert.throws(()=>db.sqlite.exec("UPDATE bw_refund_requests SET amount=1"),/immutable_refund_request/);
 }finally{db.close();globalThis.fetch=previous;}
});
test('credited top-ups and later spending cannot request a commercial refund even after the balance is replenished',async()=>{
 const previous=globalThis.fetch,{db,user,id,order}=await fixture();try{
  await reconcileOrder(db,env,order.id);await assert.rejects(requestDeliveryRefund(db,env,user,id),/refund_already_credited/);
  await settle(db,catalog[1],{...consent,userId:user,owner:'used_service',amount:500},crypto.randomUUID());
  await assert.rejects(requestDeliveryRefund(db,env,user,id),/refund_service_used/);
  await db.prepare("INSERT INTO bw_ledger(id,user_id,delta,kind,reference) VALUES(?,?,100,'topup',?)").bind(crypto.randomUUID(),user,crypto.randomUUID()).run();
  assert.equal((await refundPolicy(db,user,id)).reason,'refund_service_used');assert.equal(db.sqlite.prepare('SELECT count(*) AS n FROM bw_refund_requests').get().n,0);
 }finally{db.close();globalThis.fetch=previous;}
});
test('the atomic reservation rechecks consumption and delivery after the provider lookup',async()=>{
 const previous=globalThis.fetch,{db,user,id,order}=await fixture();try{
  await db.prepare("INSERT INTO bw_ledger(id,user_id,delta,kind,reference) VALUES(?,?,10,'topup',?)").bind(crypto.randomUUID(),user,crypto.randomUUID()).run();
  globalThis.fetch=async url=>{if(String(url).includes('orders/?'))return Response.json({items:[order]});await settle(db,catalog[1],{...consent,userId:user,owner:'racer',amount:500},crypto.randomUUID());return Response.json(order);};
  await assert.rejects(requestDeliveryRefund(db,env,user,id),/refund_service_used/);assert.equal(db.sqlite.prepare('SELECT frozen FROM bw_wallets WHERE user_id=?').get(user).frozen,0);
 }finally{db.close();globalThis.fetch=previous;}
});
test('ownership, debt and provider mismatches cannot approve a request; a refund before delivery never mints credits',async()=>{
 const previous=globalThis.fetch,{db,user,id,order}=await fixture();try{
  const other=await seedUser(db);await assert.rejects(requestDeliveryRefund(db,env,other,id),/refund_not_found/);
  db.sqlite.prepare('UPDATE bw_wallets SET debt=1 WHERE user_id=?').run(user);await assert.rejects(requestDeliveryRefund(db,env,user,id),/refund_wallet_unavailable/);db.sqlite.prepare('UPDATE bw_wallets SET debt=0 WHERE user_id=?').run(user);
  order.customer.external_id='foreign';await assert.rejects(requestDeliveryRefund(db,env,user,id),/refund_payment_unverified/);order.customer.external_id='bw:'+user;order.refunded_amount=1500;
  await reconcileOrder(db,env,order.id);assert.equal(db.sqlite.prepare('SELECT balance FROM bw_wallets WHERE user_id=?').get(user).balance,0);assert.equal(db.sqlite.prepare('SELECT count(*) AS n FROM bw_orders').get().n,0);
 }finally{db.close();globalThis.fetch=previous;}
});
