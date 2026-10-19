import test from 'node:test';
import assert from 'node:assert/strict';
import {embedFallback,resilientEmbed} from '../public/embed-fallback.js';
import {personalEmbed} from '../src/embed.mjs';
import {createD1,seedUser,consent} from './helpers/d1.mjs';
import {settle} from '../src/settlement.mjs';
import {catalog} from '../public/badges.js';

test('connection fallback is self-contained and never presents an unverified rank or paid entitlement',()=>{
 for(const locale of ['es','en'])for(const compact of [false,true]){
  const fallback=embedFallback(locale,compact),html=resilientEmbed('https://badgewars.com/badges/flex/example/en.svg','https://badgewars.com/b/example','Flex · @collector',locale,compact);
  assert.ok(fallback.svg.includes(locale==='es'?'Estado sin verificar':'Status unverified'));
  assert.ok(!/\b(?:href|src)=|<script|<image|foreignObject|Rank|Paid|\bBC\b/.test(fallback.svg));
  assert.ok(!/<img\b|<script\b|\bon\w+=|<object\b/.test(html));
  assert.ok(html.includes('background-image:url(&quot;https://badgewars.com/badges/flex/example/en.svg&quot;)'));
  assert.equal((html.match(/https:\/\/badgewars.com\//g)||[]).length,2);
  assert.ok(html.includes('max-width:100%'));assert.ok(html.includes(fallback.svg));
 }
 assert.ok(resilientEmbed('https://badgewars.com/a','https://badgewars.com/b','<unsafe>"').includes('&lt;unsafe&gt;&quot;'));
});

test('resilient embed stays personal and is unavailable for suspended or unpaid inventory',async()=>{
 const db=createD1();try{
  const user=await seedUser(db,{credits:100}),other=await seedUser(db,{credits:100});
  const badge=await settle(db,catalog[0],{...consent,userId:user,amount:100,owner:'collector'},crypto.randomUUID());
  const embed=await personalEmbed(db,user,badge.holderId,'https://badgewars.com',{format:'html-safe',locale:'es'});
  assert.ok(embed.code.includes('Estado sin verificar'));assert.ok(embed.code.includes(embed.imageUrl));assert.ok(embed.code.includes(embed.targetUrl));
  assert.equal(await personalEmbed(db,other,badge.holderId,'https://badgewars.com',{format:'html-safe'}),null);
  for(const sql of ["UPDATE bw_wallets SET frozen=1 WHERE user_id=?","UPDATE bw_wallets SET frozen=0,debt=1 WHERE user_id=?"]){db.sqlite.prepare(sql).run(user);assert.equal(await personalEmbed(db,user,badge.holderId,'https://badgewars.com',{format:'html-safe'}),null);}
  db.sqlite.prepare('UPDATE bw_wallets SET debt=0 WHERE user_id=?').run(user);db.sqlite.prepare("UPDATE bw_user_badges SET status='suspended' WHERE id=?").run(badge.holderId);
  assert.equal(await personalEmbed(db,user,badge.holderId,'https://badgewars.com',{format:'html-safe'}),null);
 }finally{db.close();}
});
