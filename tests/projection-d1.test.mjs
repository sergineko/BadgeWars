import test from 'node:test';
import assert from 'node:assert/strict';
import {createD1,seedUser,consent} from './helpers/d1.mjs';
import {publish} from '../src/projection.mjs';
import {throttle} from '../src/db.mjs';
import {settle,quote} from '../src/settlement.mjs';
import {catalog} from '../public/badges.js';

test('publication respects the shared 900-write daily budget and keeps dirty work when KV fails',async()=>{
 const db=createD1(),writes=[];try{
  const env={APP_URL:'https://badges.example',BADGES:{put:async(key,value)=>writes.push([key,JSON.parse(value)])}};
  db.sqlite.prepare('INSERT INTO bw_kv_budget(day,writes) VALUES(?,899)').run(new Date().toISOString().slice(0,10));
  assert.equal(await publish(db,env,'flex'),true);assert.equal(writes.length,1);assert.ok(writes[0][1].publishedAt);assert.equal(await publish(db,env,'bait'),false);assert.equal(db.sqlite.prepare("SELECT dirty FROM bw_badges WHERE id='bait'").get().dirty,1);assert.equal(db.sqlite.prepare('SELECT writes FROM bw_kv_budget').get().writes,900);
  db.sqlite.exec('UPDATE bw_kv_budget SET writes=0');env.BADGES.put=async()=>{throw Error('KV unavailable');};await assert.rejects(publish(db,env,'bait'),/KV unavailable/);assert.deepEqual({...db.sqlite.prepare("SELECT dirty,lease_until FROM bw_badges WHERE id='bait'").get()},{dirty:1,lease_until:0});
 }finally{db.close();}
});

test('D1 throttle remains effective across Worker instances and conflicting levels leave the losing balance intact',async()=>{
 const db=createD1();try{
  assert.equal(await throttle(db,'key',2),true);assert.equal(await throttle(db,'key',2),true);assert.equal(await throttle(db,'key',2),false);
  const a=await seedUser(db,{credits:200}),b=await seedUser(db,{credits:200}),buy=user=>settle(db,catalog[0],{...consent,userId:user,amount:10000,owner:'holder'},crypto.randomUUID());
  const result=await Promise.allSettled([buy(a),buy(b)]);assert.equal(result.filter(r=>r.status==='fulfilled').length,1);assert.equal(db.sqlite.prepare('SELECT sum(balance) AS n FROM bw_wallets').get().n,300);
  const first=db.sqlite.prepare('SELECT user_id FROM bw_user_badges').get().user_id;db.sqlite.prepare("UPDATE bw_user_badges SET status='suspended' WHERE user_id=?").run(first);const q=await quote(db,first===a?b:a,'flex');assert.equal(q.level,100);
 }finally{db.close();}
});
