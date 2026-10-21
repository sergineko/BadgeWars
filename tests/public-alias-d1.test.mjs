import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createD1,seedUser,consent} from './helpers/d1.mjs';
import {changeAlias,readAlias,ALIAS_INTERVAL} from '../src/public-alias.mjs';
import {hash} from '../src/auth.mjs';
import worker from '../src/worker.mjs';
import {settle} from '../src/settlement.mjs';
import {inventory,privateSupporters,publicProjection,setVisibility} from '../src/inventory.mjs';
import {personalEmbed} from '../src/embed.mjs';
import {catalog} from '../public/badges.js';

const origin='https://badges.example';
const rewind=(db,user)=>db.sqlite.prepare("UPDATE bw_users SET alias_changed_at=CAST(strftime('%s','now') AS INTEGER)-1209600 WHERE id=?").run(user);
async function session(db,user){const token=crypto.randomUUID();await db.prepare('INSERT INTO bw_sessions(token_hash,user_id,expires) VALUES(?,?,?)').bind(await hash(token),user,Date.now()+600000).run();return {'Cookie':'bw_session='+token,Origin:origin};}

test('aliases are case-insensitively unique, validated and locked for fourteen days, including case-only edits',async()=>{
 const db=createD1();try{
  const a=await seedUser(db),b=await seedUser(db);
  assert.equal((await readAlias(db,a)).alias,null);
  for(const alias of ['a','x'.repeat(25),'has space','with-dash','álias','<script>'])assert.equal((await changeAlias(db,a,alias)).error,'alias_invalid');
  assert.equal((await changeAlias(db,a,'bw_user_9')).error,'alias_reserved');
  const saved=await changeAlias(db,a,' @First_Name ');assert.equal(saved.status,200);assert.equal(saved.profile.alias,'First_Name');assert.equal(saved.profile.canChangeAlias,false);assert.equal(saved.profile.nextAliasChangeAt-saved.profile.aliasChangedAt,ALIAS_INTERVAL);
  assert.equal((await changeAlias(db,b,'first_name')).error,'alias_taken');assert.equal((await readAlias(db,b)).alias,null);
  assert.equal((await changeAlias(db,a,'Second_Name')).error,'alias_locked');assert.equal((await changeAlias(db,a,'first_name')).error,'alias_locked');
  const unchanged=await changeAlias(db,a,'First_Name');assert.equal(unchanged.profile.aliasChangedAt,saved.profile.aliasChangedAt);
  assert.throws(()=>db.sqlite.prepare("UPDATE bw_users SET public_alias='bypass',alias_changed_at=CAST(strftime('%s','now') AS INTEGER) WHERE id=?").run(a),/alias_locked/);
  db.sqlite.prepare("UPDATE bw_users SET alias_changed_at=CAST(strftime('%s','now') AS INTEGER)-1209599 WHERE id=?").run(a);
  assert.equal((await changeAlias(db,a,'Second_Name')).error,'alias_locked');
  rewind(db,a);const changed=await changeAlias(db,a,'Second_Name');assert.equal(changed.status,200);assert.equal(changed.profile.canChangeAlias,false);
  assert.equal((await changeAlias(db,b,'first_name')).status,200);
 }finally{db.close();}
});

test('simultaneous alias reservations and two competing edits cannot bypass D1 uniqueness or cooldown',async()=>{
 const db=createD1();try{
  const a=await seedUser(db),b=await seedUser(db),c=await seedUser(db);
  const same=await Promise.all([changeAlias(db,a,'Race_Name'),changeAlias(db,b,'race_name')]);assert.equal(same.filter(r=>r.status===200).length,1);assert.equal(same.filter(r=>r.error==='alias_taken').length,1);
  const edits=await Promise.all([changeAlias(db,c,'FirstChoice'),changeAlias(db,c,'SecondChoice')]);assert.equal(edits.filter(r=>r.status===200).length,1);assert.equal(edits.filter(r=>r.error==='alias_locked').length,1);
 }finally{db.close();}
});

