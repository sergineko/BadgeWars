import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {legalRoutes,legalSections} from '../public/legal.js';
import {TERMS_VERSION,termsDocument} from '../public/terms.js';
import {internalRoute} from '../public/routes.js';
import {legalPageHtml} from '../src/legal-page.mjs';
import worker from '../src/worker.mjs';
import {unwrapWebhook} from '../src/dodo.mjs';
import {env,business} from './helpers/dodo.mjs';
import {createHmac} from 'node:crypto';
test('Dodo legal pages disclose software credits, non-cash redemption, paid support and mandatory rights in both languages',()=>{
 for(const locale of ['es','en']){
  const text=JSON.stringify(termsDocument({},locale));assert.ok(text.includes('Dodo Payments'));assert.ok(text.includes('SaaS'));assert.ok(text.includes('cashback'));assert.ok(text.includes('103'));assert.ok(text.includes('API'));
  for(const path of legalRoutes){const document=legalSections(path,locale);assert.ok(document.length>=3);}
 }
 assert.equal(internalRoute('/refunds','https://badgewars.com').page,'/refunds');
});
test('reviewers can read every legal page and its ES/EN content without executing JavaScript',async()=>{
 const template=readFileSync('public/index.html','utf8');
 for(const path of legalRoutes){
  const html=legalPageHtml(template,path);assert.ok(html.includes('<h2>Español</h2>'));assert.ok(html.includes('<h2>English</h2>'));assert.ok(html.includes('Dodo Payments'));assert.ok(html.includes('support@badgewars.com'));assert.ok(html.includes('href="/refunds"'));
  const assets={fetch:async()=>new Response(template)};const response=await worker.fetch(new Request('https://badgewars.com'+path),{ASSETS:assets},{});assert.equal(response.status,200);assert.ok((await response.text()).includes(legalSections(path,'en')[0].title));
  const head=await worker.fetch(new Request('https://badgewars.com'+path,{method:'HEAD'}),{ASSETS:assets},{});assert.equal(await head.text(),'');
 }
});

test('refund pages retain review and reactivation safeguards in both languages after terms sections move',()=>{
 const expected=['reversals','account-review','reactivation','complaints','seller','consumer-rights'];
 for(const locale of ['es','en']){
  const sections=legalSections('/refunds',locale),ids=termsDocument({},locale).sections.map(s=>s.id);
  assert.equal(new Set(ids).size,ids.length);assert.ok(ids.every(Boolean));
  for(const id of expected)assert.ok(sections.some(s=>s.id===id),locale+' missing '+id);
  assert.ok(!sections.some(s=>s.id==='flex'));
  const review=sections.find(s=>s.id==='account-review').text;
  assert.ok(review.includes('SVG'));assert.ok(review.includes('Genesis'));assert.ok(review.includes('Trust Bag'));
  assert.ok(sections.find(s=>s.id==='reactivation').text.includes('support@badgewars.com'));
 }
 assert.notEqual(TERMS_VERSION,'2026-10-19-r8');
});
test('Dodo SDK verifies raw signatures, rejects stale or foreign-business events',async()=>{
 const key=Buffer.from('long-dodo-sdk-signature-test-key'),secret='whsec_'+key.toString('base64'),config={...env,DODO_PAYMENTS_WEBHOOK_KEY:secret},body=JSON.stringify({business_id:business,type:'payment.succeeded',data:{payment_id:'pay_signed'}}),id='evt_sdk';
 const headers=stamp=>new Headers({'webhook-id':id,'webhook-timestamp':String(stamp),'webhook-signature':'v1,bad v1,'+createHmac('sha256',key).update(id+'.'+stamp+'.'+body).digest('base64')});
 const stamp=Math.floor(Date.now()/1000);assert.equal((await unwrapWebhook(body,headers(stamp),config)).type,'payment.succeeded');
 await assert.rejects(unwrapWebhook(body+' ',headers(stamp),config));await assert.rejects(unwrapWebhook(body,headers(stamp-301),config));await assert.rejects(unwrapWebhook(body,headers(stamp),{...config,DODO_BUSINESS_ID:'bus_foreign'}));
});
