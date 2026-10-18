import test from 'node:test';
import assert from 'node:assert/strict';
import {createD1,seedUser,consent} from './helpers/d1.mjs';
import {createTopup,reconcileOrder,receiveEvent,processEvents,recoverTopups,paymentsReady,TERMS_VERSION} from '../src/polar.mjs';
import {settle} from '../src/settlement.mjs';
import {catalog} from '../public/badges.js';
const product='10000000-0000-4000-8000-000000000001',organization='10000000-0000-4000-8000-000000000002',checkout='10000000-0000-4000-8000-000000000003',orderId='10000000-0000-4000-8000-000000000004';
const env={APP_URL:'https://badges.example',POLAR_ACCESS_TOKEN:'sandbox-token',POLAR_PRODUCT_ID:product,POLAR_ORGANIZATION_ID:organization,POLAR_ENVIRONMENT:'sandbox',TURNSTILE_SITE_KEY:'test-site',TURNSTILE_SECRET_KEY:'test-secret'};
const input={credits:15,currency:'eur',locale:'en',accepted:true,immediateDelivery:true,adultConfirmed:true,termsVersion:TERMS_VERSION};
const topup=(db,user,id=crypto.randomUUID(),value=input)=>createTopup(db,env,value,user,id);
const providerCheckout=(id=checkout)=>Response.json({id,url:'https://sandbox.polar.sh/checkout/'+id});
const makeOrder=(user,topupId,extra={})=>({id:orderId,paid:true,net_amount:1500,total_amount:1815,tax_amount:315,refunded_amount:0,refunded_tax_amount:0,discount_amount:0,applied_balance_amount:0,currency:'eur',product_id:product,product:{organization_id:organization},subscription_id:null,checkout_id:checkout,customer:{external_id:'bw:'+user},metadata:{app:'badgewars',topup_id:topupId,user_id:user,credits:15,terms_version:TERMS_VERSION},...extra});
const wallet=(db,user)=>db.sqlite.prepare('SELECT * FROM bw_wallets WHERE user_id=?').get(user);

test('top-up requires separate consents, stores terms and uses fixed price; redirects never add credits',async()=>{
 const db=createD1(),original=globalThis.fetch;try{
  const user=await seedUser(db);let count=0;
  globalThis.fetch=async(url,init)=>{count++;assert.equal(String(url),'https://sandbox-api.polar.sh/v1/checkouts/');assert.equal(init.headers['Polar-Version'],'2026-10');const body=JSON.parse(init.body);assert.equal(body.prices[product][0].price_amount,1500);assert.equal(body.prices[product][0].amount_type,'fixed');assert.equal(body.allow_discount_codes,false);assert.ok(body.success_url.endsWith('&lang=en'));assert.equal(body.external_customer_id,'bw:'+user);return providerCheckout();};
  for(const bad of [{credits:4},{credits:5.5},{accepted:false},{immediateDelivery:false},{adultConfirmed:false},{termsVersion:'old'}])await assert.rejects(topup(db,user,undefined,{...input,...bad}),/invalid_topup/);
  const id=crypto.randomUUID();await topup(db,user,id);assert.equal(wallet(db,user).balance,0);await topup(db,user,id);assert.equal(count,1);await assert.rejects(topup(db,user,id,{...input,credits:16}),/idempotency_conflict/);
  const row=db.sqlite.prepare('SELECT * FROM bw_topups').get();assert.equal(row.state,'open');assert.equal(row.immediate_delivery,1);assert.equal(row.adult_confirmed,1);assert.equal(JSON.parse(row.terms_snapshot).operator.brand,'SergioTech.es');assert.ok(JSON.parse(row.terms_snapshot).sections.some(s=>s.title==='Top-up seller, invoices and receipts'));
  assert.equal(paymentsReady({...env,POLAR_ENVIRONMENT:'production'}),false);assert.equal(paymentsReady({...env,POLAR_ENVIRONMENT:'production',POLAR_LIVE_APPROVAL_REFERENCE:'documented approval'}),true);
 }finally{globalThis.fetch=original;db.close();}
});

test('uncertain checkout creation is recorded for review and never blindly recreated',async()=>{
 const db=createD1(),original=globalThis.fetch;try{const user=await seedUser(db),id=crypto.randomUUID();let calls=0;globalThis.fetch=async()=>{calls++;throw Error('response lost');};await assert.rejects(topup(db,user,id),/checkout_recovering/);await assert.rejects(topup(db,user,id),/checkout_review/);assert.equal(calls,1);assert.equal(db.sqlite.prepare('SELECT state FROM bw_topups').get().state,'review');assert.equal(wallet(db,user).balance,0);}finally{globalThis.fetch=original;db.close();}
});

