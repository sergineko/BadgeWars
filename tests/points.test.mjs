import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePoints,pointsOf,formatPoints,shortPoints,trustTier} from '../public/points.js';
import {queryRanking} from '../public/ranking.js';
import {badgeSvg} from '../public/badges.js';
test('point formatting and comparisons keep arbitrarily large integer scores exact',()=>{
 const value='900719925474099199999999999999999';
 assert.equal(normalizePoints('000287'),'287');assert.equal(normalizePoints('1e5'),'0');assert.equal(pointsOf({supportTotal:28700}),'287');
 assert.equal(formatPoints(value,'en').replaceAll(',',''),value);assert.equal(formatPoints(value,'es').replaceAll('.',''),value);assert.ok(shortPoints(value).includes('×10^32'));
});
test('community trust ranks by points, keeps global positions when searching and separates money rankings',()=>{
 const rows=[['older','900719925474099200000',1],['newer','900719925474099200000',2],['higher','900719925474099200001',3],['zero','0',4]].map(([owner,points,n])=>({owner,points,badgeId:'quality',id:String(n),created_at:`2026-10-16T00:00:00.00000${n}Z`}));
 rows.push({id:'bid',badgeId:'flex',owner:'rich',amount:10000000,currency:'credits',created_at:'2026-10-15T00:00:00Z'});
 const result=queryRanking(rows,{metric:'trust',currency:'eur',size:2});assert.equal(result.total,4);assert.deepEqual(result.rows.map(p=>p.owner),['higher','older']);
 const found=queryRanking(rows,{metric:'trust',search:'newer'});assert.equal(found.rows[0].position,3);assert.equal(queryRanking(rows,{metric:'trust',page:2,size:2}).rows.at(-1).points,'0');
 assert.equal(queryRanking(rows).total,1);assert.equal(queryRanking(rows).rows[0].badgeId,'flex');
});
test('both Trust Bag SVG styles show points and trust rank, with no monetary score',()=>{
 for(const locale of ['es','en'])for(const compact of [false,true]){
  const svg=badgeSvg('quality',{owner:'holder',points:'287',rank:2,amount:2000,currency:'usd'},compact,locale);
  assert.ok(svg.includes('287 pts'));assert.ok(svg.includes('#2'));assert.ok(!svg.includes('$'));assert.ok(!svg.includes('USD'));assert.ok(!svg.includes('US$'));
 }
 const huge='1234567890123456789012345678901234567890',svg=badgeSvg('quality',{owner:'holder',points:huge});assert.ok(svg.includes('×10^39'));assert.ok(!svg.includes('Infinity'));assert.ok(!svg.includes('NaN'));
});
test('rank controls the visual trust tier, and zero support never earns a high-trust label',()=>{
 const holder={owner:'holder',points:'287'};
 for(const [rank,tier] of [[1,'leader'],[2,'podium'],[3,'podium'],[4,'established'],[10,'established'],[11,'rising']]){
  assert.equal(trustTier({...holder,rank}).id,tier);
  for(const compact of [false,true]){
   const svg=badgeSvg('quality',{...holder,rank},compact,'es');assert.ok(svg.includes(`data-trust-tier="${tier}"`));assert.ok(svg.includes('#'+String(rank).padStart(2,'0')));
  }
 }
 const empty=badgeSvg('quality',{owner:'new_holder',points:'0',rank:1},false,'es');assert.ok(empty.includes('Sin apoyo todavía'));assert.ok(empty.includes('data-trust-tier="unproven"'));
 assert.equal(trustTier({points:'0'}).id,'preview');
});
