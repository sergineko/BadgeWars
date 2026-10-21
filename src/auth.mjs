import {primary,first,run,statement,throttle} from './db.mjs';
import {syncAvatar} from './inventory.mjs';
import {uuid} from './collection.mjs';
import {profileImage} from '../public/profile.js';
import {emailReady} from './email-config.mjs';
import {aliasProfile} from './public-alias.mjs';
const encode=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const decode=text=>Uint8Array.from(atob(text.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
async function key(secret){return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',new TextEncoder().encode(secret)),{name:'AES-GCM'},false,['encrypt','decrypt']);}
export async function seal(value,secret){const iv=crypto.getRandomValues(new Uint8Array(12));const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(secret),new TextEncoder().encode(JSON.stringify(value)));return encode(iv)+'.'+encode(new Uint8Array(encrypted));}
export async function unseal(value,secret){try{const [iv,encrypted]=value.split('.');return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(iv)},await key(secret),decode(encrypted))));}catch{return null;}}
export const configured=env=>Boolean(env.DB&&env.AUTH_COOKIE_SECRET?.length>=32);
export const providers=env=>configured(env)?(env.AUTH_PROVIDERS||'').split(',').filter(p=>['google','github'].includes(p)&&env[p.toUpperCase()+'_CLIENT_ID']&&env[p.toUpperCase()+'_CLIENT_SECRET']):[];
export function cookie(name,value,env,age=2592000){return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${new URL(env.APP_URL).protocol==='https:'?'; Secure':''}`;}
function readCookie(request,name){return request.headers.get('Cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1);}
function privateHeaders(headers={}){return {'Cache-Control':'no-store','Vary':'Cookie',...headers};}
export function privateJson(value,status=200,cookies=[]){const response=Response.json(value,{status,headers:privateHeaders()});for(const c of cookies)response.headers.append('Set-Cookie',c);return response;}
export async function siteReturn(flow,env){
 const locale=flow.locale==='en'?'en':'es',checkout=uuid(flow.checkout)||flow.checkout==='cancel'?flow.checkout:null;
 const support=uuid(flow.support)?flow.support:null,badge=['flex','bait','funded','quality','genesis'].includes(flow.badge)?flow.badge:null;
 const path=flow.error?'/collection/sign-in-error':checkout&&checkout!=='cancel'?'/collection':support?`/support/${support}`:badge?`/badge/${badge}`:checkout==='cancel'?'/':'/collection';
 const response=new Response(null,{status:302,headers:privateHeaders({Location:new URL(path,env.APP_URL).href})});
 if(env.AUTH_COOKIE_SECRET?.length>=32)response.headers.append('Set-Cookie',cookie('bw_return',await seal({locale,checkout,expires:Date.now()+600000},env.AUTH_COOKIE_SECRET),env,600));
 return response;
}
export async function hash(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(b=>b.toString(16).padStart(2,'0')).join('');}
const random=()=>encode(crypto.getRandomValues(new Uint8Array(32)));
export async function identity(request,env){
 const token=readCookie(request,'bw_session');if(!token||!configured(env))return {user:null,cookies:[]};
 const user=await first(primary(env),'SELECT u.id,u.name,u.avatar_url AS avatarUrl,u.public_alias AS alias,u.alias_changed_at*1000 AS aliasChangedAt FROM bw_sessions s JOIN bw_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires>?',[await hash(token),Date.now()]);
 return {user:user?{...user,...aliasProfile(user)}:null,cookies:user?[]:[cookie('bw_session','',env,0)]};
}
async function providerProfile(provider,code,flow,env){
 const upper=provider.toUpperCase(),redirect=new URL('/api/auth/callback/'+provider,env.APP_URL).href;
 const endpoint=provider==='google'?'https://oauth2.googleapis.com/token':'https://github.com/login/oauth/access_token';
 const response=await fetch(endpoint,{method:'POST',signal:AbortSignal.timeout(8000),headers:{'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'},body:new URLSearchParams({client_id:env[upper+'_CLIENT_ID'],client_secret:env[upper+'_CLIENT_SECRET'],code,redirect_uri:redirect,code_verifier:flow.verifier,grant_type:'authorization_code'})});
 if(!response.ok)throw Error('oauth_unavailable');const tokens=await response.json();if(!tokens.access_token)throw Error('oauth_denied');
 const info=await fetch(provider==='google'?'https://openidconnect.googleapis.com/v1/userinfo':'https://api.github.com/user',{signal:AbortSignal.timeout(8000),headers:{Authorization:`Bearer ${tokens.access_token}`,Accept:'application/json','User-Agent':'BadgeWars'}});
 if(!info.ok)throw Error('oauth_profile_unavailable');const profile=await info.json();
 const subject=provider==='google'?profile.sub:String(profile.id||'');if(!subject||subject.length>255)throw Error('oauth_identity_invalid');
 return {subject,name:String(profile.name||profile.login||'Collector').slice(0,80),avatarUrl:profileImage(profile.picture||profile.avatar_url)};
}
export async function authRoute(request,env){
 const url=new URL(request.url),path=url.pathname;
 if(path==='/api/auth/config'&&request.method==='GET')return privateJson({providers:providers(env),emailAvailable:emailReady(env),turnstileSiteKey:env.TURNSTILE_SITE_KEY||null});
 if(path==='/api/auth/me'&&request.method==='GET'){
  const auth=await identity(request,env),raw=readCookie(request,'bw_return');let navigation=null;
  if(raw&&env.AUTH_COOKIE_SECRET?.length>=32){const value=await unseal(raw,env.AUTH_COOKIE_SECRET);if(value?.expires>Date.now())navigation={locale:value.locale==='en'?'en':'es',checkout:value.checkout};}
  if(raw)auth.cookies.push(cookie('bw_return','',env,0));return privateJson({user:auth.user,...(navigation?{navigation}:{})},200,auth.cookies);
 }
 if(path==='/api/auth/start'&&request.method==='GET'){
  const provider=url.searchParams.get('provider'),locale=url.searchParams.get('lang')==='en'?'en':'es';
  if(!providers(env).includes(provider))return siteReturn({locale,error:true},env);
  const db=primary(env);if(!await throttle(db,'oauth:'+await hash(request.headers.get('CF-Connecting-IP')||'unknown'),15))return privateJson({error:'rate_limited'},429);
  const state=random(),verifier=random(),challenge=encode(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
  await run(db,'INSERT INTO bw_oauth_states(state_hash,expires) VALUES(?,?)',[await hash(state),Date.now()+600000]);
  const flow={provider,state,verifier,locale,badge:['flex','bait','funded','quality','genesis'].includes(url.searchParams.get('badge'))?url.searchParams.get('badge'):null,support:uuid(url.searchParams.get('support'))?url.searchParams.get('support'):null,checkout:uuid(url.searchParams.get('checkout'))?url.searchParams.get('checkout'):null,expires:Date.now()+600000};
  const target=new URL(provider==='google'?'https://accounts.google.com/o/oauth2/v2/auth':'https://github.com/login/oauth/authorize');
  for(const [k,v] of Object.entries({client_id:env[provider.toUpperCase()+'_CLIENT_ID'],redirect_uri:new URL('/api/auth/callback/'+provider,env.APP_URL).href,state,scope:provider==='google'?'openid profile':'read:user',response_type:'code',code_challenge:challenge,code_challenge_method:'S256'}))target.searchParams.set(k,v);
  return new Response(null,{status:302,headers:privateHeaders({Location:target.href,'Set-Cookie':cookie('bw_oauth',await seal(flow,env.AUTH_COOKIE_SECRET),env,600)})});
 }
 if(path.startsWith('/api/auth/callback/')&&request.method==='GET'){
  const provider=path.split('/').pop();let flow=null;const cookies=[cookie('bw_oauth','',env,0)];
  if(configured(env))flow=await unseal(readCookie(request,'bw_oauth')||'',env.AUTH_COOKIE_SECRET);
  let failed=true;
  if(flow?.expires>Date.now()&&flow.provider===provider&&flow.state===url.searchParams.get('state')&&url.searchParams.get('code')&&providers(env).includes(provider)){
   const db=primary(env),state=await statement(db,'DELETE FROM bw_oauth_states WHERE state_hash=? AND expires>? RETURNING state_hash',[await hash(flow.state),Date.now()]).first();
   if(state)try{
    const profile=await providerProfile(provider,url.searchParams.get('code'),flow,env);
    await run(db,'INSERT INTO bw_users(id,provider,subject,name,avatar_url) VALUES(?,?,?,?,?) ON CONFLICT(provider,subject) DO UPDATE SET name=excluded.name',[crypto.randomUUID(),provider,profile.subject,profile.name,profile.avatarUrl]);
    const user=await first(db,'SELECT id FROM bw_users WHERE provider=? AND subject=?',[provider,profile.subject]);await syncAvatar(db,user.id,profile.avatarUrl);
    const token=random();await run(db,'INSERT INTO bw_sessions(token_hash,user_id,expires) VALUES(?,?,?)',[await hash(token),user.id,Date.now()+2592000000]);
    cookies.push(cookie('bw_session',token,env));failed=false;
   }catch{/* The state stays consumed; restarting login is safe. */}
  }
  const response=await siteReturn({...flow,error:failed},env);for(const value of cookies)response.headers.append('Set-Cookie',value);return response;
 }
 if(path==='/api/auth/logout'&&request.method==='POST'){
  if(request.headers.get('Origin')!==new URL(env.APP_URL).origin)return privateJson({error:'origin_forbidden'},403);
  const token=readCookie(request,'bw_session');if(token&&env.DB)await run(primary(env),'DELETE FROM bw_sessions WHERE token_hash=?',[await hash(token)]);
  return privateJson({ok:true},200,[cookie('bw_session','',env,0)]);
 }
 return null;
}
