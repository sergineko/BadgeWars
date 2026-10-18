import test from 'node:test';
import assert from 'node:assert/strict';
import {createD1} from './helpers/d1.mjs';
import {emailRoute,normalizedEmail} from '../src/email-auth.mjs';
import {authRoute,identity,hash} from '../src/auth.mjs';
import {passwordHash,passwordVerify,validPassword} from '../src/password.mjs';
import {TERMS_VERSION} from '../public/terms.js';
const origin='https://badgewars.com',password='An original long passphrase! 82',second='A different long passphrase! 73';
function setup(){const mails=[],DB=createD1(),env={DB,APP_URL:origin,AUTH_COOKIE_SECRET:'session-secret-for-tests-at-least-32-chars',PASSWORD_PEPPER:'private-pepper-for-tests-at-least-32-chars',EMAIL_AUTH_ENABLED:'true',EMAIL_FROM:'no-reply@badgewars.com',EMAIL:{async send(message){mails.push(message);return {messageId:crypto.randomUUID()};}},TURNSTILE_SITE_KEY:'real-site-key',TURNSTILE_SECRET_KEY:'real-secret'};return {env,mails,async call(operation,value={},extra={}){const r=await emailRoute(new Request(origin+'/api/auth/email/'+operation,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.1',...extra},body:JSON.stringify({email:'collector@example.com',password,accepted:true,termsVersion:TERMS_VERSION,turnstileToken:'real-turnstile-token',...value})}),env);return {r,body:await r.json()};},code(){return new URL(mails.at(-1).text.match(/https:\/\/\S+/)[0]).hash.split('/')[1];},clearLimits(){DB.sqlite.exec('DELETE FROM bw_throttle');},close(){DB.close();}};}
async function withChallenge(fn){const previous=globalThis.fetch;globalThis.fetch=async(_,options)=>{const token=new URLSearchParams(options.body).get('response');return Response.json({success:token!=='reject-token',hostname:'badgewars.com',action:token==='real-turnstile-token'?'auth-register':token,cdata:'auth'});};try{await fn();}finally{globalThis.fetch=previous;}}
const challenge=operation=>({turnstileToken:'auth-'+operation});

test('password storage uses salted native scrypt, a separate pepper and bounded passphrases',async()=>{
 const encoded=await passwordHash(password,'pepper-test');assert.ok(!encoded.includes(password));assert.equal(await passwordVerify(password,encoded,'pepper-test'),true);assert.equal(await passwordVerify(password,encoded,'wrong-pepper'),false);assert.equal(await passwordVerify('wrong password',encoded,'pepper-test'),false);assert.equal(await passwordVerify(password,null,'pepper-test'),false);
 assert.equal(validPassword('a'.repeat(30)),false);assert.equal(validPassword('short'),false);assert.equal(validPassword('🙂'.repeat(129)),false);assert.equal(validPassword(password),true);assert.equal(normalizedEmail(' Collector@Example.com '),'collector@example.com');assert.equal(normalizedEmail('bad\r\nemail@example.com'),null);
});

test('verification requires mailbox proof and the chosen password; pending accounts cannot own wallets or sign in',async()=>withChallenge(async()=>{
 const c=setup();try{
  assert.equal((await c.call('register')).body.status,'queued');const code=c.code();assert.equal(c.env.DB.sqlite.prepare('SELECT count(*) n FROM bw_users').get().n,0);assert.equal(c.env.DB.sqlite.prepare('SELECT count(*) n FROM bw_wallets').get().n,0);
  const stored=c.env.DB.sqlite.prepare('SELECT * FROM bw_email_codes').get();assert.notEqual(stored.token_hash,code);assert.equal(stored.token_hash,await hash(code));
  assert.equal((await c.call('login',challenge('login'))).r.status,401);
  assert.equal((await c.call('confirm',{...challenge('confirm'),code,password:second})).body.error,'invalid_credentials');
  assert.equal((await c.call('confirm',{...challenge('confirm'),code})).body.status,'confirmed');assert.equal(c.env.DB.sqlite.prepare('SELECT count(*) n FROM bw_wallets').get().n,1);
  assert.equal((await c.call('confirm',{...challenge('confirm'),code})).body.error,'invalid_action_code');
  const login=await c.call('login',challenge('login'));assert.equal(login.body.status,'signed_in');const cookie=login.r.headers.get('Set-Cookie');for(const flag of ['HttpOnly','Secure','SameSite=Lax'])assert.ok(cookie.includes(flag));
  const user=(await identity(new Request(origin,{headers:{Cookie:cookie.split(';')[0]}}),c.env)).user;assert.ok(user);assert.ok(!JSON.stringify(user).includes('collector@example.com'));
  assert.equal((await c.call('register',{password:second})).body.status,'queued');assert.equal(c.mails.length,1);
 }finally{c.close();}
}));

test('reset tokens expire, cannot be replayed and atomically revoke existing sessions',async()=>withChallenge(async()=>{
 const c=setup();try{
  await c.call('register');await c.call('confirm',{...challenge('confirm'),code:c.code()});const login=await c.call('login',challenge('login')),cookie=login.r.headers.get('Set-Cookie').split(';')[0];
  await c.call('reset',challenge('reset'));const expired=c.code();c.env.DB.sqlite.exec('UPDATE bw_email_codes SET expires=0');assert.equal((await c.call('password',{...challenge('password'),code:expired,password:second})).body.error,'invalid_action_code');
  await c.call('reset',challenge('reset'));const code=c.code();assert.equal((await c.call('password',{...challenge('password'),code,password:second})).body.status,'password_changed');
  assert.equal((await identity(new Request(origin,{headers:{Cookie:cookie}}),c.env)).user,null);assert.equal(c.env.DB.sqlite.prepare('SELECT count(*) n FROM bw_email_codes').get().n,0);
  assert.equal((await c.call('password',{...challenge('password'),code,password:second})).body.error,'invalid_action_code');c.clearLimits();assert.equal((await c.call('login',challenge('login'))).body.error,'invalid_credentials');assert.equal((await c.call('login',{...challenge('login'),password:second})).body.status,'signed_in');
 }finally{c.close();}
}));

test('CSRF, honeypots, consent, Turnstile action and disabled mail transport fail closed',async()=>withChallenge(async()=>{
 const c=setup();try{
  assert.equal((await c.call('register',{}, {Origin:'https://evil.example'})).r.status,403);
  assert.equal((await c.call('register',{website:'bot'})).r.status,403);assert.equal((await c.call('register',{accepted:false})).body.error,'invalid_consent');
  assert.equal((await c.call('register',{turnstileToken:'auth-login'})).r.status,403);assert.equal((await c.call('register',{password:'x'})).body.error,'invalid_password');
  assert.equal((await c.call('register',{password:'x'.repeat(9000)})).r.status,413);
  assert.deepEqual((await c.call('reset',{...challenge('reset'),email:'unknown@example.com'})).body,{status:'queued'});assert.equal(c.mails.length,0);
  c.env.EMAIL.send=async()=>{throw Error('simulated failure');};assert.equal((await c.call('register')).body.error,'email_delivery_unavailable');assert.equal(c.env.DB.sqlite.prepare('SELECT count(*) n FROM bw_email_codes').get().n,0);
  delete c.env.EMAIL;assert.equal((await c.call('login',challenge('login'))).r.status,503);assert.equal((await (await authRoute(new Request(origin+'/api/auth/config'),c.env)).json()).emailAvailable,false);
 }finally{c.close();}
}));

test('re-registration replaces only pending credentials and invalidates old links; mail and IP budgets are enforced',async()=>withChallenge(async()=>{
 const c=setup();try{
  await c.call('register');const previous=c.code();await c.call('register',{password:second});assert.equal((await c.call('confirm',{...challenge('confirm'),code:previous})).body.error,'invalid_action_code');
  assert.equal((await c.call('confirm',{...challenge('confirm'),code:c.code(),password:second})).body.status,'confirmed');c.clearLimits();
  for(let i=0;i<8;i++)await c.call('reset',challenge('reset'));assert.equal((await c.call('reset',challenge('reset'))).r.status,429);
  c.clearLimits();const w=Math.floor(Date.now()/1000/86400);await c.env.DB.prepare('INSERT INTO bw_throttle(key,window,count,expires) VALUES(?,?,?,?)').bind('email:global:day',w,80,(w+1)*86400).run();assert.equal((await c.call('reset',challenge('reset'))).r.status,429);
 }finally{c.close();}
}));

test('a stale mail reservation cannot delete the verification link of a newer registration',async()=>withChallenge(async()=>{
 const c=setup(),batch=c.env.DB.batch.bind(c.env.DB);let interrupted=false;
 c.env.DB.batch=async statements=>{if(!interrupted&&statements.some(s=>s.sql.includes('INSERT INTO bw_email_codes'))){interrupted=true;await c.call('register',{password:second});}return batch(statements);};
 try{await c.call('register');assert.equal(c.mails.length,1);assert.equal((await c.call('confirm',{...challenge('confirm'),code:c.code(),password:second})).body.status,'confirmed');}finally{c.close();}
}));
