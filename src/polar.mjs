import {first,rows,run,statement} from './db.mjs';
import {uuid} from './collection.mjs';
import {TERMS_VERSION,termsDocument,operatorReady} from '../public/terms.js';
export {TERMS_VERSION};
export const polarHost=env=>env.POLAR_ENVIRONMENT==='production'?'https://api.polar.sh':'https://sandbox-api.polar.sh';
export function billingPortalUrl(env){const slug=env.POLAR_ORGANIZATION_SLUG;if(!/^[a-z0-9][a-z0-9-]{0,62}$/.test(slug||''))return null;return `https://${env.POLAR_ENVIRONMENT==='production'?'polar.sh':'sandbox.polar.sh'}/${slug}/portal`;}
export function paymentsReady(env){const dummy=/^[123]x0+/.test(env.TURNSTILE_SITE_KEY||'')||/^[123]x0+/.test(env.TURNSTILE_SECRET_KEY||'');let local=false;try{local=['localhost','127.0.0.1','[::1]'].includes(new URL(env.APP_URL).hostname);}catch{}return Boolean(env.POLAR_ACCESS_TOKEN&&uuid(env.POLAR_PRODUCT_ID)&&uuid(env.POLAR_ORGANIZATION_ID)&&env.TURNSTILE_SITE_KEY&&env.TURNSTILE_SECRET_KEY&&(!dummy||env.POLAR_ENVIRONMENT==='sandbox'&&local)&&(env.POLAR_ENVIRONMENT!=='production'||env.POLAR_LIVE_APPROVAL_REFERENCE?.trim()&&operatorReady(env)));}
export async function polar(env,path,body){
 const response=await fetch(`${polarHost(env)}/v1/${path}`,{method:body?'POST':'GET',signal:AbortSignal.timeout(8000),headers:{Authorization:`Bearer ${env.POLAR_ACCESS_TOKEN}`,'Polar-Version':'2026-10','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 if(!response.ok)throw Error('provider_unavailable');return response.json();
}
export function checkoutForm(row,appUrl){return {products:[row.product_id],prices:{[row.product_id]:[{amount_type:'fixed',price_amount:row.credits*100,price_currency:row.currency,tax_behavior:'exclusive'}]},currency:row.currency,allow_discount_codes:false,external_customer_id:'bw:'+row.user_id,locale:row.locale,metadata:{app:'badgewars',topup_id:row.id,user_id:row.user_id,credits:row.credits,terms_version:row.terms_version},success_url:`${appUrl}/api/checkout/return?topup=${row.id}&lang=${row.locale}`,return_url:`${appUrl}/api/checkout/return?status=cancel&lang=${row.locale}`};}
export async function createTopup(db,env,input,userId,id){
 if(!paymentsReady(env))throw Error('payments_unavailable');
 if(!uuid(id)||!Number.isInteger(input.credits)||input.credits<5||input.credits>100000||!['usd','eur'].includes(input.currency)||input.accepted!==true||input.immediateDelivery!==true||input.adultConfirmed!==true||input.termsVersion!==TERMS_VERSION)throw Error('invalid_topup');
 const wallet=await first(db,'SELECT frozen FROM bw_wallets WHERE user_id=?',[userId]);if(wallet?.frozen)throw Error('wallet_frozen');
 const inserted=await statement(db,`INSERT INTO bw_topups(id,user_id,credits,currency,product_id,locale,terms_version,next_check,terms_snapshot,immediate_delivery,adult_confirmed) VALUES(?,?,?,?,?,?,?,?,?,1,1) ON CONFLICT(id) DO NOTHING RETURNING id`,[id,userId,input.credits,input.currency,env.POLAR_PRODUCT_ID,input.locale==='en'?'en':'es',TERMS_VERSION,Date.now()+300000,JSON.stringify(termsDocument(env,input.locale))]).first();
 const row=await first(db,'SELECT * FROM bw_topups WHERE id=?',[id]);
 if(row.user_id!==userId||row.credits!==input.credits||row.currency!==input.currency||row.product_id!==env.POLAR_PRODUCT_ID)throw Error('idempotency_conflict');
 if(!inserted){if(row.state==='open'&&row.checkout_url)return {url:row.checkout_url,id:row.id};throw Error(row.state==='creating'?'checkout_recovering':'checkout_'+row.state);}
 try{
  const checkout=await polar(env,'checkouts/',checkoutForm(row,env.APP_URL));
  const url=new URL(checkout.url),expected=env.POLAR_ENVIRONMENT==='production'?'polar.sh':'sandbox.polar.sh';
  if(!uuid(checkout.id)||url.protocol!=='https:'||url.hostname!==expected)throw Error('invalid_checkout');
  await run(db,`UPDATE bw_topups SET checkout_id=?,checkout_url=?,state=CASE WHEN state='accepted' THEN state ELSE 'open' END WHERE id=?`,[checkout.id,checkout.url,row.id]);
  return {url:checkout.url,id:row.id};
 }catch{await run(db,"UPDATE bw_topups SET state='review' WHERE id=? AND state='creating'",[row.id]);await incident(db,'checkout_creation_uncertain',row.id);throw Error('checkout_recovering');}
}
export async function incident(db,kind,reference){await run(db,'INSERT INTO bw_operations(id,kind,reference) VALUES(?,?,?) ON CONFLICT(kind,reference) DO NOTHING',[crypto.randomUUID(),kind,reference]);}
export function orderMatches(order,attempt,env){return Boolean(attempt&&Number.isSafeInteger(order.refunded_amount)&&order.refunded_amount>=0&&order.metadata?.app==='badgewars'&&order.metadata?.topup_id===attempt.id&&order.metadata.user_id===attempt.user_id&&Number(order.metadata.credits)===attempt.credits&&order.metadata.terms_version===attempt.terms_version&&order.product_id===attempt.product_id&&order.product?.organization_id===env.POLAR_ORGANIZATION_ID&&order.currency===attempt.currency&&order.net_amount===attempt.credits*100&&order.discount_amount===0&&!order.subscription_id&&order.applied_balance_amount===0&&order.customer?.external_id==='bw:'+attempt.user_id&&(!attempt.checkout_id||attempt.checkout_id===order.checkout_id)&&uuid(order.id)&&uuid(order.checkout_id));}
export async function reconcileOrder(db,env,orderId){
 const order=await polar(env,'orders/'+encodeURIComponent(orderId));
 if(order.metadata?.app!=='badgewars')return;
 const id=order.metadata.topup_id,attempt=uuid(id)?await first(db,'SELECT * FROM bw_topups WHERE id=?',[id]):null;
 if(order.id!==orderId||!orderMatches(order,attempt,env)){
  await incident(db,'payment_mismatch',orderId);throw Error('payment_mismatch');
 }
 if(!await first(db,'SELECT id FROM bw_orders WHERE id=?',[order.id])&&(order.paid!==true||order.refunded_amount>0)){
  if(order.refunded_amount>0){await run(db,"UPDATE bw_topups SET state='review',checkout_url=NULL WHERE id=?",[attempt.id]);await incident(db,'uncredited_refund',orderId);}return;
 }
 const reversed=Math.min(attempt.credits,Math.floor(order.refunded_amount/100));
 try{await db.batch([
  statement(db,`INSERT INTO bw_orders(id,topup_id,user_id,credits,amount,currency,checkout_id,product_id) SELECT ?,?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM bw_orders WHERE id=?)`,[order.id,attempt.id,attempt.user_id,attempt.credits,order.net_amount,order.currency,order.checkout_id,order.product_id,order.id]),
  statement(db,'UPDATE bw_orders SET reversed=max(reversed,?),refunded_amount=max(refunded_amount,?) WHERE id=?',[reversed,order.refunded_amount,order.id])
 ]);}catch(error){await incident(db,'order_reconciliation_failed',orderId);throw error;}
}
export async function receiveEvent(db,env,event,eventId){
 const orderEvents=['order.paid','order.updated','order.refunded'],refundEvents=['refund.created','refund.updated'];
 if(!orderEvents.includes(event.type)&&!refundEvents.includes(event.type))return false;
 const resource=orderEvents.includes(event.type)?event.data?.id:event.data?.order_id;if(!uuid(resource))throw Error('invalid_event');
 await run(db,'INSERT INTO bw_webhooks(id,type,resource_id) VALUES(?,?,?) ON CONFLICT(id) DO NOTHING',[eventId,event.type,resource]);return true;
}
export async function processEvents(db,env,limit=2){
 const events=await rows(db,"SELECT * FROM bw_webhooks WHERE state IN('pending','processing') AND next_check<=? ORDER BY created_at LIMIT ?",[Date.now(),limit]);
 for(const event of events){
  const claimed=await statement(db,"UPDATE bw_webhooks SET state='processing',next_check=? WHERE id=? AND state IN('pending','processing') AND next_check<=? RETURNING id",[Date.now()+120000,event.id,Date.now()]).first();if(!claimed)continue;
  try{await reconcileOrder(db,env,event.resource_id);await run(db,"UPDATE bw_webhooks SET state='complete' WHERE id=?",[event.id]);}
  catch{await run(db,"UPDATE bw_webhooks SET state=CASE WHEN attempts>=9 THEN 'review' ELSE 'pending' END,attempts=attempts+1,next_check=? WHERE id=?",[Date.now()+Math.min(3600000,30000*2**Math.min(7,event.attempts)),event.id]);if(event.attempts>=9)await incident(db,'webhook_review',event.resource_id);}
 }
}
export async function recoverTopups(db,env){
 if(!env.POLAR_ACCESS_TOKEN)return;
 for(const row of await rows(db,"SELECT * FROM bw_topups WHERE state='open' AND next_check<=? ORDER BY created_at LIMIT 4",[Date.now()]))try{
  const query=new URLSearchParams({checkout_id:row.checkout_id,limit:'10'}),orders=await polar(env,'orders/?'+query);
  for(const order of orders.items||[])await reconcileOrder(db,env,order.id);
  const checkout=await polar(env,'checkouts/'+row.checkout_id);
  await run(db,"UPDATE bw_topups SET next_check=?,errors=0,state=CASE WHEN state='accepted' THEN state WHEN ?='expired' THEN 'expired' ELSE state END WHERE id=?",[Date.now()+900000,checkout.status,row.id]);
 }catch{await run(db,"UPDATE bw_topups SET errors=errors+1,next_check=?,state=CASE WHEN errors>=9 THEN 'review' ELSE state END WHERE id=?",[Date.now()+900000,row.id]);}
 await run(db,"UPDATE bw_topups SET state='review' WHERE state='creating' AND created_at<strftime('%Y-%m-%dT%H:%M:%fZ','now','-5 minutes')");
}
