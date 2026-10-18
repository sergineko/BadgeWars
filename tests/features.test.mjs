import test from 'node:test';
import assert from 'node:assert/strict';
import {messages,translate} from '../public/i18n.js';
import {queryRanking} from '../public/ranking.js';
import {demoEntries} from '../public/demo.js';
import {catalog,badgeSvg,money} from '../public/badges.js';
import {seal,unseal,authRoute,identity} from '../src/auth.mjs';
test('both languages cover the same copy and interpolate pagination',()=>{
 assert.deepEqual(Object.keys(messages.es),Object.keys(messages.en));for(const locale of ['es','en'])for(const value of Object.values(messages[locale]))assert.equal(typeof value,'string');
 assert.equal(translate('en','page',{page:2,total:3}),'Page 2 of 3');assert.equal(translate('es','page',{page:2,total:3}),'Página 2 de 3');
});
test('one credit ranking paginates and searches without losing global positions',()=>{
 const result=queryRanking(demoEntries);assert.equal(result.rows.length,10);assert.ok(result.rows.every(p=>p.currency==='credits'));assert.equal(result.pages,2);
 assert.equal(queryRanking(demoEntries,{badge:'genesis'}).total,3);assert.equal(queryRanking(demoEntries,{currency:'eur'}).total,0);
 const search=queryRanking(demoEntries,{search:'@SHIPIT'});assert.equal(search.total,2);assert.equal(search.rows[0].position,5);
 assert.equal(queryRanking(demoEntries,{search:'doesnotexist',page:999}).page,1);
 assert.equal(queryRanking(demoEntries,{page:2}).rows.length,5);
});
test('Genesis is fixed at 1000 BC with no seasons; localized SVGs have isolated paint IDs',()=>{
 const b=catalog.find(b=>b.id==='genesis');assert.equal(b.base,100000);assert.equal(b.currency,'credits');
 assert.ok(money(100000,'credits','es').includes('1.000'));
 const first=badgeSvg('genesis',{owner:'collector',edition:1,amount:100000},false,'es');const second=badgeSvg('genesis',{owner:'collector',edition:1,amount:100000},false,'en');
 assert.ok(first.includes('Propietario 1 de 10'));assert.ok(second.includes('Owner 1 of 10'));assert.ok(!first.includes('SEASON'));
 assert.notEqual(first.match(/id="([^"]+-metal)"/)[1],second.match(/id="([^"]+-metal)"/)[1]);
});
test('encrypted sessions reject tampering and the wrong secret',async()=>{
 const secret='a-long-random-cookie-secret-for-testing';const encrypted=await seal({access_token:'private-token'},secret);assert.ok(!encrypted.includes('private-token'));
 assert.deepEqual(await unseal(encrypted,secret),{access_token:'private-token'});assert.equal(await unseal(encrypted,'wrong'),null);assert.equal(await unseal('invalid',secret),null);
 const [iv,cipher]=encrypted.split('.');assert.equal(await unseal(iv+'.'+(cipher[0]==='A'?'B':'A')+cipher.slice(1),secret),null);
});
