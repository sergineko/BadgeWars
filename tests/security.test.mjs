import test from 'node:test';
import assert from 'node:assert/strict';
import {validCheckout,verifyChallenge} from '../src/security.mjs';
import {paymentsReady} from '../src/dodo.mjs';
import {env as dodoEnv} from './helpers/dodo.mjs';
import {catalog,badgeSvg} from '../public/badges.js';
test('rejects underpayment, fractional cents, unknown badges and injected aliases',()=>{for(const input of [{badge:'flex',owner:'bob',amount:9999},{badge:'bait',owner:'<script>',amount:500},{badge:'bait',owner:'ok',amount:500.5},{badge:'missing',owner:'ok',amount:500},{badge:'genesis',owner:'ok',amount:5100}])assert.equal(validCheckout(input,catalog),false);assert.equal(validCheckout({badge:'flex',owner:'pixel_01',amount:12100},catalog),true);});
test('SVG escapes dynamic user text and retains overtaken rank',()=>{const svg=badgeSvg('flex',{owner:'<script>&"',amount:12000,rank:2});assert.ok(!svg.includes('<script>'));assert.ok(svg.includes('&lt;script&gt;'));assert.ok(svg.includes('Rank #2'));assert.ok(svg.includes('Overtaken'));});
test('all five badges render in both styles, including genesis edition',()=>{for(const b of catalog){for(const compact of [false,true]){const svg=badgeSvg(b.id,{owner:'tester',amount:b.base,edition:10},compact);assert.ok(svg.startsWith('<svg'));assert.ok(svg.endsWith('</svg>'));assert.ok(svg.includes('role="img"'));}}assert.ok(badgeSvg('genesis',{owner:'tester',amount:5000,edition:10}).includes('Owner 10 of 10'));});

test('official Turnstile dummy keys work only in loopback Sandbox and never enable deployed payments',async()=>{
 const previous=globalThis.fetch,env={...dodoEnv,APP_URL:'http://127.0.0.1:8788',DODO_PAYMENTS_ENVIRONMENT:'test_mode',TURNSTILE_SITE_KEY:'1x00000000000000000000AA',TURNSTILE_SECRET_KEY:'1x0000000000000000000000000000000AA'};
 globalThis.fetch=async()=>Response.json({success:true,hostname:'localhost',action:'test',cdata:'test-data'});
 try{
  const request=new Request(env.APP_URL+'/api/wallet/topup'),token='XXXX.DUMMY.TOKEN.XXXX';
  assert.equal(await verifyChallenge(request,env,token,'user'),true);assert.equal(paymentsReady(env),true);
  for(const extra of [{DODO_PAYMENTS_ENVIRONMENT:'live_mode',DODO_LIVE_APPROVAL_REFERENCE:'approval'},{APP_URL:'https://badges.example'}]){const deployed={...env,...extra};assert.equal(paymentsReady(deployed),false);assert.equal(await verifyChallenge(new Request(deployed.APP_URL+'/api/wallet/topup'),deployed,token,'user'),false);}
  assert.equal(await verifyChallenge(request,env,'incorrect-dummy-token','user'),false);
  globalThis.fetch=async()=>Response.json({success:false});assert.equal(await verifyChallenge(request,env,token,'user'),false);
 }finally{globalThis.fetch=previous;}
});
