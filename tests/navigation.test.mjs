import test from 'node:test';
import assert from 'node:assert/strict';
import {routeState,cleanHref,rankingPath} from '../public/routes.js';
import {badgeUrl,normalizedBadgeUrl} from '../src/badge-url.mjs';
import {authRoute,unseal} from '../src/auth.mjs';
import worker from '../src/worker.mjs';
const origin='https://badges.example',id='90000000-0000-4000-8000-000000000001';

test('clean navigation keeps legacy filters, language and section intent without query strings or fragments',()=>{
 const old=routeState(origin+'/leaderboard?lang=es&metric=trust&q=pixelpilot&page=2#arena');
 assert.equal(old.path,'/leaderboard/trust');assert.equal(old.page,'/leaderboard');assert.equal(old.params.get('q'),'pixelpilot');assert.equal(old.params.get('page'),'2');assert.equal(old.params.get('lang'),'es');
 assert.equal(routeState(origin+'/?lang=en#how').scroll,'how');assert.equal(routeState(origin+'/?lang=en#how').path,'/');
 assert.equal(routeState(origin+'/#leaderboard').page,'/leaderboard');
 assert.equal(routeState(origin+'/leaderboard#genesis-owners').path,'/leaderboard/genesis');
 assert.equal(routeState(origin+'/leaderboard/genesis').scroll,'genesis-owners');
 assert.equal(routeState(origin+'/collection?demo=1').path,'/collection/demo');
 assert.equal(routeState(origin+'/collection/demo').params.get('demo'),'1');
 assert.equal(routeState(origin+'/collection/sign-in-error').params.get('auth'),'error');
 for(const [path,key,value] of [['/badge/genesis','badge','genesis'],['/support/'+id,'support',id]]){const state=routeState(origin+path);assert.equal(state.page,'/');assert.equal(state.params.get(key),value);assert.equal(state.path,path);}
 assert.equal(cleanHref('/leaderboard',{metric:'trust'}),'/leaderboard/trust');assert.equal(cleanHref('/leaderboard#genesis-owners'),'/leaderboard/genesis');assert.equal(cleanHref('/collection',{demo:'1'}),'/collection/demo');assert.equal(cleanHref('/#arena'),'/');assert.equal(rankingPath('bids'),'/leaderboard');
});

test('clean personal SVG addresses normalize to the same stable owner and locale as legacy embeds',()=>{
 for(const locale of ['en','es'])for(const style of ['','compact']){
  const path=badgeUrl('quality',id,locale,style),url=normalizedBadgeUrl(origin+path);
  assert.equal(new URL(origin+path).search,'');assert.equal(url.pathname,'/badges/quality.svg');assert.equal(url.searchParams.get('claim'),id);assert.equal(url.searchParams.get('lang'),locale);assert.equal(url.searchParams.get('style'),style||null);
 }
 assert.equal(normalizedBadgeUrl(origin+badgeUrl('flex',id)+'?claim=evil'),null);
 assert.throws(()=>badgeUrl('quality','../private'));assert.throws(()=>badgeUrl('quality',id,'evil'));
});

test('payment returns land on a clean route and consume encrypted receipt context once, without granting ownership',async()=>{
 const env={APP_URL:origin,AUTH_COOKIE_SECRET:'a-long-cookie-secret-for-navigation-tests'};
 const response=await worker.fetch(new Request(origin+'/api/checkout/return?topup=90000000-0000-4000-8000-000000000001&lang=en'),env,{});
 assert.equal(response.status,302);assert.equal(response.headers.get('Location'),origin+'/collection');assert.equal(response.headers.get('Cache-Control'),'no-store');
 const cookie=response.headers.getSetCookie().find(c=>c.startsWith('bw_return='));assert.ok(cookie.includes('HttpOnly'));assert.ok(cookie.includes('Secure'));assert.ok(!cookie.includes('90000000-0000-4000-8000-000000000001'));
 const value=await unseal(cookie.split(';')[0].slice('bw_return='.length),env.AUTH_COOKIE_SECRET);assert.equal(value.checkout,'90000000-0000-4000-8000-000000000001');assert.equal(value.locale,'en');
 const info=await authRoute(new Request(origin+'/api/auth/me',{headers:{Cookie:cookie.split(';')[0]}}),env);assert.deepEqual(await info.json(),{user:null,navigation:{locale:'en',checkout:'90000000-0000-4000-8000-000000000001'}});assert.ok(info.headers.get('Set-Cookie').includes('Max-Age=0'));
 const expired=await authRoute(new Request(origin+'/api/auth/me',{headers:{Cookie:'bw_return=tampered'}}),env);assert.deepEqual(await expired.json(),{user:null});
 const cancelled=await worker.fetch(new Request(origin+'/api/checkout/return?status=cancel&support='+id),env,{});assert.equal(cancelled.headers.get('Location'),origin+'/');
 assert.equal((await worker.fetch(new Request(origin+'/api/checkout/return?session=evil&redirect=https://evil.example'),env,{})).status,400);
});
