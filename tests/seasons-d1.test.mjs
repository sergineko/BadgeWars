import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createD1,seedUser,consent} from './helpers/d1.mjs';
import {settle,quote} from '../src/settlement.mjs';
import {catalog,badgeSvg} from '../public/badges.js';
import {inventory,publicProjection} from '../src/inventory.mjs';
import {personalEmbed} from '../src/embed.mjs';
import {closeDueSeasons} from '../src/seasons.mjs';
import {queryRanking} from '../public/ranking.js';
import {routeState,rankingPath,internalRoute} from '../public/routes.js';
import {seasonRemaining,seasonState} from '../public/seasons.js';
import worker from '../src/worker.mjs';
const buy=(db,userId,badge,amount,seasonId='apex-1',id=crypto.randomUUID())=>settle(db,catalog.find(b=>b.id===badge),{...consent,userId,badge,owner:'developer',amount:amount*100,seasonId},id);
const close=db=>db.sqlite.exec("UPDATE bw_flex_seasons SET status='closed',closed_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE status='open'");
const open=db=>db.sqlite.exec("INSERT INTO bw_flex_seasons(id,number,design,name) VALUES('apex-2',2,'apex-2','Season 2')");

test('Build Funded is unlimited, individual and fixed; repeat purchases or higher offers never debit',async()=>{
 const db=createD1();try{
  const users=await Promise.all(Array.from({length:12},()=>seedUser(db,{credits:200})));
  await Promise.all(users.map(id=>buy(db,id,'funded',50)));
  const prior=(await inventory(db,users[0])).items[0];
  await assert.rejects(buy(db,users[0],'funded',51),/already_owned_or_invalid_price/);
  await assert.rejects(buy(db,users[0],'funded',50),/already_owned_or_invalid_price/);
  const state=await publicProjection(db,'funded');assert.equal(state.owner,null);assert.equal(state.entries.length,12);assert.equal(state.amount,0);
  assert.ok(state.entries.every(e=>e.created_at&&!('rank'in e)&&!('amount'in e)));
  assert.equal((await quote(db,users[1],'funded')).cost,50);assert.equal((await quote(db,users[1],'funded')).alreadyOwned,true);
  assert.equal(db.sqlite.prepare('SELECT balance FROM bw_wallets WHERE user_id=?').get(users[0]).balance,150);
  assert.equal((await inventory(db,users[0])).items[0].id,prior.id);
  assert.equal(queryRanking(state.entries,{badge:'funded'}).total,12);assert.equal(queryRanking(state.entries,{badge:'funded'}).rows[0].position,undefined);
  for(const compact of [false,true]){const svg=badgeSvg('funded',prior,compact,'en');assert.match(svg,/Developer|DEVELOPER/);assert.doesNotMatch(svg,/Funded by|Rank #|50 BC/);}
 }finally{db.close();}
});

test('closing freezes final positions, preserves all season entitlements and stale attempts cannot spend in the next season',async()=>{
 const db=createD1();try{
  const a=await seedUser(db,{credits:100}),b=await seedUser(db,{credits:100});
  const actionId=crypto.randomUUID(),first=await buy(db,a,'flex',1,'apex-1',actionId);await buy(db,b,'flex',2);
  const oldCode=await personalEmbed(db,a,first.holderId,'https://badgewars.com');close(db);
  assert.equal((await quote(db,a,'flex')).seasonClosed,true);
  await assert.rejects(buy(db,a,'flex',3),/season_closed/);
  assert.throws(()=>db.sqlite.exec('UPDATE bw_flex_results SET rank=99'),/immutable_season_result/);
  assert.throws(()=>db.sqlite.exec("UPDATE bw_flex_seasons SET status='open',closed_at=NULL WHERE id='apex-1'"),/season_closed/);
  open(db);assert.equal((await quote(db,a,'flex')).level,1);assert.equal((await quote(db,a,'flex')).previous,0);
  await assert.rejects(buy(db,a,'flex',3,'apex-1'),/season_closed/);
  const fresh=await buy(db,a,'flex',1,'apex-2');assert.notEqual(fresh.holderId,first.holderId);
  const retried=await buy(db,a,'flex',1,'apex-1',actionId);assert.equal(retried.holderId,first.holderId);assert.equal(retried.balance,98);
  const items=(await inventory(db,a)).items;assert.equal(items.length,2);assert.equal(items.find(e=>e.seasonId==='apex-1').rank,2);assert.equal(items.find(e=>e.seasonId==='apex-2').rank,1);
  assert.equal((await personalEmbed(db,a,first.holderId,'https://badgewars.com')).imageUrl,oldCode.imageUrl);
  const projection=await publicProjection(db,'flex');assert.equal(projection.seasons.length,2);assert.equal(projection.owner,'developer');
  const oldRanking=queryRanking(projection.entries,{badge:'flex',season:'apex-1'});assert.deepEqual(oldRanking.rows.map(p=>p.position),[1,2]);
  db.sqlite.prepare("UPDATE bw_user_badges SET status='suspended' WHERE user_id=?").run(b);
  const after=await publicProjection(db,'flex');assert.equal(queryRanking(after.entries,{badge:'flex',season:'apex-1'}).rows[0].position,2);
  db.sqlite.prepare("UPDATE bw_user_badges SET status='active' WHERE user_id=?").run(b);
  assert.equal((await inventory(db,a)).items.find(e=>e.seasonId==='apex-1').rank,2);
  assert.match(badgeSvg('flex',items.find(e=>e.seasonId==='apex-1'),false,'en'),/Season 1|SEASON 1/);
  assert.match(badgeSvg('flex',items.find(e=>e.seasonId==='apex-1'),true,'en'),/Final rank/);
 }finally{db.close();}
});

test('an elapsed deadline closes before spending, even without cron; snapshot insertion is atomic and repeatable',async()=>{
 const db=createD1();try{
  const a=await seedUser(db,{credits:20});await buy(db,a,'flex',1);
  db.sqlite.exec("UPDATE bw_flex_seasons SET ends_at=strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 second') WHERE id='apex-1'");
  await assert.rejects(buy(db,a,'flex',2),/season_closed/);await closeDueSeasons(db);await closeDueSeasons(db);
  assert.equal(db.sqlite.prepare('SELECT balance FROM bw_wallets').get().balance,19);assert.equal(db.sqlite.prepare('SELECT count(*) AS n FROM bw_flex_results').get().n,1);
  assert.equal(db.sqlite.prepare('SELECT rank FROM bw_flex_results').get().rank,1);
 }finally{db.close();}
});

test('historical personal SVGs remain accessible with their frozen rank after a new season and still enforce suspension',async()=>{
 const DB=createD1(),previous=globalThis.caches,cache=new Map(),tasks=[];globalThis.caches={default:{match:async r=>cache.get(r.url)?.clone(),put:async(r,s)=>cache.set(r.url,s.clone()),delete:async r=>cache.delete(r.url)}};
 try{
  const a=await seedUser(DB,{credits:20}),b=await seedUser(DB,{credits:20}),owned=await buy(DB,a,'flex',1);await buy(DB,b,'flex',2);close(DB);open(DB);await buy(DB,a,'flex',1,'apex-2');
  const env={DB,APP_URL:'https://badgewars.com',BADGES:{get(){throw Error('personal Flex does not depend on KV');}}},ctx={waitUntil:p=>tasks.push(p)},url=(await personalEmbed(DB,a,owned.holderId,env.APP_URL)).imageUrl;
  let response=await worker.fetch(new Request(url),env,ctx);assert.equal(response.status,200);let body=await response.text();assert.match(body,/Final rank/);assert.match(body,/#02/);assert.match(body,/SEASON 1/);
  DB.sqlite.prepare('UPDATE bw_wallets SET frozen=1 WHERE user_id=?').run(a);response=await worker.fetch(new Request(url),env,ctx);assert.equal(response.headers.get('X-Badge-Status'),'suspended');assert.doesNotMatch(await response.text(),/developer/);
  DB.sqlite.prepare('UPDATE bw_wallets SET frozen=0 WHERE user_id=?').run(a);response=await worker.fetch(new Request(url),env,ctx);assert.match(await response.text(),/#02/);
 }finally{await Promise.all(tasks);globalThis.caches=previous;DB.close();}
});

test('season routes and countdowns keep clean URLs and an open-ended season has no fictitious countdown',()=>{
 const path=rankingPath('bids','flex','apex-2'),route=routeState('https://badgewars.com'+path);assert.equal(route.page,'/leaderboard');assert.equal(route.season,'apex-2');assert.equal(route.path,path);assert.ok(internalRoute(path,'https://badgewars.com'));assert.equal(internalRoute('/leaderboard/flex/../../api/me','https://badgewars.com'),null);
 assert.equal(seasonState({status:'open',endsAt:null}),'open');assert.equal(seasonRemaining({endsAt:null}),null);assert.equal(seasonState({status:'closed'}),'closed');
 assert.deepEqual(seasonRemaining({endsAt:'2026-12-02T01:02:03Z'},Date.parse('2026-12-01T00:00:00Z')),{days:1,hours:1,minutes:2,seconds:3});
});

test('a single initial leaderboard has no season labels in either SVG style; labels appear only with another season',async()=>{
 const db=createD1();try{
  const a=await seedUser(db,{credits:10});await buy(db,a,'flex',1);
  let item=(await inventory(db,a)).items[0];assert.equal(item.showSeason,0);
  for(const lang of ['es','en'])for(const compact of [false,true])assert.doesNotMatch(badgeSvg('flex',item,compact,lang),/temporada|season/i);
  assert.equal((await publicProjection(db,'flex')).showSeason,false);
  close(db);open(db);item=(await inventory(db,a)).items[0];assert.equal(item.showSeason,1);
  for(const compact of [false,true])assert.match(badgeSvg('flex',item,compact,'en'),/season 1/i);
 }finally{db.close();}
});

test('a review arriving after the deadline cannot rewrite final positions before the closing cron runs',async()=>{
 const db=createD1();try{
  const a=await seedUser(db,{credits:10}),b=await seedUser(db,{credits:10});
  const first=await buy(db,a,'flex',1),second=await buy(db,b,'flex',2);
  db.sqlite.exec("UPDATE bw_flex_seasons SET ends_at=strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 second') WHERE id='apex-1'");
  db.sqlite.prepare('UPDATE bw_wallets SET frozen=1 WHERE user_id=?').run(b);
  db.sqlite.prepare("UPDATE bw_user_badges SET status='suspended' WHERE user_id=?").run(b);
  assert.equal(db.sqlite.prepare('SELECT rank FROM bw_flex_results WHERE holder_id=?').get(second.holderId).rank,1);
  assert.equal(db.sqlite.prepare('SELECT rank FROM bw_flex_results WHERE holder_id=?').get(first.holderId).rank,2);
 }finally{db.close();}
});

test('the populated migration preserves holder IDs, Trust Bag contributors, actions and wallet balances',async()=>{
 const db=createD1(':memory:',13);try{
  const user=await seedUser(db,{credits:100}),donor=await seedUser(db,{credits:5}),holder=crypto.randomUUID(),flex=crypto.randomUUID();
  db.sqlite.prepare("INSERT INTO bw_user_badges(id,user_id,badge,owner,level) VALUES(?,?,'quality','trusted',20)").run(holder,user);
  db.sqlite.prepare("INSERT INTO bw_user_badges(id,user_id,badge,owner,level) VALUES(?,?,'flex','historic',1)").run(flex,user);
  db.sqlite.prepare("INSERT INTO bw_contributors(holder_id,user_id,alias,points,contributions) VALUES(?,?,'donor','5',1)").run(holder,donor);
  const legacyAction=crypto.randomUUID();
  db.sqlite.prepare('INSERT INTO bw_terms_documents(version,locale,document) VALUES(?,?,?)').run('2026-10-19-r9','es',JSON.stringify({version:'2026-10-19-r9',sections:[]}));
  db.sqlite.prepare("INSERT INTO bw_actions(id,user_id,badge,kind,owner,level,cost,holder_id,terms_version,terms_locale,execution_requested,withdrawal_acknowledged) VALUES(?,?,'flex','claim','developer',2,1,?,'2026-10-19-r9','es',1,1)").run(legacyAction,user,flex);
  db.sqlite.exec('BEGIN');db.sqlite.exec(readFileSync('migrations/0014_badge_seasons.sql','utf8'));db.sqlite.exec('COMMIT');
  assert.equal(db.sqlite.prepare('SELECT holder_id FROM bw_contributors').get().holder_id,holder);assert.equal(db.sqlite.prepare('SELECT season_id FROM bw_user_badges WHERE id=?').get(flex).season_id,'apex-1');
  assert.equal(db.sqlite.prepare('SELECT balance FROM bw_wallets WHERE user_id=?').get(user).balance,99);assert.deepEqual(db.sqlite.prepare('PRAGMA foreign_key_check').all(),[]);
  assert.equal((await buy(db,user,'flex',2,'apex-1',legacyAction)).balance,99);
  assert.equal(db.sqlite.prepare('SELECT terms_version FROM bw_actions WHERE id=?').get(legacyAction).terms_version,'2026-10-19-r9');
  await buy(db,user,'flex',3);assert.equal((await inventory(db,user)).items.find(p=>p.badgeId==='flex').id,flex);
 }finally{db.close();}
});
