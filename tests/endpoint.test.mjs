import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.mjs';
import {createHmac} from 'node:crypto';
import {trustStateKey} from '../src/trust-state.mjs';
test('retired Stripe endpoint cannot reach the D1 wallet',async()=>{
 const body=JSON.stringify({type:'checkout.session.completed',data:{object:{payment_status:'paid',metadata:{app:'another-project'}}}}),t=Math.floor(Date.now()/1000),secret='whsec_test';
 const signature=createHmac('sha256',secret).update(`${t}.${body}`).digest('hex');
 const response=await worker.fetch(new Request('https://badges.example/api/stripe/webhook',{method:'POST',body,headers:{'stripe-signature':`t=${t},v1=${signature}`}}),{STRIPE_WEBHOOK_SECRET:secret},{});
 assert.equal(response.status,404);
});
test('Trust Bag shares short-lived KV metadata and switches SVG cache revision when ranks change',async()=>{
 const previous=globalThis.caches,cache=new Map();let reads=0;const tasks=[],id='90000000-0000-4000-8000-000000000001';
 globalThis.caches={default:{match:async req=>cache.get(req.url)?.clone(),put:async(req,res)=>cache.set(req.url,res.clone()),delete:async req=>cache.delete(req.url)}};
 let state={revision:1,entries:[{id,badgeId:'quality',owner:'holder',points:'287',rank:1}]};
 const env={DB:{prepare:()=>({bind:()=>({first:async()=>({status:'active',frozen:0,debt:0})})})},BADGES:{get:async()=>{reads++;return structuredClone(state);}}},ctx={waitUntil:job=>tasks.push(job)},url='https://badges.example/badges/quality.svg?claim='+id;
 try{
  const first=await worker.fetch(new Request(url),env,ctx);await Promise.all(tasks.splice(0));const oldTag=first.headers.get('ETag');assert.equal(first.headers.get('Cache-Control'),'no-store');assert.ok((await first.text()).includes('data-trust-tier="leader"'));
  await worker.fetch(new Request(url+'&style=compact'),env,ctx);await Promise.all(tasks.splice(0));assert.equal(reads,1);
  // The metadata TTL expires (or local publication purges it); old rendered SVGs remain cached.
  state={revision:2,entries:[{id:'90000000-0000-4000-8000-000000000002',badgeId:'quality',owner:'challenger',points:'300',rank:1},{id,badgeId:'quality',owner:'holder',points:'287',rank:2}]};cache.delete(trustStateKey(url).url);
  const updated=await worker.fetch(new Request(url,{headers:{'If-None-Match':oldTag}}),env,ctx);await Promise.all(tasks.splice(0));assert.equal(updated.status,200);assert.notEqual(updated.headers.get('ETag'),oldTag);const svg=await updated.text();assert.ok(svg.includes('data-trust-tier="podium"'));assert.ok(svg.includes('#02'));assert.ok(svg.includes('287 pts'));assert.equal(reads,2);
  const unchanged=await worker.fetch(new Request(url,{headers:{'If-None-Match':updated.headers.get('ETag')}}),env,ctx);assert.equal(unchanged.status,304);
 }finally{globalThis.caches=previous;}
});
test('dynamic SVG endpoints use KV and canonical edge cache, support conditional GET and HEAD',async()=>{
 const previous=globalThis.caches,cache=new Map();let reads=0;const tasks=[];
 globalThis.caches={default:{match:async req=>cache.get(req.url)?.clone(),put:async(req,res)=>cache.set(req.url,res),delete:async req=>cache.delete(req.url)}};
 const state={revision:2,owner:'tester',amount:12000,entries:[{id:'90000000-0000-4000-8000-000000000001',owner:'tester',amount:12000,currency:'usd'}]};
 const env={BADGES:{get:async()=>{reads++;return state;}}};const ctx={waitUntil:task=>tasks.push(task)};
 try{
  const first=await worker.fetch(new Request('https://badges.example/badges/flex.svg?lang=en'),env,ctx);await Promise.all(tasks);
  assert.equal(first.status,200);assert.equal(first.headers.get('Access-Control-Allow-Origin'),'*');assert.ok(first.headers.get('ETag').startsWith('W/"v6-'));assert.ok((await first.text()).includes('THE APEX FLEX'));
  const cached=await worker.fetch(new Request('https://badges.example/badges/flex.svg'),env,ctx);assert.equal(cached.status,200);assert.equal(reads,1);
  const head=await worker.fetch(new Request('https://badges.example/badges/flex.svg',{method:'HEAD'}),env,ctx);assert.equal(head.status,200);assert.equal(await head.text(),'');
  const unchanged=await worker.fetch(new Request('https://badges.example/badges/flex.svg',{headers:{'If-None-Match':cached.headers.get('ETag')}}),env,ctx);assert.equal(unchanged.status,304);assert.equal(await unchanged.text(),'');
  const duplicate=await worker.fetch(new Request('https://badges.example/badges/flex.svg?lang=es&lang=en'),env,ctx);assert.equal(duplicate.status,400);
  assert.equal((await worker.fetch(new Request('https://badges.example/badges/flex.svg?claim='),env,ctx)).status,400);
  assert.equal((await worker.fetch(new Request('https://badges.example/badges/unknown.svg'),env,ctx)).status,404);
  const options=await worker.fetch(new Request('https://badges.example/badges/flex.svg',{method:'OPTIONS'}),env,ctx);assert.equal(options.status,204);
 }finally{globalThis.caches=previous;}
});
