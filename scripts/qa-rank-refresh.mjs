// Run after qa-embeds.mjs while the same native local Worker is running.
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {TERMS_VERSION} from '../public/terms.js';
const origin='http://127.0.0.1:8788',people=JSON.parse(readFileSync('.wrangler/qa/embeds-session.json'));
async function get(person,path){const r=await fetch(origin+path,{headers:{Cookie:'bw_session='+person.token}});assert.equal(r.status,200);return r.json();}
const owner=(await get(people.owner,'/api/me/badges')).items.find(b=>b.badgeId==='quality'),rival=(await get(people.rival,'/api/me/badges')).items.find(b=>b.badgeId==='quality');
const embed=await get(people.owner,'/api/me/embed?'+new URLSearchParams({badge:owner.id,lang:'es',format:'html'}));
const before=await fetch(embed.imageUrl),oldTag=before.headers.get('ETag');assert.match(await before.text(),/data-trust-tier="leader"/);
const support=await fetch(origin+'/api/wallet/spend',{method:'POST',headers:{Cookie:'bw_session='+people.supporter.token,Origin:origin,'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({badge:'quality',kind:'support',targetId:rival.id,owner:'qa_supporter',amount:2000,accepted:true,executionRequested:true,withdrawalAcknowledged:true,termsVersion:TERMS_VERSION})});assert.equal(support.status,200);
console.log('Rival received support; waiting for publication and metadata cache expiry.');
await new Promise(r=>setTimeout(r,11000));
assert.equal((await fetch(origin+'/cdn-cgi/local/explorer/api/local/scheduled?worker=badgewars',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cron:'*/5 * * * *'})})).status,200);
const response=await fetch(embed.imageUrl,{headers:{'If-None-Match':oldTag}});assert.equal(response.status,200);assert.notEqual(response.headers.get('ETag'),oldTag);const svg=await response.text();assert.match(svg,/#02/);assert.match(svg,/data-trust-tier="podium"/);
assert.equal((await get(people.owner,'/api/me/embed?'+new URLSearchParams({badge:owner.id,lang:'es',format:'html'}))).imageUrl,embed.imageUrl);
const path='artifacts/embed-qa.json',report=JSON.parse(readFileSync(path));report.rankRefresh={sameUrl:true,before:1,after:2,etagChanged:true,nativeD1KV:true};writeFileSync(path,JSON.stringify(report,null,2));console.log(JSON.stringify(report.rankRefresh));
