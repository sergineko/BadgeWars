import {createD1,seedUser} from './d1.mjs';
import {createTopup,TERMS_VERSION} from '../../src/dodo.mjs';
export const product='pdt_eurUnit',usdProduct='pdt_usdUnit',business='bus_testBusiness',checkout='cks_testSession',paymentId='pay_testPayment';
export const env={APP_URL:'https://badges.example',DODO_PAYMENTS_ENVIRONMENT:'test_mode',DODO_PAYMENTS_API_KEY:'dodo_test_local_verified_key',DODO_PAYMENTS_WEBHOOK_KEY:'whsec_bG9uZy1kb2RvLXRlc3Qtd2ViaG9vay1zZWNyZXQ=',DODO_BUSINESS_ID:business,DODO_PRODUCT_ID_USD:usdProduct,DODO_PRODUCT_ID_EUR:product,TURNSTILE_SITE_KEY:'configured-site',TURNSTILE_SECRET_KEY:'configured-secret'};
export const input={credits:15,currency:'eur',locale:'en',accepted:true,immediateDelivery:true,adultConfirmed:true,termsVersion:TERMS_VERSION};
export function makePayment(user,id,extra={}){return {business_id:business,payment_id:paymentId,status:'succeeded',checkout_session_id:checkout,total_amount:1815,tax:315,currency:'EUR',product_cart:[{product_id:product,quantity:15}],customer:{customer_id:'cus_testCustomer'},refunds:[],disputes:[],subscription_ids:[],metadata:{app:'badgewars',topup_id:id,user_id:user,credits:'15',terms_version:TERMS_VERSION,environment:'test_mode',pricing_model:'eur_fx_v1',base_currency:'EUR',base_amount:'1500'},...extra};}
export function providerMock(state){return async(url,init={})=>{
 const path=new URL(String(url)).pathname;state.calls.push({path,init});
 if(path.startsWith('/products/'))return Response.json({business_id:business,product_id:path.split('/').pop(),is_recurring:false,credit_entitlements:[],price:{type:'one_time_price',price:100,currency:path.endsWith(usdProduct)?'USD':'EUR',tax_inclusive:false,...state.price}});
 if(path==='/checkouts')return Response.json({session_id:checkout,checkout_url:'https://test.checkout.dodopayments.com/session/'+checkout});
 if(path.startsWith('/checkouts/'))return Response.json({id:checkout,payment_id:paymentId,payment_status:state.payment.status,...state.session});
 if(path.endsWith('/line-items'))return Response.json(state.items||{currency:state.payment.currency,items:[{items_id:product,amount:state.payment.total_amount,tax:state.payment.tax??0,refundable_amount:state.payment.refund_status==='full'?0:state.payment.total_amount-(state.payment.refunds||[]).filter(r=>r.status==='succeeded'&&r.currency===state.payment.currency).reduce((n,r)=>n+r.amount,0)}]});
 if(path.startsWith('/payments/'))return Response.json(state.payment);
 if(path.includes('/customer-portal/session'))return Response.json({link:'https://test.customer.dodopayments.com/session/owned'});
 throw Error('unexpected mocked request: '+path);
};}
export async function fixture(){const db=createD1(),user=await seedUser(db),id=crypto.randomUUID(),state={calls:[],payment:makePayment(user,id)};globalThis.fetch=providerMock(state);await createTopup(db,env,input,user,id);return {db,user,id,state};}
