import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.mjs';
import {createD1,seedUser,consent} from './helpers/d1.mjs';
import {catalog} from '../public/badges.js';
import {settle} from '../src/settlement.mjs';
import {publicProjection} from '../src/inventory.mjs';
import {personalEmbed} from '../src/embed.mjs';
import {badgeUrl} from '../src/badge-url.mjs';

test('suspension, payment freeze or debt replaces cached active SVGs with an inert status card and a recovery link',async()=>{
 const DB=createD1(),previous=globalThis.caches,cache=new Map(),tasks=[],origin='https://badges.example';
 globalThis.caches={default:{match:async req=>cache.get(req.url)?.clone(),put:async(req,res)=>cache.set(req.url,res.clone()),delete:async req=>cache.delete(req.url)}};
 const drain=async()=>Promise.all(tasks.splice(0));
 try{
  const user=await seedUser(DB,{credits:5000}),states={},urls=[],ctx={waitUntil:job=>tasks.push(job)};
  let primaryReads=0;DB.withSession=mode=>{assert.equal(mode,'first-primary');primaryReads++;return DB;};
  for(const b of catalog){
   const owned=await settle(DB,b,{...consent,userId:user,owner:'paid_holder',amount:b.base},crypto.randomUUID());
   states[b.id]=await publicProjection(DB,b.id);
   for(const locale of ['es','en'])for(const style of ['','compact']){
    urls.push(origin+badgeUrl(b.id,owned.holderId,locale,style));
    urls.push(origin+`/badges/${b.id}.svg?claim=${owned.holderId}&lang=${locale}${style?'&style=compact':''}`);
   }
  }
  // Never update this projection: the financial guard must work even during a KV outage.
  const env={DB,APP_URL:origin,BADGES:{get:async key=>structuredClone(states[key.split(':')[1]])}};
  const tags=new Map();
  for(const url of urls){const r=await worker.fetch(new Request(url),env,ctx);await drain();assert.equal(r.status,200);assert.equal(r.headers.get('Cache-Control'),'no-store');tags.set(url,r.headers.get('ETag'));await r.text();}
  assert.ok(cache.size>0);
  const link=origin+'/b/'+states.flex.entries[0].id;
  const activeLink=await worker.fetch(new Request(link),env,ctx);assert.equal(activeLink.status,302);assert.equal(activeLink.headers.get('Location'),origin+'/leaderboard/flex');
  for(const mutation of ["UPDATE bw_user_badges SET status='suspended'",'UPDATE bw_wallets SET frozen=1','UPDATE bw_wallets SET debt=1']){
   DB.sqlite.exec("UPDATE bw_user_badges SET status='active'; UPDATE bw_wallets SET frozen=0,debt=0;"+mutation);
   for(const url of urls)for(const method of ['GET','HEAD']){
    const r=await worker.fetch(new Request(url,{method,headers:{'If-None-Match':tags.get(url)}}),env,ctx);
    assert.equal(r.status,200);assert.equal(r.headers.get('Cache-Control'),'no-store');assert.equal(r.headers.get('X-Badge-Status'),'suspended');assert.match(r.headers.get('Content-Type'),/image\/svg/);
    const body=await r.text();if(method==='GET'){assert.ok(body.includes('data-badge-status="suspended"'));assert.ok(body.includes('/collection'));assert.ok(!body.includes('paid_holder'));assert.ok(!body.includes('data-trust-tier='));}else assert.equal(body,'');
   }
   const holder=states.flex.entries[0].id;assert.equal(await personalEmbed(DB,user,holder,origin),null);
   const recovery=await worker.fetch(new Request(link),env,ctx);assert.equal(recovery.headers.get('Location'),origin+'/collection');assert.equal(recovery.headers.get('Cache-Control'),'no-store');
  }
  // Missing/unavailable authority cannot fall back to an otherwise valid cached image.
  const missing=await worker.fetch(new Request(urls[0]),{...env,DB:undefined},ctx);assert.equal(missing.status,503);
  const failed=await worker.fetch(new Request(urls[0]),{...env,DB:{prepare(){throw Error('D1 unavailable');}}},ctx);assert.equal(failed.status,503);
  assert.ok(primaryReads>=urls.length*7);
 }finally{await drain();DB.close();globalThis.caches=previous;}
});
