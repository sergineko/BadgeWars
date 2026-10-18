import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {verifyPolar,validCheckout,verifyChallenge} from '../src/security.mjs';
import {paymentsReady} from '../src/polar.mjs';
import {catalog,badgeSvg} from '../public/badges.js';
const key=Buffer.from('a-long-32-byte-test-webhook-secret'),secret='whsec_'+key.toString('base64'),body=JSON.stringify({type:'order.paid'}),now=1800000000000,t=now/1000,id='event_1';
const sig=createHmac('sha256',key).update(id+'.'+t+'.'+body).digest('base64');
const headers=signature=>new Headers({'webhook-id':id,'webhook-timestamp':String(t),'webhook-signature':signature});
test('Standard Webhooks validates raw body, decoded key and rotated signatures',async()=>{assert.equal(await verifyPolar(body,headers('v1,bad v1,'+sig),secret,now),true);});
test('Standard Webhooks rejects modified bodies, stale timestamps, missing headers and wrong key format',async()=>{for(const [payload,h,time,k] of [[body+' ',headers('v1,'+sig),now,secret],[body,headers('v1,'+sig),now+301000,secret],[body,headers('v1,oops'),now,secret],[body,new Headers(),now,secret],[body,headers('v1,'+sig),now,'whsec_bad']])assert.equal(await verifyPolar(payload,h,k,time),false);});
test('rejects underpayment, fractional cents, unknown badges and injected aliases',()=>{for(const input of [{badge:'flex',owner:'bob',amount:9999},{badge:'bait',owner:'<script>',amount:500},{badge:'bait',owner:'ok',amount:500.5},{badge:'missing',owner:'ok',amount:500},{badge:'genesis',owner:'ok',amount:5100}])assert.equal(validCheckout(input,catalog),false);assert.equal(validCheckout({badge:'flex',owner:'pixel_01',amount:12100},catalog),true);});
test('SVG escapes dynamic user text and retains overtaken rank',()=>{const svg=badgeSvg('flex',{owner:'<script>&"',amount:12000,rank:2});assert.ok(!svg.includes('<script>'));assert.ok(svg.includes('&lt;script&gt;'));assert.ok(svg.includes('Rank #2'));assert.ok(svg.includes('Overtaken'));});
test('all five badges render in both styles, including genesis edition',()=>{for(const b of catalog){for(const compact of [false,true]){const svg=badgeSvg(b.id,{owner:'tester',amount:b.base,edition:10},compact);assert.ok(svg.startsWith('<svg'));assert.ok(svg.endsWith('</svg>'));assert.ok(svg.includes('role="img"'));}}assert.ok(badgeSvg('genesis',{owner:'tester',amount:5000,edition:10}).includes('Owner 10 of 10'));});

test('official Turnstile dummy keys work only in loopback Sandbox and never enable deployed payments',async()=>{
 const previous=globalThis.fetch,env={APP_URL:'http://127.0.0.1:8788',POLAR_ENVIRONMENT:'sandbox',TURNSTILE_SITE_KEY:'1x00000000000000000000AA',TURNSTILE_SECRET_KEY:'1x0000000000000000000000000000000AA',POLAR_ACCESS_TOKEN:'test',POLAR_PRODUCT_ID:crypto.randomUUID(),POLAR_ORGANIZATION_ID:crypto.randomUUID()};
 globalThis.fetch=async()=>Response.json({success:true,hostname:'localhost',action:'test',cdata:'test-data'});
 try{
  const request=new Request(env.APP_URL+'/api/wallet/topup'),token='XXXX.DUMMY.TOKEN.XXXX';
  assert.equal(await verifyChallenge(request,env,token,'user'),true);assert.equal(paymentsReady(env),true);
  for(const extra of [{POLAR_ENVIRONMENT:'production',POLAR_LIVE_APPROVAL_REFERENCE:'approval'},{APP_URL:'https://badges.example'}]){const deployed={...env,...extra};assert.equal(paymentsReady(deployed),false);assert.equal(await verifyChallenge(new Request(deployed.APP_URL+'/api/wallet/topup'),deployed,token,'user'),false);}
  assert.equal(await verifyChallenge(request,env,'incorrect-dummy-token','user'),false);
  globalThis.fetch=async()=>Response.json({success:false});assert.equal(await verifyChallenge(request,env,token,'user'),false);
 }finally{globalThis.fetch=previous;}
});
