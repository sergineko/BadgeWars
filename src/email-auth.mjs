import {primary,first,run,statement,throttle} from './db.mjs';
import {hash,cookie,privateJson} from './auth.mjs';
import {emailReady} from './email-config.mjs';
import {validPassword,passwordHash,passwordVerify} from './password.mjs';
import {verifyChallenge} from './security.mjs';
import {TERMS_VERSION} from '../public/terms.js';
const random=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
export const normalizedEmail=value=>typeof value==='string'&&value.length<=254&&/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(value.trim())?value.trim().toLowerCase():null;
async function input(request){
 if(!request.headers.get('Content-Type')?.startsWith('application/json'))throw Error('invalid_request');
 const reader=request.body?.getReader();let size=0,raw='';const decoder=new TextDecoder();
 if(reader)for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>8192){await reader.cancel();throw Error('body_too_large');}raw+=decoder.decode(value,{stream:true});}
 const value=JSON.parse(raw+decoder.decode());if(!value||Array.isArray(value)||typeof value!=='object')throw Error('invalid_request');return value;
}
async function sendCode(db,env,account,kind,locale){
 // Hard application budget below the included monthly allowance. Counts failed attempts too.
 if(!await throttle(db,'email:global:day',80,86400)||!await throttle(db,'email:global:month',2400,2678400))throw Error('rate_limited');
 const code=random(),digest=await hash(code),url=new URL('/account/email',env.APP_URL);
 // The fragment never reaches HTTP logs or Referer; the app consumes it and cleans the address.
 url.hash=(kind==='verify'?'verifyEmail':'resetPassword')+'/'+code;
 const es=locale!=='en',title=kind==='verify'?(es?'Verifica tu correo':'Verify your email'):(es?'Recupera tu cuenta':'Recover your account');
 const text=`BadgeWars — ${title}\n\n${es?'Abre este enlace en los próximos 30 minutos:':'Open this link within 30 minutes:'}\n${url.href}\n\n${kind==='verify'?(es?'Necesitarás la contraseña elegida durante el registro.':'You will need the password chosen during registration.') : ''}\n${es?'Si no lo has solicitado, ignora este mensaje. No compartas este enlace.':'If you did not request this, ignore this message. Do not share this link.'}`;
 const reserved=await db.batch([statement(db,'DELETE FROM bw_email_codes WHERE account_id=? AND kind=? AND EXISTS(SELECT 1 FROM bw_email_accounts WHERE id=? AND version=?)',[account.id,kind,account.id,account.version]),statement(db,'INSERT INTO bw_email_codes(token_hash,account_id,kind,version,expires) SELECT ?,id,?,version,? FROM bw_email_accounts WHERE id=? AND version=? RETURNING token_hash',[digest,kind,Date.now()+1800000,account.id,account.version])]);
 if(!reserved[1].results?.length)return; // A concurrent registration/reset superseded this request.
 try{await env.EMAIL.send({to:account.email,from:env.EMAIL_FROM,subject:`BadgeWars · ${title}`,text});}catch{await run(db,'DELETE FROM bw_email_codes WHERE token_hash=?',[digest]);throw Error('email_delivery_unavailable');}
}
export async function emailRoute(request,env){
 const path=new URL(request.url).pathname;if(!path.startsWith('/api/auth/email/'))return null;
 const operation=path.slice('/api/auth/email/'.length),actions={login:'auth-login',register:'auth-register',resend:'auth-resend',reset:'auth-reset',confirm:'auth-confirm',password:'auth-password'};
 if(request.method!=='POST'||!actions[operation])return privateJson({error:'not_found'},404);
 if(request.headers.get('Origin')!==new URL(env.APP_URL).origin)return privateJson({error:'origin_forbidden'},403);
 if(!emailReady(env))return privateJson({error:'email_auth_unavailable'},503);
 try{
  const db=primary(env),ip=await hash(env.PASSWORD_PEPPER+':'+(request.headers.get('CF-Connecting-IP')||'unknown'));
  if(!await throttle(db,'auth:ip:'+ip,10)||!await throttle(db,'auth:hour:'+ip,40,3600))throw Error('rate_limited');
  const value=await input(request);if(typeof value.website==='string'&&value.website)return privateJson({error:'challenge_failed'},403);
  if(!await verifyChallenge(request,env,value.turnstileToken,'auth',actions[operation]))return privateJson({error:'challenge_failed'},403);
  if(['confirm','password'].includes(operation)){
   if(typeof value.code!=='string'||!/^[a-f0-9]{64}$/.test(value.code))throw Error('invalid_action_code');
   const digest=await hash(value.code),kind=operation==='confirm'?'verify':'reset';
   const account=await first(db,'SELECT a.* FROM bw_email_codes c JOIN bw_email_accounts a ON a.id=c.account_id WHERE c.token_hash=? AND c.kind=? AND c.expires>? AND c.version=a.version',[digest,kind,Date.now()]);
   if(!account)throw Error('invalid_action_code');
   if(operation==='confirm'){
    // Email proof alone cannot activate a password chosen by a pre-registration attacker.
    if(typeof value.password!=='string'||value.password.length>512||!await passwordVerify(value.password,account.password_hash,env.PASSWORD_PEPPER))throw Error('invalid_credentials');
    const row=await statement(db,"UPDATE bw_email_accounts SET verified=1 WHERE id=? AND verified=0 AND version=? AND EXISTS(SELECT 1 FROM bw_email_codes WHERE token_hash=? AND kind='verify' AND expires>? AND version=bw_email_accounts.version) RETURNING id",[account.id,account.version,digest,Date.now()]).first();
    if(!row)throw Error('invalid_action_code');return privateJson({status:'confirmed'});
   }
   if(!validPassword(value.password))throw Error('invalid_password');
   const encoded=await passwordHash(value.password,env.PASSWORD_PEPPER),row=await statement(db,"UPDATE bw_email_accounts SET password_hash=?,version=version+1 WHERE id=? AND verified=1 AND version=? AND EXISTS(SELECT 1 FROM bw_email_codes WHERE token_hash=? AND kind='reset' AND expires>? AND version=bw_email_accounts.version) RETURNING id",[encoded,account.id,account.version,digest,Date.now()]).first();
   if(!row)throw Error('invalid_action_code');return privateJson({status:'password_changed'},200,[cookie('bw_session','',env,0)]);
  }
  const email=normalizedEmail(value.email);if(!email)throw Error('invalid_email');
  const addressKey=await hash(env.PASSWORD_PEPPER+':email:'+email);
  if(!await throttle(db,'auth:email:'+addressKey,8,3600))throw Error('rate_limited');
  let account=await first(db,'SELECT * FROM bw_email_accounts WHERE email=?',[email]);
  if(operation==='login'){
   if(typeof value.password!=='string'||value.password.length>512)throw Error('invalid_credentials');
   const matches=await passwordVerify(value.password,account?.password_hash,env.PASSWORD_PEPPER);
   if(!matches||!account?.verified)throw Error('invalid_credentials');
   const token=random(),created=await statement(db,'INSERT INTO bw_sessions(token_hash,user_id,expires) SELECT ?,id,? FROM bw_email_accounts WHERE id=? AND verified=1 AND version=? AND password_hash=? RETURNING token_hash',[await hash(token),Date.now()+2592000000,account.id,account.version,account.password_hash]).first();
   if(!created)throw Error('invalid_credentials');return privateJson({status:'signed_in'},200,[cookie('bw_session',token,env)]);
  }
  if(operation==='register'){
   if(value.accepted!==true||value.termsVersion!==TERMS_VERSION)throw Error('invalid_consent');
   if(!validPassword(value.password))throw Error('invalid_password');
   const encoded=await passwordHash(value.password,env.PASSWORD_PEPPER);
   account=await statement(db,'INSERT INTO bw_email_accounts(id,email,password_hash,terms_version,created_at) VALUES(?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET password_hash=excluded.password_hash,version=bw_email_accounts.version+1,terms_version=excluded.terms_version,created_at=excluded.created_at WHERE bw_email_accounts.verified=0 RETURNING *',[crypto.randomUUID(),email,encoded,TERMS_VERSION,Date.now()]).first();
   if(account)await sendCode(db,env,account,'verify',value.locale);
  }else if(operation==='resend'&&account&&!account.verified)await sendCode(db,env,account,'verify',value.locale);
  else if(operation==='reset'&&account?.verified)await sendCode(db,env,account,'reset',value.locale);
  // Same response for absent, pending and verified addresses; no public account lookup.
  return privateJson({status:'queued'});
 }catch(error){
  const code=['rate_limited','invalid_request','body_too_large','invalid_email','invalid_password','invalid_consent','invalid_credentials','invalid_action_code','email_delivery_unavailable'].includes(error.message)?error.message:error instanceof SyntaxError?'invalid_request':'email_auth_unavailable';
  return privateJson({error:code},code==='rate_limited'?429:code==='invalid_credentials'?401:code==='body_too_large'?413:code.endsWith('unavailable')?503:400);
 }
}