test('profile changes require the owner session and origin; purchases cannot use an arbitrary or stale public alias',async()=>{
 const DB=createD1(),tasks=[];try{
  const user=await seedUser(DB,{credits:100}),other=await seedUser(DB),headers=await session(DB,user),env={DB,APP_URL:origin,AUTH_COOKIE_SECRET:'a-long-cookie-secret-for-public-alias-tests'};
  const call=(path,body,extra={})=>worker.fetch(new Request(origin+path,{method:body?'POST':'GET',headers:{...headers,...extra},...(body?{body:JSON.stringify(body)}:{})}),env,{waitUntil:job=>tasks.push(job)});
  assert.equal((await call('/api/me/profile',{alias:'ChosenName'},{Cookie:''})).status,401);
  assert.equal((await call('/api/me/profile',{alias:'ChosenName'},{Origin:'https://evil.example'})).status,403);
  const input={...consent,badge:'bait',owner:'ChosenName',amount:500};
  assert.equal((await (await call('/api/wallet/spend',input,{'Idempotency-Key':crypto.randomUUID()})).json()).error,'alias_required');
  const response=await call('/api/me/profile',{alias:'ChosenName',userId:other});assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');assert.equal((await readAlias(DB,other)).alias,null);
  const auth=await call('/api/auth/me');assert.equal((await auth.json()).user.alias,'ChosenName');
  assert.equal((await (await call('/api/wallet/spend',{...input,owner:'Impersonated'},{'Idempotency-Key':crypto.randomUUID()})).json()).error,'alias_changed');
  assert.equal((await call('/api/wallet/spend',input,{'Idempotency-Key':crypto.randomUUID()})).status,200);
  rewind(DB,user);assert.equal((await changeAlias(DB,user,'UpdatedName')).status,200);
  await assert.rejects(settle(DB,catalog[1],{...consent,userId:user,owner:'ChosenName',amount:600},crypto.randomUUID()),/alias_changed/);
  assert.equal(DB.sqlite.prepare('SELECT balance FROM bw_wallets WHERE user_id=?').get(user).balance,95);
 }finally{await Promise.all(tasks);DB.close();}
});

test('renaming updates every personal badge, closed results display and donor visibility without rewriting history or rank ties',async()=>{
 const db=createD1();try{
  const user=await seedUser(db,{credits:2000}),donor=await seedUser(db,{credits:10}),owned=[];
  for(const badge of catalog)owned.push(await settle(db,badge,{...consent,userId:user,owner:'LegacyOwner',amount:badge.base},crypto.randomUUID()));
  const bag=owned.find(b=>b.badgeId==='quality');await settle(db,catalog[3],{...consent,userId:donor,owner:'LegacyDonor',kind:'support',targetId:bag.holderId,amount:200},crypto.randomUUID());await setVisibility(db,user,bag.holderId,1);
  db.sqlite.prepare("UPDATE bw_flex_seasons SET status='closed',closed_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='apex-1'").run();
  const previous=(await inventory(db,user)).items,history=db.sqlite.prepare('SELECT owner,level,cost,created_at FROM bw_actions ORDER BY id').all(),results=db.sqlite.prepare('SELECT * FROM bw_flex_results').all();
  assert.equal((await changeAlias(db,user,'CurrentOwner')).status,200);assert.equal((await changeAlias(db,donor,'CurrentDonor')).status,200);
  const current=(await inventory(db,user)).items;assert.equal(current.length,previous.length);
  for(const p of current){const before=previous.find(r=>r.id===p.id);assert.equal(p.owner,'CurrentOwner');for(const key of ['id','rank','amount','edition','points','created_at','updated_at','seasonId'])assert.equal(p[key],before[key],key);const embed=await personalEmbed(db,user,p.id,origin);assert.equal(embed.owner,'CurrentOwner');assert.ok(embed.code.includes('@CurrentOwner'));}
  assert.deepEqual(db.sqlite.prepare('SELECT owner,level,cost,created_at FROM bw_actions ORDER BY id').all(),history);assert.deepEqual(db.sqlite.prepare('SELECT * FROM bw_flex_results').all(),results);
  const supporters=await privateSupporters(db,user,bag.holderId);assert.equal(supporters.supporters[0].alias,'CurrentDonor');assert.deepEqual(supporters.topSupporters,['CurrentDonor']);
  for(const badge of catalog){const state=await publicProjection(db,badge.id);assert.equal(state.entries[0].owner,'CurrentOwner');assert.equal(db.sqlite.prepare('SELECT dirty FROM bw_badges WHERE id=?').get(badge.id).dirty,1);}
 }finally{db.close();}
});

