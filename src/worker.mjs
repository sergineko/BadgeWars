import {catalog,badgeSvg} from '../public/badges.js';
import {verifyChallenge,validCheckout} from './security.mjs';
import {settle,quote} from './settlement.mjs';
import {authRoute,identity,privateJson,siteReturn,hash} from './auth.mjs';
import {normalizedBadgeUrl} from './badge-url.mjs';
import {primary,first,rows,run,throttle} from './db.mjs';
import {uuid,collectionPage} from './collection.mjs';
import {publicEntry,inventoryEntry,privateSupporters,setVisibility} from './inventory.mjs';
import {closeDueSeasons} from './seasons.mjs';
import {personalEmbed} from './embed.mjs';
import {trustState} from './trust-state.mjs';
import {publish,publishDirty} from './projection.mjs';
import {createTopup,receiveEvent,processEvents,recoverTopups,TERMS_VERSION,paymentsReady,billingPortalUrl,billingAccounts,unwrapWebhook,paymentEnvironment} from './billing.mjs';
import {termsDocument,operatorDetails,paymentSeller} from '../public/terms.js';
import {requestDeliveryRefund} from './refunds.mjs';
import {emailRoute} from './email-auth.mjs';
import {legalPage} from './legal-page.mjs';
import {suspendedBadgeSvg} from '../public/badge-status.js';
import {runtime,recordIncident,operationalStatus,operationSignals,notifyOperations,serviceHealth} from './operations.mjs';
import {monitorQuota} from './quota.mjs';
import {readAlias,changeAlias,aliasProfile} from './public-alias.mjs';
const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
async function readBody(request,limit){
 if(Number(request.headers.get('Content-Length')||0)>limit)throw Error('body_too_large');
 const reader=request.body?.getReader();if(!reader)return '';
 const chunks=[];let size=0;
 for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw Error('body_too_large');}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return new TextDecoder().decode(bytes);
}
async function readInput(request){
 const raw=await readBody(request,8192);
 const value=JSON.parse(raw);if(!value||typeof value!=='object'||Array.isArray(value))throw Error('invalid_request');return value;
}
function imageResponse(response,request,personal=false){
 // Internal render caching remains useful, but a personal image must pass the
 // primary payment/status check again on every request, including conditional GET.
 if(personal){const headers=new Headers(response.headers);headers.set('Cache-Control','no-store');headers.set('X-Badge-Status','active');headers.set('Access-Control-Expose-Headers','X-Badge-Status, ETag');response=new Response(response.body,{status:response.status,headers});}
 const tag=response.headers.get('ETag');
 if(tag&&request.headers.get('If-None-Match')?.split(',').map(s=>s.trim()).some(value=>value===tag||value==='*'))return new Response(null,{status:304,headers:response.headers});
 return request.method==='HEAD'?new Response(null,{status:response.status,headers:response.headers}):response;
}
async function snapshot(env){
 const states={};for(const b of catalog){const state=await env.BADGES.get(`badge:${b.id}`,'json');if(!state)throw Error('Projection not initialized');states[b.id]=state;}
 const rankings=catalog.flatMap(b=>(states[b.id].entries||[]).map(p=>publicEntry({...p,badge:b.name,badgeId:b.id})));
 return {demo:false,states:Object.fromEntries(Object.entries(states).map(([id,{entries,...value}])=>[id,{...value,...(['genesis','funded'].includes(id)?{owner:null}:{}),claims:entries.map(entry=>publicEntry(entry))}])),rankings};
}
async function svg(request,env,ctx){
 const url=normalizedBadgeUrl(request.url);if(!url)return json({error:'invalid_parameters'},400);
 const id=url.pathname.split('/').pop().replace('.svg','');
 if(!catalog.some(b=>b.id===id))return json({error:'badge_not_found'},404);
 if([...url.searchParams.keys()].some(k=>!['style','claim','lang'].includes(k))||[...url.searchParams.keys()].some(k=>url.searchParams.getAll(k).length>1)||(url.searchParams.has('style')&&url.searchParams.get('style')!=='compact')||(url.searchParams.has('lang')&&!['es','en'].includes(url.searchParams.get('lang'))))return json({error:'invalid_parameters'},400);
 const claim=url.searchParams.get('claim');if(url.searchParams.has('claim')&&!uuid(claim))return json({error:'invalid_purchase'},400);
 const compact=url.searchParams.get('style')==='compact',locale=url.searchParams.get('lang')||'en';
 let personalState=null,personalAlias=null;
 if(claim){
  if(!env.DB)return json({error:'badge_status_unavailable'},503);
  let eligibility;
  try{
   if(['flex','funded'].includes(id)){
    eligibility=await inventoryEntry(primary(env),claim);
    if(eligibility?.seasonEndsAt&&eligibility.seasonStatus==='open'&&Date.parse(eligibility.seasonEndsAt)<=Date.now()){await closeDueSeasons(primary(env));eligibility=await inventoryEntry(primary(env),claim);}
    if(eligibility?.badgeId!==id)eligibility=null;
    if(eligibility){personalState=publicEntry(eligibility);personalState.revision=[personalState.updated_at,personalState.amount,personalState.owner,personalState.rank,personalState.seasonId,personalState.seasonStatus,personalState.showSeason].join(':');}
   }else eligibility=await first(primary(env),'SELECT b.status,w.frozen,w.debt,coalesce(a.public_alias,b.owner) AS owner FROM bw_user_badges b JOIN bw_users a ON a.id=b.user_id JOIN bw_wallets w ON w.user_id=b.user_id WHERE b.id=? AND b.badge=?',[claim,id]);
   personalAlias=eligibility?.owner||null;
  }
  catch{return json({error:'badge_status_unavailable'},503);}
  if(!eligibility)return json({error:'purchase_not_found'},404);
  if(eligibility.status!=='active'||eligibility.frozen||eligibility.debt>0){
   // img elements need a successful image response to display the inactive card.
   // No owner, score or rank is served, and no cached active render is consulted.
   return new Response(request.method==='HEAD'?null:suspendedBadgeSvg(env.APP_URL||url.origin,locale,compact),{headers:{'Content-Type':'image/svg+xml; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'*','Access-Control-Expose-Headers':'X-Badge-Status','Content-Language':locale,'X-Badge-Status':'suspended','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; sandbox allow-top-navigation-by-user-activation"}});
  }
 }
 const keyUrl=new URL(`${url.origin}/badges/${id}.svg`);if(compact)keyUrl.searchParams.set('style','compact');if(claim)keyUrl.searchParams.set('claim',claim);if(locale!=='en')keyUrl.searchParams.set('lang',locale);
 let state=personalState||(id==='quality'?await trustState(request,env,ctx):null);
 if(id==='quality'&&!state)return json({error:'projection_pending'},503);
 keyUrl.searchParams.set('render','8');if(claim&&personalAlias)keyUrl.searchParams.set('alias',personalAlias);if(state)keyUrl.searchParams.set('revision',String(personalState?[state.updated_at,state.owner,state.rank,state.seasonId,state.seasonStatus].join(':'):state.revision));
 const key=new Request(keyUrl),cached=await caches.default.match(key);if(cached)return imageResponse(cached,request,Boolean(claim));
 if(!state)state=await env.BADGES.get(`badge:${id}`,'json');if(!state)return json({error:'projection_pending'},503);
 if(claim&&!personalState){const index=state.entries.findIndex(p=>p.id===claim||p.aliases?.includes(claim));if(index===-1)return json({error:'purchase_not_found'},404);state={...publicEntry(state.entries[index]),revision:state.revision};}
 else if(['genesis','funded'].includes(id)&&!claim)state={...state,owner:null};
 if(claim&&personalAlias)state={...state,owner:personalAlias};
 const response=new Response(badgeSvg(id,state,compact,locale),{headers:{'Content-Type':'image/svg+xml; charset=utf-8','Cache-Control':`public, max-age=0, s-maxage=${id==='quality'?15:300}, must-revalidate`,'Access-Control-Allow-Origin':'*','X-Content-Type-Options':'nosniff','Content-Language':locale,'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; sandbox",'ETag':`W/"v7-${id}-${state.id||'arena'}-${state.revision}-${compact}-${state.rank||0}-${locale}-${claim?personalAlias||'':''}"`}});
 ctx.waitUntil(caches.default.put(key,response.clone()));return imageResponse(response,request,Boolean(claim));
}
async function privateRoute(request,env,ctx){
 const url=new URL(request.url),auth=await identity(request,env);if(!auth.user)return privateJson({error:'authentication_required'},401,auth.cookies);
 const db=primary(env),userId=auth.user.id,reply=(value,status=200)=>privateJson(value,status,auth.cookies);
 if(request.method==='POST'&&request.headers.get('Origin')!==new URL(env.APP_URL).origin)return reply({error:'origin_forbidden'},403);
 if(url.pathname==='/api/me/profile'){
  if(request.method==='GET')return reply(await readAlias(db,userId));
  if(!await throttle(db,'alias:'+userId,20,3600))return reply({error:'rate_limited'},429);
  const input=await readInput(request),result=await changeAlias(db,userId,input.alias);
  if(result.error)return reply({error:result.error,...(result.profile?{profile:result.profile}:{})},result.status);
  ctx.waitUntil(publishDirty(db,env).catch(()=>{}));return reply(result.profile);
 }
 if(url.pathname==='/api/me/badges')return reply({...await collectionPage(db,userId),profile:aliasProfile(auth.user)});
 if(url.pathname==='/api/me/wallet')return reply({...await first(db,'SELECT balance,frozen,debt FROM bw_wallets WHERE user_id=?',[userId]),termsVersion:TERMS_VERSION,paymentsAvailable:paymentsReady(env),provider:'dodo',environment:paymentEnvironment(env)});
 if(url.pathname==='/api/me/refund-request'&&request.method==='POST'){
  if(!await throttle(db,'refund:'+userId,5,3600))return reply({error:'rate_limited'},429);
  const input=await readInput(request);return reply(await requestDeliveryRefund(db,env,userId,input.topupId));
 }
 if(url.pathname==='/api/me/billing-portal'&&request.method==='POST'){
  if(!await throttle(db,'portal:'+userId,20))return reply({error:'rate_limited'},429);
  const input=request.body?await readInput(request):{},accounts=await billingAccounts(db,env,userId);
  if(!input.customerId&&accounts.length>1)return reply({accounts});
  const portal=await billingPortalUrl(db,env,userId,input.customerId||accounts[0]?.customer_id);return reply(portal?{url:portal}:{error:'billing_unavailable'},portal?200:503);
 }
 if(url.pathname.startsWith('/api/me/action-confirmation/')){
  const id=url.pathname.split('/').pop();if(!uuid(id))return reply({error:'invalid_request'},400);
  const action=await first(db,'SELECT a.id,a.badge,a.kind,a.level,a.cost,a.created_at,a.terms_version,a.execution_requested,a.withdrawal_acknowledged,coalesce(a.season_id,u.season_id) AS seasonId,t.document FROM bw_actions a JOIN bw_terms_documents t ON t.version=a.terms_version AND t.locale=a.terms_locale LEFT JOIN bw_user_badges u ON u.id=a.holder_id WHERE a.id=? AND a.user_id=?',[id,userId]);if(!action)return reply({error:'not_found'},404);
  const result=reply({...action,document:JSON.parse(action.document)});result.headers.set('Content-Disposition',`attachment; filename="badgewars-action-${id}.json"`);return result;
 }
 if(url.pathname.startsWith('/api/me/confirmation/')){
  const id=url.pathname.split('/').pop();if(!uuid(id))return reply({error:'invalid_request'},400);
  const topup=await first(db,'SELECT id,credits,currency,pricing_model,state,created_at,terms_version,terms_snapshot,immediate_delivery,adult_confirmed FROM bw_topups WHERE id=? AND user_id=?',[id,userId]);if(!topup)return reply({error:'not_found'},404);
  const charge=await first(db,'SELECT charged_currency AS currency,charged_total AS total_minor_units,charged_tax AS tax_minor_units FROM bw_orders WHERE topup_id=? AND user_id=?',[id,userId]);
  const result=reply({...topup,isTaxInvoice:false,currencyRole:topup.pricing_model==='eur_fx_v1'?'base_reference':'fixed_price',charge:charge?.currency?charge:null,terms_snapshot:JSON.parse(topup.terms_snapshot)});result.headers.set('Content-Disposition',`attachment; filename="badgewars-confirmation-${id}.json"`);return result;
 }
 if(url.pathname==='/api/me/quote'){
  if(!catalog.some(b=>b.id===url.searchParams.get('badge')))return reply({error:'invalid_badge'},400);
  return reply(await quote(db,userId,url.searchParams.get('badge')));
 }
 if(url.pathname==='/api/me/embed'){
  if([...url.searchParams.keys()].some(k=>!['badge','style','lang','format'].includes(k)||url.searchParams.getAll(k).length>1))return reply({error:'invalid_parameters'},400);
  const id=url.searchParams.get('badge'),style=url.searchParams.get('style')||'',locale=url.searchParams.get('lang')||'en',format=url.searchParams.get('format')||'md';
  if(!uuid(id)||!['','compact'].includes(style)||!['es','en'].includes(locale)||!['md','html','html-safe'].includes(format))return reply({error:'invalid_parameters'},400);
  const result=await personalEmbed(db,userId,id,env.APP_URL,{style,locale,format});return reply(result||{error:'not_found'},result?200:404);
 }
 if(url.pathname==='/api/me/supporters'){
  const id=url.searchParams.get('badge');if(!uuid(id))return reply({error:'invalid_badge'},400);
  const result=await privateSupporters(db,userId,id,url.searchParams.get('page'));return reply(result||{error:'not_found'},result?200:404);
 }
 if(url.pathname==='/api/me/visibility'&&request.method==='POST'){
  const input=await readInput(request);if(!uuid(input.badge)||!Number.isInteger(input.count)||input.count<0||input.count>5)return reply({error:'invalid_visibility'},400);
  if(!await setVisibility(db,userId,input.badge,input.count))return reply({error:'not_found'},404);
  ctx.waitUntil(publish(db,env,'quality').catch(()=>{}));const holder=await privateSupporters(db,userId,input.badge);return reply({showTop:holder.showTop,topSupporters:holder.topSupporters});
 }
 if(url.pathname==='/api/me/checkout'){
  const id=url.searchParams.get('session');if(!uuid(id))return reply({error:'invalid_session'},400);
  const result=await first(db,'SELECT id AS reference,state AS status,credits,currency FROM bw_topups WHERE id=? AND user_id=?',[id,userId]);return reply(result||{error:'not_found'},result?200:404);
 }
 if(url.pathname==='/api/me/attempts')return reply({attempts:await rows(db,"SELECT id,'wallet' AS badge,credits*100 AS amount,currency,state,checkout_url FROM bw_topups WHERE user_id=? AND provider='dodo' AND environment=? AND state IN('open','creating','review') ORDER BY created_at DESC LIMIT 20",[userId,paymentEnvironment(env)])});
 if(url.pathname==='/api/wallet/topup'){
  if(!paymentsReady(env))return reply({error:'payments_unavailable'},503);
  if(!await throttle(db,'topup:'+userId,5))return reply({error:'rate_limited'},429);
  const input=await readInput(request);if(!await verifyChallenge(request,env,input.turnstileToken,userId))return reply({error:'challenge_failed'},403);
  return reply(await createTopup(db,env,input,userId,request.headers.get('Idempotency-Key')));
 }
 if(url.pathname==='/api/wallet/spend'||url.pathname==='/api/checkout'){
  if(!await throttle(db,'spend:'+userId,120))return reply({error:'rate_limited'},429);
  const input=await readInput(request),id=request.headers.get('Idempotency-Key');if(!uuid(id)||!validCheckout(input,catalog)||input.accepted!==true||input.executionRequested!==true||input.withdrawalAcknowledged!==true||input.termsVersion!==TERMS_VERSION)return reply({error:'invalid_request'},400);
  if(!auth.user.alias)return reply({error:'alias_required'},409);
  if(input.owner!==auth.user.alias)return reply({error:'alias_changed'},409);
  const result=await settle(db,catalog.find(b=>b.id===input.badge),{...input,userId},id,env);ctx.waitUntil(publish(db,env,input.badge).catch(()=>{}));return reply(result);
 }
 return reply({error:'not_found'},404);
}
export default {
 async fetch(request,env,ctx){
  const url=new URL(request.url),path=url.pathname;
  try{
   if(path==='/api/health'&&request.method==='GET')return serviceHealth(env);
   if(path==='/api/payments/status'&&request.method==='GET')return json({provider:'dodo',environment:paymentEnvironment(env),topupsEnabled:paymentsReady(env),minimumCredits:5,baseCurrency:'EUR',baseMinorUnitsPerCredit:100,billingCurrency:'adaptive'});
   // Recovery pauses financial delivery and public projections. Signed incoming
   // webhooks remain durable so they can be reconciled after recovery.
   if(env.MAINTENANCE_MODE==='true'&&(path.startsWith('/badges/')||path==='/api/arena'||(['/api/me/profile','/api/wallet/topup','/api/wallet/spend','/api/checkout','/api/me/refund-request'].includes(path)&&request.method==='POST')))return Response.json({error:'maintenance'},{status:503,headers:{'Cache-Control':'no-store','Retry-After':'300'}});
   if(path.startsWith('/api/auth/')){const response=await emailRoute(request,env)||await authRoute(request,env);if(response)return response;}
   if(path==='/api/legal'&&request.method==='GET')return json({version:TERMS_VERSION,operator:operatorDetails(env),merchantOfRecord:paymentSeller});
   if(['/api/legal/terms/es.txt','/api/legal/terms/en.txt'].includes(path)&&request.method==='GET'){
    const locale=path.endsWith('/en.txt')?'en':'es',doc=termsDocument(env,locale),text=[`BadgeWars — ${doc.version}`,JSON.stringify({operator:doc.operator,merchantOfRecord:doc.merchantOfRecord},null,2),...doc.sections.flatMap(s=>[s.title,s.text,''])].join('\n');
    return new Response(text,{headers:{'Content-Type':'text/plain; charset=utf-8','Content-Disposition':`attachment; filename="badgewars-terms-${locale}-${TERMS_VERSION}.txt"`,'Cache-Control':'no-store'}});
   }
   if(path==='/api/checkout/return'&&request.method==='GET'){
    if(!uuid(url.searchParams.get('topup'))&&url.searchParams.get('status')!=='cancel')return json({error:'invalid_session'},400);
    return await siteReturn({checkout:url.searchParams.get('status')==='cancel'?'cancel':url.searchParams.get('topup'),locale:url.searchParams.get('lang')},env);
   }
   const badgeLink=path.match(/^\/b\/([^/]+)$/);
   if(badgeLink&&['GET','HEAD'].includes(request.method)){
    if(!uuid(badgeLink[1]))return json({error:'badge_not_found'},404);
    if(!env.DB)return json({error:'badge_status_unavailable'},503);
    const row=await first(primary(env),'SELECT b.badge,b.status,b.season_id,w.frozen,w.debt,(SELECT count(*)>1 FROM bw_flex_seasons) AS show_season FROM bw_user_badges b JOIN bw_wallets w ON w.user_id=b.user_id WHERE b.id=?',[badgeLink[1]]);
    if(!row)return json({error:'badge_not_found'},404);
    const paused=row.status!=='active'||row.frozen||row.debt>0;
    const destination=paused?'/collection':row.badge==='quality'?'/support/'+badgeLink[1]:row.badge==='flex'?'/leaderboard/flex'+(row.show_season?'/'+row.season_id:''):row.badge==='funded'?'/leaderboard/funded':'/badge/'+row.badge;
    return new Response(null,{status:302,headers:{Location:new URL(destination,env.APP_URL).href,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
   }
   if(path==='/api/dodo/webhook'&&request.method==='POST'){
    const body=await readBody(request,65536);
    let event;try{event=await unwrapWebhook(body,request.headers,env);}catch{return json({error:'invalid_signature'},403);}
    const db=primary(env);await receiveEvent(db,env,event,request.headers.get('webhook-id'));if(env.MAINTENANCE_MODE!=='true')ctx.waitUntil(processEvents(db,env).catch(()=>{console.error('BadgeWars webhook reconciliation failed');}));return json({received:true},202);
   }
   if((path.startsWith('/api/me/')&&request.method==='GET')||(['/api/me/profile','/api/me/visibility','/api/me/refund-request','/api/me/billing-portal','/api/wallet/topup','/api/wallet/spend','/api/checkout'].includes(path)&&request.method==='POST')){
    if(!env.DB)return json({error:'database_unavailable'},503);return await privateRoute(request,env,ctx);
   }
   if(path==='/api/support/target'&&request.method==='GET'){
    const id=url.searchParams.get('badge');if(!uuid(id))return json({error:'invalid_badge'},400);
    const state=await env.BADGES?.get('badge:quality','json');if(!state)return json({error:'projection_pending'},503);
    const target=state.entries.find(p=>p.id===id||p.aliases?.includes(id));return json(target?publicEntry(target):{error:'not_found'},target?200:404);
   }
   if(path==='/api/arena'&&request.method==='GET'){
    if(!env.BADGES)return json({error:'arena_unavailable'},503);
    const key=new Request(new URL('/api/arena',request.url)),cached=await caches.default.match(key);if(cached)return cached;
    const response=Response.json(await snapshot(env),{headers:{'Cache-Control':'public, max-age=0, s-maxage=15'}});ctx.waitUntil(caches.default.put(key,response.clone()));return response;
   }
   if(path.startsWith('/badges/')&&path.endsWith('.svg')&&request.method==='OPTIONS')return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, HEAD, OPTIONS','Access-Control-Allow-Headers':'If-None-Match','Access-Control-Max-Age':'86400'}});
   if(path.startsWith('/badges/')&&path.endsWith('.svg')&&['GET','HEAD'].includes(request.method))return await svg(request,env,ctx);
   if(path.startsWith('/api/')||path.startsWith('/badges/'))return json({error:'not_found'},404);
   if(['GET','HEAD'].includes(request.method)){const document=await legalPage(request,env);if(document)return document;}
   return env.ASSETS.fetch(request);
  }catch(error){
   if(error.message==='refund_not_found')return privateJson({error:error.message},404);
   if(/^refund_/.test(error.message))return privateJson({error:error.message},409);
   if(error.message==='body_too_large')return privateJson({error:'body_too_large'},413);
   const code=['alias_changed','season_closed','invalid_season','insufficient_credits','price_changed','genesis_sold_out','already_owned_or_invalid_price','invalid_support','wallet_frozen_or_invalid','idempotency_conflict','invalid_topup','invalid_request','checkout_recovering','checkout_open','checkout_accepted','checkout_review','checkout_expired','wallet_frozen','payments_unavailable'].find(code=>String(error.message).includes(code));
   if(code)return privateJson({error:code},code==='payments_unavailable'?503:code.startsWith('invalid')?400:409,error.cookies||[]);
   if(error instanceof SyntaxError)return json({error:'invalid_json'},400);
   console.error('BadgeWars operation failed',error.name);return privateJson({error:'operation_unavailable'},503,error.cookies||[]);
  }
 },
 async scheduled(event,env,ctx){ctx.waitUntil((async()=>{
  const db=primary(env);
  if(event.cron==='2,17,32,47 * * * *'){
   const status=await operationalStatus(db);await runtime(db,'operations',status);
   await notifyOperations(db,env,'incidencias',operationSignals(status));await monitorQuota(db,env);return;
  }
  const startedAt=Date.now(),failed=[],publication=event.cron==='1-59/5 * * * *';
  const jobs=publication?[['seasons',closeDueSeasons],['projections',publishDirty]]:[['webhooks',(db,env)=>processEvents(db,env,1)],['payments',(db,env)=>recoverTopups(db,env,{topups:1,orders:1})]];
  if(env.MAINTENANCE_MODE!=='true')for(const [name,job]of jobs)try{await job(db,env);}catch{
   failed.push(name);console.error('BadgeWars scheduled stage failed',name);await recordIncident(db,'scheduled_stage_failed',name).catch(()=>{});
  }
  await runtime(db,publication?'publisher':'scheduler',{startedAt,finishedAt:Date.now(),failed,maintenance:env.MAINTENANCE_MODE==='true'});
  const time=new Date(event.scheduledTime||Date.now());if(!publication&&time.getUTCHours()%6===0&&time.getUTCMinutes()<5){await run(db,'DELETE FROM bw_sessions WHERE expires<?',[Date.now()]);await run(db,'DELETE FROM bw_oauth_states WHERE expires<?',[Date.now()]);await run(db,'DELETE FROM bw_throttle WHERE expires<?',[Math.floor(Date.now()/1000)-86400]);await run(db,'DELETE FROM bw_email_codes WHERE expires<?',[Date.now()]);await run(db,'DELETE FROM bw_email_accounts WHERE verified=0 AND created_at<?',[Date.now()-604800000]);}
 })());}
};
