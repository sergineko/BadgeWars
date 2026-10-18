import test from 'node:test';
import assert from 'node:assert/strict';
import {createD1} from './helpers/d1.mjs';
import {authRoute,identity,unseal,hash} from '../src/auth.mjs';
const setup=()=>({DB:createD1(),APP_URL:'https://badges.example',AUTH_COOKIE_SECRET:'a-long-32-byte-cookie-secret-for-tests',AUTH_PROVIDERS:'google,github',GOOGLE_CLIENT_ID:'google-id',GOOGLE_CLIENT_SECRET:'google-secret',GITHUB_CLIENT_ID:'github-id',GITHUB_CLIENT_SECRET:'github-secret'});
const flowCookie=response=>response.headers.getSetCookie().find(c=>c.startsWith('bw_oauth=')).split(';')[0];
function callback(start,env){const redirect=new URL(start.headers.get('Location'));return env.APP_URL+'/api/auth/callback/'+(redirect.hostname==='github.com'?'github':'google')+'?code=verified-code&state='+redirect.searchParams.get('state');}

test('native OAuth uses S256 PKCE, exact callbacks, allowlist and one-use D1 state',async()=>{
 const env=setup();try{
  const start=await authRoute(new Request(env.APP_URL+'/api/auth/start?provider=google&lang=en'),env),url=new URL(start.headers.get('Location'));
  assert.equal(url.origin,'https://accounts.google.com');assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert.equal(url.searchParams.get('redirect_uri'),env.APP_URL+'/api/auth/callback/google');assert.equal(url.searchParams.get('scope'),'openid profile');
  const c=flowCookie(start);assert.ok(start.headers.get('Set-Cookie').includes('HttpOnly'));assert.ok(start.headers.get('Set-Cookie').includes('Secure'));assert.ok(!c.includes('google-secret'));
  const flow=await unseal(c.slice(9),env.AUTH_COOKIE_SECRET);assert.ok(flow.verifier.length>=43);
  assert.equal(env.DB.sqlite.prepare('SELECT count(*) AS n FROM bw_oauth_states').get().n,1);
  const bad=await authRoute(new Request(callback(start,env).replace(/state=.*/, 'state=wrong'),{headers:{Cookie:c}}),env);assert.ok(bad.headers.get('Location').endsWith('/collection/sign-in-error'));
  const unsupported=await authRoute(new Request(env.APP_URL+'/api/auth/start?provider=evil'),env);assert.equal(unsupported.status,302);assert.ok(unsupported.headers.get('Location').endsWith('/collection/sign-in-error'));
  assert.equal((await identity(new Request(env.APP_URL,{headers:{'X-User-Id':'attacker'}}),env)).user,null);
  assert.equal((await authRoute(new Request(env.APP_URL+'/api/auth/logout',{method:'POST',headers:{Origin:'https://evil.example'}}),env)).status,403);
 }finally{env.DB.close();}
});

test('verified social identity creates a D1 wallet and opaque session; replay and logout invalidate access',async()=>{
 const env=setup(),original=globalThis.fetch;try{
  const start=await authRoute(new Request(env.APP_URL+'/api/auth/start?provider=github&badge=genesis&lang=en'),env);let calls=0;
  globalThis.fetch=async(url,init)=>{calls++;if(String(url)==='https://github.com/login/oauth/access_token'){assert.ok(init.body.get('code_verifier').length>=43);assert.equal(init.body.get('code'),'verified-code');return Response.json({access_token:'provider-secret-token'});}assert.equal(String(url),'https://api.github.com/user');assert.equal(init.headers.Authorization,'Bearer provider-secret-token');return Response.json({id:123456,login:'collector',avatar_url:'https://avatars.githubusercontent.com/u/123456',email:'private@example.com'});};
  const req=new Request(callback(start,env),{headers:{Cookie:flowCookie(start)}}),response=await authRoute(req,env);assert.ok(response.headers.get('Location').endsWith('/badge/genesis'));assert.equal(calls,2);
  const session=response.headers.getSetCookie().find(c=>c.startsWith('bw_session=')).split(';')[0];assert.ok(!session.includes('provider-secret-token'));
  const result=await identity(new Request(env.APP_URL,{headers:{Cookie:session,'X-User-Id':'attacker'}}),env);assert.equal(result.user.name,'collector');assert.equal(result.user.email,undefined);
  const stored=env.DB.sqlite.prepare('SELECT token_hash FROM bw_sessions').get();assert.equal(stored.token_hash,await hash(session.slice(11)));assert.equal(env.DB.sqlite.prepare('SELECT balance FROM bw_wallets').get().balance,0);
  assert.equal(env.DB.sqlite.prepare('SELECT count(*) AS n FROM bw_oauth_states').get().n,0);
  const replay=await authRoute(req,env);assert.ok(replay.headers.get('Location').endsWith('/collection/sign-in-error'));assert.equal(calls,2);
  await authRoute(new Request(env.APP_URL+'/api/auth/logout',{method:'POST',headers:{Cookie:session,Origin:env.APP_URL}}),env);assert.equal((await identity(new Request(env.APP_URL,{headers:{Cookie:session}}),env)).user,null);
 }finally{globalThis.fetch=original;env.DB.close();}
});

test('network failure consumes OAuth state and permits a fresh sign-in without creating a phantom account',async()=>{
 const env=setup(),original=globalThis.fetch;try{
  const start=await authRoute(new Request(env.APP_URL+'/api/auth/start?provider=google'),env),req=new Request(callback(start,env),{headers:{Cookie:flowCookie(start)}});globalThis.fetch=async()=>{throw Error('offline');};
  const failed=await authRoute(req,env);assert.ok(failed.headers.get('Location').endsWith('/collection/sign-in-error'));assert.equal(env.DB.sqlite.prepare('SELECT count(*) AS n FROM bw_users').get().n,0);assert.equal(env.DB.sqlite.prepare('SELECT count(*) AS n FROM bw_oauth_states').get().n,0);
 }finally{globalThis.fetch=original;env.DB.close();}
});