test('personal SVGs refresh names and ETags immediately even while KV and old edge renders retain the previous alias',async()=>{
 const DB=createD1(),previous=globalThis.caches,cache=new Map(),tasks=[];
 globalThis.caches={default:{match:async key=>cache.get(key.url)?.clone(),put:async(key,value)=>cache.set(key.url,value.clone()),delete:async key=>cache.delete(key.url)}};
 try{
  const user=await seedUser(DB,{credits:2000}),owned=[];for(const badge of catalog)owned.push(await settle(DB,badge,{...consent,userId:user,owner:'OldName',amount:badge.base},crypto.randomUUID()));
  const states=Object.fromEntries(await Promise.all(catalog.map(async b=>[b.id,await publicProjection(DB,b.id)]))),env={DB,APP_URL:origin,BADGES:{get:async key=>structuredClone(states[key.slice(6)])}},ctx={waitUntil:job=>tasks.push(job)},tags={};
  for(const badge of owned){const res=await worker.fetch(new Request(origin+'/badges/'+badge.badgeId+'.svg?claim='+badge.holderId),env,ctx);tags[badge.badgeId]=res.headers.get('ETag');assert.ok((await res.text()).includes('@OldName'));}await Promise.all(tasks.splice(0));
  await changeAlias(DB,user,'NewName');
  for(const badge of owned){const res=await worker.fetch(new Request(origin+'/badges/'+badge.badgeId+'.svg?claim='+badge.holderId,{headers:{'If-None-Match':tags[badge.badgeId]}}),env,ctx);assert.equal(res.status,200);assert.notEqual(res.headers.get('ETag'),tags[badge.badgeId]);const text=await res.text();assert.ok(text.includes('@NewName'));assert.ok(!text.includes('@OldName'));}
 }finally{await Promise.all(tasks);globalThis.caches=previous;DB.close();}
});

test('populated alias migration resolves legacy collisions and invalid names without changing holdings, balances or closed results',async()=>{
 const db=createD1(':memory:',15);try{
  const users=await Promise.all(Array.from({length:4},()=>seedUser(db,{credits:50})));
  for(const [i,name] of ['SameName','samename','bad alias','bw_user_1'].entries())db.sqlite.prepare("INSERT INTO bw_user_badges(id,user_id,badge,owner,level) VALUES(?,?,'funded',?,50)").run(crypto.randomUUID(),users[i],name);
  const before=db.sqlite.prepare('SELECT * FROM bw_user_badges ORDER BY id').all();db.sqlite.exec(readFileSync('migrations/0016_public_alias.sql','utf8'));
  const names=db.sqlite.prepare('SELECT public_alias,alias_changed_at FROM bw_users').all();assert.equal(new Set(names.map(r=>r.public_alias.toLowerCase())).size,4);assert.equal(names.filter(r=>r.public_alias.toLowerCase()==='samename').length,1);assert.ok(names.every(r=>r.alias_changed_at===null&&/^[A-Za-z0-9_]{2,24}$/.test(r.public_alias)));
  assert.deepEqual(db.sqlite.prepare('SELECT * FROM bw_user_badges ORDER BY id').all(),before);assert.deepEqual(db.sqlite.prepare('PRAGMA foreign_key_check').all(),[]);assert.ok(db.sqlite.prepare('SELECT balance FROM bw_wallets').all().every(r=>r.balance===50));
 }finally{db.close();}
});
