import DodoPayments from 'dodopayments';
import {first,rows,run,statement} from './db.mjs';
import {uuid} from './collection.mjs';
import {TERMS_VERSION,termsDocument,operatorReady} from '../public/terms.js';
import {recordIncident} from './operations.mjs';
export {TERMS_VERSION};
export const paymentEnvironment=env=>env.DODO_PAYMENTS_ENVIRONMENT==='live_mode'?'live_mode':'test_mode';
// Dashboard keys can be opaque, without a mode prefix. The explicit SDK endpoint
// and Dodo's authentication bind credentials to their environment.
export const apiKeyReady=(key,mode)=>configured(key)&&!(/^(?:dodo_test_|dodo_live_)/.test(key)&&!key.startsWith(mode==='live_mode'?'dodo_live_':'dodo_test_'));
export const providerId=(value,prefix)=>typeof value==='string'&&new RegExp(`^${prefix}_[A-Za-z0-9_-]{3,120}$`).test(value);
export const paymentEvents=Object.freeze(['payment.succeeded','payment.failed','payment.cancelled','payment.processing','refund.succeeded','refund.failed','dispute.opened','dispute.expired','dispute.accepted','dispute.cancelled','dispute.challenged','dispute.won','dispute.lost']);
const reference=(env,id)=>`dodo:${paymentEnvironment(env)}:${id}`;
const configured=value=>typeof value==='string'&&value.length>3&&!/replace|example|placeholder/i.test(value);
export function dodoClient(env){
 if(!['test_mode','live_mode'].includes(env.DODO_PAYMENTS_ENVIRONMENT))throw Error('payments_unavailable');
 return new DodoPayments({bearerToken:env.DODO_PAYMENTS_API_KEY,webhookKey:env.DODO_PAYMENTS_WEBHOOK_KEY,environment:paymentEnvironment(env),timeout:8000,maxRetries:0});
}
export function paymentsReady(env){
 const mode=paymentEnvironment(env),dummy=/^[123]x0+/.test(env.TURNSTILE_SITE_KEY||'')||/^[123]x0+/.test(env.TURNSTILE_SECRET_KEY||'');
 // Approval and installed credentials never open live checkout on their own.
 // Pausing new purchases must not stop webhooks, reconciliation or billing access.
 if(env.DODO_CHECKOUT_ENABLED!=='true'&&!(mode==='test_mode'&&env.DODO_CHECKOUT_ENABLED===undefined))return false;
 let local=false;try{local=['localhost','127.0.0.1','[::1]'].includes(new URL(env.APP_URL).hostname);}catch{}
 return Boolean(['test_mode','live_mode'].includes(env.DODO_PAYMENTS_ENVIRONMENT)&&apiKeyReady(env.DODO_PAYMENTS_API_KEY,mode)&&[env.DODO_BUSINESS_ID,env.DODO_PRODUCT_ID_EUR,env.TURNSTILE_SITE_KEY,env.TURNSTILE_SECRET_KEY].every(configured)&&providerId(env.DODO_BUSINESS_ID,'bus')&&providerId(env.DODO_PRODUCT_ID_EUR,'pdt')&&configured(env.DODO_PAYMENTS_WEBHOOK_KEY)&&env.TURNSTILE_SITE_KEY&&env.TURNSTILE_SECRET_KEY&&(!dummy||local&&mode==='test_mode')&&(mode!=='live_mode'||configured(env.DODO_LIVE_APPROVAL_REFERENCE)&&operatorReady(env)));
}
export function productMatches(product,env,currency){
 const price=product?.price;
 return Boolean(currency==='eur'&&product?.business_id===env.DODO_BUSINESS_ID&&product?.product_id===env.DODO_PRODUCT_ID_EUR&&!product.is_recurring&&product.pricing_mode==null&&price?.type==='one_time_price'&&price.price===100&&price.currency==='EUR'&&!price.pay_what_you_want&&!price.tax_inclusive&&!price.purchasing_power_parity&&!price.discount&&!price.discount_bps&&!product.credit_entitlements?.length);
}
const adaptive=row=>row.pricing_model==='eur_fx_v1';
export function checkoutForm(row,appUrl){return {
 product_cart:[{product_id:row.product_id,quantity:row.credits}],...(!adaptive(row)?{billing_currency:row.currency.toUpperCase()}:{}),
 ...(row.customer_id?{customer:{customer_id:row.customer_id}}:{}),
 feature_flags:{allow_currency_selection:adaptive(row),allow_discount_code:false,allow_phone_number_collection:false,allow_tax_id:true,always_create_new_customer:!row.customer_id,...(row.customer_id?{allow_customer_editing_email:false}:{})},
 customization:{theme:'dark',force_language:row.locale},
 metadata:{app:'badgewars',topup_id:row.id,user_id:row.user_id,credits:String(row.credits),terms_version:row.terms_version,environment:row.environment,...(adaptive(row)?{pricing_model:row.pricing_model,base_currency:'EUR',base_amount:String(row.credits*100)}:{})},
 return_url:`${appUrl}/api/checkout/return?topup=${row.id}&lang=${row.locale}`,
 cancel_url:`${appUrl}/api/checkout/return?status=cancel&lang=${row.locale}`
};}
export const incident=recordIncident;
async function freeze(db,row,kind,id){await db.batch([
 statement(db,'UPDATE bw_wallets SET frozen=1 WHERE user_id=?',[row.user_id]),
 statement(db,"UPDATE bw_topups SET state='review',checkout_url=NULL WHERE id=?",[row.id]),
 statement(db,"UPDATE bw_user_badges SET status='suspended' WHERE user_id=? OR id IN(SELECT holder_id FROM bw_contributors WHERE user_id=?)",[row.user_id,row.user_id]),
 statement(db,"UPDATE bw_badges SET dirty=1,revision=revision+1 WHERE id IN(SELECT badge FROM bw_user_badges WHERE user_id=? OR id IN(SELECT holder_id FROM bw_contributors WHERE user_id=?))",[row.user_id,row.user_id])
 ]);await incident(db,kind,id);}