test('only an authoritative matching paid order credits the single wallet once, including duplicate and out-of-order events',async()=>{
 const db=createD1(),original=globalThis.fetch;try{
  const user=await seedUser(db),id=crypto.randomUUID();globalThis.fetch=async()=>providerCheckout();await topup(db,user,id);let order=makeOrder(user,id,{paid:false});globalThis.fetch=async()=>Response.json(order);
  await reconcileOrder(db,env,orderId);assert.equal(wallet(db,user).balance,0);
  order.paid=true;await reconcileOrder(db,env,orderId);await reconcileOrder(db,env,orderId);assert.equal(wallet(db,user).balance,15);assert.equal(db.sqlite.prepare('SELECT count(*) AS n FROM bw_orders').get().n,1);
  for(const extra of [{currency:'usd'},{net_amount:1400},{product_id:crypto.randomUUID()},{discount_amount:100},{applied_balance_amount:100},{subscription_id:crypto.randomUUID()},{customer:{external_id:'bw:attacker'}},{refunded_amount:-1}]){order={...makeOrder(user,id),...extra};await assert.rejects(reconcileOrder(db,env,orderId),/payment_mismatch/);assert.equal(wallet(db,user).balance,15);}
  order=makeOrder(user,id);await receiveEvent(db,env,{type:'order.paid',data:{id:orderId}},'event_1');await receiveEvent(db,env,{type:'order.paid',data:{id:orderId}},'event_1');assert.equal(db.sqlite.prepare('SELECT count(*) AS n FROM bw_webhooks').get().n,1);await processEvents(db,env);assert.equal(db.sqlite.prepare('SELECT state FROM bw_webhooks').get().state,'complete');assert.equal(wallet(db,user).balance,15);
  assert.equal(await receiveEvent(db,env,{type:'checkout.created',data:{id:checkout}},'ignored'),false);
  order={metadata:{app:'another-project'}};await reconcileOrder(db,env,orderId);assert.equal(wallet(db,user).balance,15);
 }finally{globalThis.fetch=original;db.close();}
});

test('refunds reverse available credits once, freeze spent shortfalls and hide affected trust support pending review',async()=>{
 const db=createD1(),original=globalThis.fetch;try{
  const user=await seedUser(db),holder=await seedUser(db,{credits:20}),id=crypto.randomUUID();globalThis.fetch=async()=>providerCheckout();await topup(db,user,id);let order=makeOrder(user,id);globalThis.fetch=async()=>Response.json(order);await reconcileOrder(db,env,orderId);
  const quality=catalog.find(b=>b.id==='quality'),bag=await settle(db,quality,{...consent,userId:holder,amount:2000,owner:'bag'},crypto.randomUUID());await settle(db,quality,{...consent,userId:user,kind:'support',targetId:bag.holderId,owner:'supporter',amount:1000},crypto.randomUUID());assert.equal(wallet(db,user).balance,5);
  order.refunded_amount=1500;await reconcileOrder(db,env,orderId);await reconcileOrder(db,env,orderId);assert.equal(wallet(db,user).balance,0);assert.equal(wallet(db,user).debt,10);assert.equal(wallet(db,user).frozen,1);assert.equal(db.sqlite.prepare('SELECT status FROM bw_user_badges WHERE id=?').get(bag.holderId).status,'suspended');assert.equal(db.sqlite.prepare('SELECT points FROM bw_user_badges WHERE id=?').get(bag.holderId).points,'10');
  order.refunded_amount=500;await reconcileOrder(db,env,orderId);assert.equal(wallet(db,user).debt,10);assert.equal(db.sqlite.prepare('SELECT reversed FROM bw_orders').get().reversed,15);
  await assert.rejects(settle(db,catalog[1],{...consent,userId:user,amount:500,owner:'locked'},crypto.randomUUID()),/wallet_frozen/);
 }finally{globalThis.fetch=original;db.close();}
});

test('partial refunds use net amounts, preserve whole-credit rounding for the customer and remain visible for review',async()=>{
 const db=createD1(),original=globalThis.fetch;try{const user=await seedUser(db),id=crypto.randomUUID();globalThis.fetch=async()=>providerCheckout();await topup(db,user,id);let order=makeOrder(user,id);globalThis.fetch=async()=>Response.json(order);await reconcileOrder(db,env,orderId);order.refunded_amount=150;order.refunded_tax_amount=31;await reconcileOrder(db,env,orderId);assert.equal(wallet(db,user).balance,14);assert.equal(wallet(db,user).frozen,1);assert.equal(db.sqlite.prepare('SELECT refunded_amount FROM bw_orders').get().refunded_amount,150);assert.equal(db.sqlite.prepare("SELECT count(*) AS n FROM bw_operations WHERE kind='refund_review'").get().n,1);}finally{globalThis.fetch=original;db.close();}
});

test('cron recovers a paid order when the webhook is lost',async()=>{
 const db=createD1(),original=globalThis.fetch;try{const user=await seedUser(db),id=crypto.randomUUID();globalThis.fetch=async()=>providerCheckout();await topup(db,user,id);db.sqlite.exec('UPDATE bw_topups SET next_check=0');globalThis.fetch=async url=>String(url).includes('orders/?')?Response.json({items:[{id:orderId}]}):String(url).includes('orders/')?Response.json(makeOrder(user,id)):Response.json({status:'confirmed'});await recoverTopups(db,env);assert.equal(wallet(db,user).balance,15);assert.equal(db.sqlite.prepare('SELECT state FROM bw_topups').get().state,'accepted');}finally{globalThis.fetch=original;db.close();}
});
