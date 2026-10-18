import test from 'node:test';import assert from 'node:assert/strict';
import {createD1,seedUser,consent} from './helpers/d1.mjs';
import {settle,quote} from '../src/settlement.mjs';import {catalog} from '../public/badges.js';
import {inventory,privateSupporters,publicProjection,setVisibility} from '../src/inventory.mjs';
const buy=(db,userId,badge,amount,extra={},id=crypto.randomUUID())=>settle(db,catalog.find(b=>b.id===badge),{...consent,userId,badge,owner:'holder',amount:amount*100,...extra},id);

test('Apex opens at 1 BC; competing bids at the same level charge only the first committed action',async()=>{
 const db=createD1();try{
  const a=await seedUser(db,{credits:5}),b=await seedUser(db,{credits:5});
  assert.equal((await quote(db,a,'flex')).level,1);assert.equal(catalog.find(b=>b.id==='flex').base,100);
  const results=await Promise.allSettled([buy(db,a,'flex',1),buy(db,b,'flex',1)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.match(results.find(r=>r.status==='rejected').reason.message,/price_changed/);
  const winner=results[0].status==='fulfilled'?a:b,loser=winner===a?b:a;
  assert.equal(db.sqlite.prepare('SELECT balance FROM bw_wallets WHERE user_id=?').get(winner).balance,4);
  assert.equal(db.sqlite.prepare('SELECT balance FROM bw_wallets WHERE user_id=?').get(loser).balance,5);
  assert.equal(db.sqlite.prepare("SELECT count(*) AS n FROM bw_ledger WHERE kind='spend'").get().n,1);
  assert.equal(db.sqlite.prepare('SELECT count(*) AS n FROM bw_actions').get().n,1);
  assert.equal((await quote(db,loser,'flex')).level,2);
  await buy(db,loser,'flex',2);const renewed=await buy(db,winner,'flex',3);
  assert.equal(renewed.cost,2);assert.equal((await inventory(db,winner)).items.length,1);
 }finally{db.close();}
});
test('D1 applies wallet debit, cumulative level and stable inventory atomically; renewals pay only the difference',async()=>{
 const db=createD1();try{const a=await seedUser(db,{credits:500}),b=await seedUser(db,{credits:500});
 const first=await buy(db,a,'flex',100);assert.equal(first.cost,100);await buy(db,b,'flex',101);
 const id=crypto.randomUUID(),renewed=await buy(db,a,'flex',102,{},id);assert.equal(renewed.cost,2);assert.equal(renewed.balance,398);assert.equal(renewed.holderId,first.holderId);
 const retried=await buy(db,a,'flex',102,{},id);assert.equal(retried.cost,2);assert.equal(retried.balance,398);
 await assert.rejects(buy(db,b,'flex',103,{},id),/idempotency_conflict/);
 assert.equal((await inventory(db,a)).items.length,1);assert.equal((await inventory(db,a)).items[0].rank,1);
 const q=await quote(db,b,'flex');assert.equal(q.level,103);assert.equal(q.previous,101);assert.equal(q.cost,2);
 const before=db.sqlite.prepare('SELECT count(*) AS n FROM bw_actions').get().n;await assert.rejects(buy(db,b,'flex',102),/price_changed/);assert.equal(db.sqlite.prepare('SELECT count(*) AS n FROM bw_actions').get().n,before);
 }finally{db.close();}
});
test('insufficient balance rolls back action and inventory; ledger is append-only',async()=>{
 const db=createD1();try{const user=await seedUser(db,{credits:5});await assert.rejects(buy(db,user,'flex',100),/insufficient_credits/);assert.equal((await inventory(db,user)).items.length,0);assert.equal(db.sqlite.prepare('SELECT balance FROM bw_wallets WHERE user_id=?').get(user).balance,5);assert.equal(db.sqlite.prepare('SELECT count(*) AS n FROM bw_actions').get().n,0);assert.throws(()=>db.sqlite.exec('DELETE FROM bw_ledger'),/immutable_ledger/);assert.throws(()=>db.sqlite.exec('UPDATE bw_ledger SET delta=1000'),/immutable_ledger/);}finally{db.close();}
});
test('exact trust totals grow beyond integer precision; donor amounts remain private and only 0–5 aliases are published',async()=>{
 const db=createD1();try{const owner=await seedUser(db,{credits:100}),a=await seedUser(db,{credits:100}),b=await seedUser(db,{credits:100});const bag=await buy(db,owner,'quality',20);assert.equal((await inventory(db,owner)).items[0].points,'0');
 await buy(db,a,'quality',5,{kind:'support',targetId:bag.holderId,owner:'alpha'});await buy(db,a,'quality',7,{kind:'support',targetId:bag.holderId,owner:'alpha_new'});await buy(db,b,'quality',3,{kind:'support',targetId:bag.holderId,owner:'beta'});
 const priv=await privateSupporters(db,owner,bag.holderId);assert.equal(priv.points,'15');assert.equal(priv.supporterCount,2);assert.equal(priv.supporters[0].points,'12');assert.equal(priv.supporters[0].alias,'alpha_new');assert.equal(await privateSupporters(db,a,bag.holderId),null);assert.deepEqual((await publicProjection(db,'quality')).entries[0].topSupporters,[]);
 assert.equal(await setVisibility(db,a,bag.holderId,2),false);await setVisibility(db,owner,bag.holderId,2);const pub=(await publicProjection(db,'quality')).entries[0];assert.deepEqual(pub.topSupporters,['alpha_new','beta']);assert.equal(pub.user_id,undefined);assert.equal(pub.amount,undefined);await assert.rejects(setVisibility(db,owner,bag.holderId,6),/invalid_visibility/);
 await assert.rejects(buy(db,owner,'quality',1,{kind:'support',targetId:bag.holderId}),/invalid_support/);
 db.sqlite.prepare('UPDATE bw_user_badges SET points=? WHERE id=?').run('999999999999999999999999999999999999',bag.holderId);await buy(db,b,'quality',1,{kind:'support',targetId:bag.holderId});assert.equal((await inventory(db,owner)).items[0].points,'1000000000000000000000000000000000000');
 }finally{db.close();}
});
test('only ten Genesis slots can ever be issued and a repeated account cannot obtain a second edition',async()=>{
 const db=createD1();try{const users=[];for(let i=0;i<11;i++)users.push(await seedUser(db,{credits:3000}));for(let i=0;i<10;i++)await buy(db,users[i],'genesis',1000);
 await assert.rejects(buy(db,users[0],'genesis',1000),/already_owned/);await assert.rejects(buy(db,users[10],'genesis',1000),/genesis_sold_out/);const state=await publicProjection(db,'genesis');assert.equal(state.sold,10);assert.equal(state.owner,null);assert.equal(new Set(state.entries.map(r=>r.edition)).size,10);assert.equal(db.sqlite.prepare('SELECT balance FROM bw_wallets WHERE user_id=?').get(users[10]).balance,3000);
 }finally{db.close();}
});