export async function createTopup(db,env,input,userId,id){
 if(!paymentsReady(env))throw Error('payments_unavailable');
 if(!uuid(id)||!Number.isInteger(input.credits)||input.credits<5||input.credits>100000||![undefined,'auto','eur'].includes(input.currency)||input.accepted!==true||input.immediateDelivery!==true||input.adultConfirmed!==true||input.termsVersion!==TERMS_VERSION)throw Error('invalid_topup');
 if((await first(db,'SELECT frozen FROM bw_wallets WHERE user_id=?',[userId]))?.frozen)throw Error('wallet_frozen');
 const product=env.DODO_PRODUCT_ID_EUR,mode=paymentEnvironment(env);
 const inserted=await statement(db,`INSERT INTO bw_topups(id,user_id,credits,currency,product_id,locale,terms_version,next_check,terms_snapshot,immediate_delivery,adult_confirmed,provider,environment,pricing_model) VALUES(?,?,?,'eur',?,?,?,?,?,1,1,'dodo',?,'eur_fx_v1') ON CONFLICT(id) DO NOTHING RETURNING id`,[id,userId,input.credits,product,input.locale==='en'?'en':'es',TERMS_VERSION,Date.now()+300000,JSON.stringify(termsDocument(env,input.locale)),mode]).first();
 const row=await first(db,'SELECT * FROM bw_topups WHERE id=?',[id]);
 if(row.user_id!==userId||row.credits!==input.credits||row.currency!=='eur'||row.product_id!==product||row.provider!=='dodo'||row.environment!==mode||!adaptive(row))throw Error('idempotency_conflict');
 if(!inserted){if(row.state==='open'&&row.checkout_url)return {url:row.checkout_url,id:row.id};throw Error(row.state==='creating'?'checkout_recovering':'checkout_'+row.state);}
 try{
  const client=dodoClient(env),catalogProduct=await client.products.retrieve(product);
  // One fixed EUR base product; only Dodo converts it to supported payment currencies.
  if(!productMatches(catalogProduct,env,row.currency))throw Error('invalid_product');
  const customer=await first(db,"SELECT customer_id FROM bw_payment_customers WHERE user_id=? AND provider='dodo' AND environment=? ORDER BY created_at DESC LIMIT 1",[userId,mode]);
  if(customer){row.customer_id=customer.customer_id;await run(db,'UPDATE bw_topups SET customer_id=? WHERE id=?',[row.customer_id,row.id]);}
  const checkout=await client.checkoutSessions.create(checkoutForm(row,env.APP_URL),{headers:{'Idempotency-Key':reference(env,row.id)}});
  const url=new URL(checkout.checkout_url),expected=mode==='live_mode'?'checkout.dodopayments.com':'test.checkout.dodopayments.com';
  if(!providerId(checkout.session_id,'cks')||url.protocol!=='https:'||url.hostname!==expected||url.username||url.password)throw Error('invalid_checkout');
  await run(db,"UPDATE bw_topups SET checkout_id=?,checkout_url=?,state=CASE WHEN state='accepted' THEN state ELSE 'open' END WHERE id=?",[checkout.session_id,checkout.checkout_url,row.id]);
  return {url:checkout.checkout_url,id:row.id};
 }catch{await run(db,"UPDATE bw_topups SET state='review' WHERE id=? AND state='creating'",[row.id]);await incident(db,'checkout_creation_uncertain',row.id);throw Error('checkout_recovering');}
}
export function paymentMatches(payment,row,env){
 const meta=payment.metadata,cart=payment.product_cart;
 if(!row||!Number.isSafeInteger(payment.total_amount)||payment.total_amount<=0||!Number.isSafeInteger(payment.tax??0)||(payment.tax??0)<0||(payment.tax??0)>payment.total_amount||!/^[A-Z]{3}$/.test(payment.currency||''))return false;
 // Foreign totals come from Dodo's authenticated payment, never a client FX rate.
 // Credit quantity is bound to our stored fixed-EUR cart and its server metadata.
 const priceMatches=adaptive(row)?row.currency==='eur'&&meta?.pricing_model===row.pricing_model&&meta.base_currency==='EUR'&&meta.base_amount===String(row.credits*100)&&(payment.currency!=='EUR'||payment.total_amount-(payment.tax??0)===row.credits*100):payment.currency===row.currency.toUpperCase()&&payment.total_amount-(payment.tax??0)===row.credits*100;
 return Boolean(priceMatches&&row.provider==='dodo'&&row.environment===paymentEnvironment(env)&&payment.business_id===env.DODO_BUSINESS_ID&&meta?.app==='badgewars'&&meta.topup_id===row.id&&meta.user_id===row.user_id&&meta.credits===String(row.credits)&&meta.terms_version===row.terms_version&&meta.environment===row.environment&&Array.isArray(cart)&&cart.length===1&&cart[0].product_id===row.product_id&&cart[0].quantity===row.credits&&!payment.discount_id&&(!payment.discounts||payment.discounts.length===0)&&!payment.subscription_id&&(!payment.subscription_ids||payment.subscription_ids.length===0)&&payment.is_multi_subscription!==true&&payment.is_update_payment_method!==true&&providerId(payment.payment_id,'pay')&&providerId(payment.checkout_session_id,'cks')&&providerId(payment.customer?.customer_id,'cus')&&(!row.customer_id||row.customer_id===payment.customer.customer_id)&&(!row.checkout_id||payment.checkout_session_id===row.checkout_id)&&Array.isArray(payment.refunds)&&Array.isArray(payment.disputes));
}
export async function verifiedPayment(db,env,row){
 if(row.provider!=='dodo'||row.environment!==paymentEnvironment(env)||!providerId(row.checkout_id,'cks'))throw Error('refund_payment_unverified');
 const client=dodoClient(env),session=await client.checkoutSessions.retrieve(row.checkout_id);
 if(session.id!==row.checkout_id||!providerId(session.payment_id,'pay'))throw Error('refund_payment_unverified');
 const payment=await client.payments.retrieve(session.payment_id);
 if(payment.payment_id!==session.payment_id||!paymentMatches(payment,row,env))throw Error('refund_payment_unverified');
 return payment;
}
export async function reconcilePayment(db,env,paymentId){
 if(!providerId(paymentId,'pay'))throw Error('invalid_event');
 const client=dodoClient(env),payment=await client.payments.retrieve(paymentId),meta=payment.metadata;
 if(meta?.app!=='badgewars')return;
 const row=uuid(meta.topup_id)?await first(db,'SELECT * FROM bw_topups WHERE id=?',[meta.topup_id]):null,key=reference(env,paymentId);
 if(payment.payment_id!==paymentId||!paymentMatches(payment,row,env)){await incident(db,'payment_mismatch',key);throw Error('payment_mismatch');}
 const existing=await first(db,'SELECT * FROM bw_orders WHERE id=?',[key]);
 if(existing?.charged_currency&&(existing.charged_currency!==payment.currency||existing.charged_total!==payment.total_amount||existing.charged_tax!==(payment.tax??0))){await freeze(db,row,'payment_changed_review',key);throw Error('payment_mismatch');}
 let refundCurrency=existing?.refund_basis_currency||payment.currency,refundTotal=existing?.refund_basis_total||payment.total_amount,refundRemaining=refundTotal;
 if(adaptive(row)&&payment.status==='succeeded'){
  const session=await client.checkoutSessions.retrieve(row.checkout_id);
  if(session.id!==row.checkout_id||session.payment_id!==paymentId){await freeze(db,row,'payment_session_review',key);throw Error('payment_mismatch');}
  const lineItems=await client.payments.retrieveLineItems(paymentId),item=lineItems.items?.[0];
  // Refunds use Dodo's line-item currency/basis, which may differ from the
  // customer's currency and excludes non-refundable FX fees and rounding.
  if(!/^[A-Z]{3}$/.test(lineItems.currency||'')||lineItems.items?.length!==1||item.items_id!==row.product_id||!Number.isSafeInteger(item.amount)||item.amount<=0||!Number.isSafeInteger(item.tax)||item.tax<0||item.tax>item.amount||!Number.isSafeInteger(item.refundable_amount)||item.refundable_amount<0||item.refundable_amount>item.amount){await freeze(db,row,'refund_basis_review',key);throw Error('payment_mismatch');}
  // Dodo's item amount already includes its tax; never add tax a second time.
  refundCurrency=lineItems.currency;refundTotal=item.amount;refundRemaining=item.refundable_amount;
  if(existing?.refund_basis_currency&&(existing.refund_basis_currency!==refundCurrency||existing.refund_basis_total!==refundTotal)){await freeze(db,row,'refund_basis_changed_review',key);throw Error('payment_mismatch');}
 }
 const unresolved=payment.disputes.some(d=>!['dispute_won','dispute_cancelled'].includes(d.dispute_status));
 const pending=payment.refunds.some(r=>['pending','review'].includes(r.status));
 if(unresolved||pending){await freeze(db,row,unresolved?'dispute_review':'pending_refund_review',key);if(!existing)return;}
 if(adaptive(row)&&pending)return;
 const fullRefund=payment.refund_status==='full';let refunded=fullRefund?refundTotal:0;
 for(const refund of payment.refunds){
  if(fullRefund)break;
  if(refund.status!=='succeeded')continue;
  if(!Number.isSafeInteger(refund.amount)||refund.amount<=0||!(adaptive(row)?[payment.currency,refundCurrency].includes(refund.currency):refund.currency===refundCurrency)||refund.payment_id!==paymentId){await freeze(db,row,'refund_amount_review',key);throw Error('payment_mismatch');}
  if(!adaptive(row))refunded+=refund.amount;
 }
 if(adaptive(row)&&!fullRefund){
  const successful=payment.refunds.some(r=>r.status==='succeeded');
  if(successful)refunded=refundTotal-refundRemaining;
  // Refund response currency can be the customer's currency at a later FX rate.
  // Only the remaining line-item balance measures the original units reversed.
  if(successful&&refunded<=0||!successful&&refundRemaining!==refundTotal){await freeze(db,row,'refund_snapshot_review',key);return;}
 }
 if(payment.refund_status==='partial'&&refunded===0){await freeze(db,row,'refund_amount_review',key);return;}
 if(!Number.isSafeInteger(refunded)||refunded>refundTotal){await freeze(db,row,'refund_amount_review',key);throw Error('payment_mismatch');}
 if(!existing&&(payment.status!=='succeeded'||refunded>0)){
  if(refunded>0)await freeze(db,row,'uncredited_refund',key);
  else if(!unresolved&&!pending){
   const state=['failed','cancelled'].includes(payment.status)?payment.status:'open';
   // A rejected attempt grants nothing. A later verified success in this same
   // checkout can still settle; never overwrite an accepted or reviewed top-up.
   await run(db,"UPDATE bw_topups SET state=? WHERE id=? AND state IN('creating','open','failed','cancelled') AND NOT EXISTS(SELECT 1 FROM bw_orders WHERE topup_id=?)",[state,row.id,row.id]);
  }
  return;
 }
 // Compare like currencies in integer minor units, including zero-decimal ones.
 // Preserve fractional BC for review and never round the reversal up.
 const netRefund=Number(BigInt(refunded)*BigInt(row.credits*100)/BigInt(refundTotal));
 const reversed=Math.min(row.credits,Math.floor(netRefund/100));
 await db.batch([
  statement(db,`INSERT INTO bw_orders(id,topup_id,user_id,credits,amount,currency,checkout_id,product_id,provider,environment,external_id,charged_currency,charged_total,charged_tax,refund_basis_currency,refund_basis_total) SELECT ?,?,?,?,?,?,?,?,'dodo',?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM bw_orders WHERE id=?)`,[key,row.id,row.user_id,row.credits,row.credits*100,row.currency,payment.checkout_session_id,row.product_id,row.environment,paymentId,payment.currency,payment.total_amount,payment.tax??0,refundCurrency,refundTotal,key]),
  statement(db,'UPDATE bw_orders SET reversed=max(reversed,?),refunded_amount=max(refunded_amount,?),next_check=? WHERE id=?',[reversed,netRefund,Date.now()+43200000,key]),
  statement(db,"INSERT INTO bw_payment_customers(user_id,provider,environment,customer_id) VALUES(?,'dodo',?,?) ON CONFLICT DO NOTHING",[row.user_id,row.environment,payment.customer.customer_id])
 ]);
 if(refunded>0&&netRefund===0)await freeze(db,row,'fractional_refund_review',key);
}
export async function unwrapWebhook(body,headers,env){
 const id=headers.get('webhook-id');if(!id||id.length>200||!env.DODO_PAYMENTS_WEBHOOK_KEY)throw Error('invalid_signature');
 const event=await dodoClient(env).webhooks.unwrap(body,{headers:Object.fromEntries(headers)});
 if(event.business_id!==env.DODO_BUSINESS_ID)throw Error('invalid_signature');
 return event;
}
export async function receiveEvent(db,env,event,eventId){
 if(!paymentEvents.includes(event.type))return false;
 const resource=event.data?.payment_id;
 if(event.business_id!==env.DODO_BUSINESS_ID||!providerId(resource,'pay')||!eventId||eventId.length>200)throw Error('invalid_event');
 await run(db,"INSERT INTO bw_webhooks(id,type,resource_id,provider,environment) VALUES(?,?,?,'dodo',?) ON CONFLICT(id) DO NOTHING",[reference(env,eventId),event.type,resource,paymentEnvironment(env)]);return true;
}
export async function processEvents(db,env,limit=2){
 if(!env.DODO_PAYMENTS_API_KEY)return;
 const events=await rows(db,"SELECT * FROM bw_webhooks WHERE provider='dodo' AND environment=? AND state IN('pending','processing') AND next_check<=? ORDER BY created_at LIMIT ?",[paymentEnvironment(env),Date.now(),limit]);
 for(const event of events){
  const claimed=await statement(db,"UPDATE bw_webhooks SET state='processing',next_check=? WHERE id=? AND state IN('pending','processing') AND next_check<=? RETURNING id",[Date.now()+120000,event.id,Date.now()]).first();if(!claimed)continue;
  try{await reconcilePayment(db,env,event.resource_id);await run(db,"UPDATE bw_webhooks SET state='complete' WHERE id=?",[event.id]);}
  catch{await run(db,"UPDATE bw_webhooks SET state=CASE WHEN attempts>=9 THEN 'review' ELSE 'pending' END,attempts=attempts+1,next_check=? WHERE id=?",[Date.now()+Math.min(3600000,30000*2**Math.min(7,event.attempts)),event.id]);if(event.attempts>=9)await incident(db,'webhook_review',event.resource_id);}
 }
}
export async function recoverTopups(db,env,{topups=4,orders=2}={}){
 if(!env.DODO_PAYMENTS_API_KEY)return;
 // Recheck rejected checkouts during their 24h retry window, even if a webhook
 // is lost. Keep their terminal status visible without polling them forever.
 for(const row of await rows(db,"SELECT * FROM bw_topups WHERE provider='dodo' AND environment=? AND (state='open' OR (state IN('failed','cancelled') AND created_at>strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 day'))) AND next_check<=? ORDER BY next_check,created_at LIMIT ?",[paymentEnvironment(env),Date.now(),topups]))try{
  const checkout=await dodoClient(env).checkoutSessions.retrieve(row.checkout_id);
  if(checkout.id!==row.checkout_id)throw Error('payment_mismatch');
  if(checkout.payment_id)await reconcilePayment(db,env,checkout.payment_id);
  // Session status has no expiry field. Close only unpaid sessions older than its documented 24h lifetime.
  const expired=!checkout.payment_id&&Date.now()-Date.parse(row.created_at)>86400000;
  await run(db,"UPDATE bw_topups SET next_check=?,errors=0,state=CASE WHEN state='accepted' OR state='review' THEN state WHEN ? THEN 'expired' ELSE state END WHERE id=?",[Date.now()+900000,expired?1:0,row.id]);
 }catch{await run(db,"UPDATE bw_topups SET errors=errors+1,next_check=?,state=CASE WHEN errors>=9 THEN 'review' ELSE state END WHERE id=?",[Date.now()+900000,row.id]);}
 await run(db,"UPDATE bw_topups SET state='review' WHERE provider='dodo' AND environment=? AND state='creating' AND created_at<strftime('%Y-%m-%dT%H:%M:%fZ','now','-5 minutes')",[paymentEnvironment(env)]);
 for(const order of await rows(db,"SELECT id,external_id FROM bw_orders WHERE provider='dodo' AND environment=? AND next_check<=? ORDER BY next_check LIMIT ?",[paymentEnvironment(env),Date.now(),orders]))try{await reconcilePayment(db,env,order.external_id);}catch{await run(db,'UPDATE bw_orders SET next_check=? WHERE id=?',[Date.now()+3600000,order.id]);await incident(db,'payment_recovery_review',order.id);}
}
export async function billingAccounts(db,env,userId){return rows(db,"SELECT customer_id,created_at FROM bw_payment_customers WHERE user_id=? AND provider='dodo' AND environment=? ORDER BY created_at DESC,customer_id",[userId,paymentEnvironment(env)]);}
export async function billingPortalUrl(db,env,userId,customerId){
 const customers=await billingAccounts(db,env,userId);
 if(!customers.length||!env.DODO_PAYMENTS_API_KEY)return null;
 if(!providerId(customerId,'cus')||!customers.some(c=>c.customer_id===customerId))return null;
 const portal=await dodoClient(env).customers.customerPortal.create(customerId,{send_email:false});
 const url=new URL(portal.link);
 if(url.protocol!=='https:'||url.hostname!==(paymentEnvironment(env)==='live_mode'?'customer.dodopayments.com':'test.customer.dodopayments.com')||url.username||url.password)throw Error('billing_unavailable');
 return portal.link;
}
