import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {legalPageHtml} from '../src/legal-page.mjs';
import {pageInfo} from '../public/page-info.js';

test('public entry pages contain the actual catalog before JavaScript without embedding accounts or invented live prices',()=>{
 const home=readFileSync('public/index.html','utf8');
 for(const badge of ['The Apex Flex','Build Funded','Genesis','Trust Bag'])assert.ok(home.includes(badge));
 assert.ok(home.includes('class="hero"'));assert.ok(home.includes('id="arena"'));assert.ok(home.includes('id="how"'));
 assert.equal((home.match(/<h1>/g)||[]).length,1);assert.ok(!home.includes('Dynamic SVG badges</h1>'));
 assert.ok(!home.includes('href="/fonts/dm-sans-0.ttf"'));assert.ok(!home.includes('data-personal='));
 assert.ok(!home.includes('class="price">1.000'));assert.ok(home.includes('class="price">—'));
 for(const badge of ['flex','bait','funded','trust','genesis']){
  const html=readFileSync(`public/leaderboard/${badge}/index.html`,'utf8');assert.ok(html.includes('class="ranking-page"'));
  assert.ok(html.includes(`rel="canonical" href="https://badgewars.com/leaderboard/${badge}"`));
 }
});

test('discovery resources are real text/JSON and advertise only public read-only resources',()=>{
 const robots=readFileSync('public/robots.txt','utf8'),guide=readFileSync('public/llms.txt','utf8');
 assert.ok(robots.includes('Sitemap: https://badgewars.com/sitemap.xml'));assert.ok(!robots.includes('<html'));
 assert.ok(guide.startsWith('# BadgeWars\n'));assert.ok(guide.includes('https://badgewars.com/terms'));
 const ard=JSON.parse(readFileSync('public/.well-known/ard.json','utf8'));
 assert.deepEqual(ard,JSON.parse(readFileSync('public/.well-known/ai-catalog.json','utf8')));
 for(const entry of ard.entries){assert.match(entry.identifier,/^urn:air:badgewars\.com:/);assert.ok(entry.representativeQueries.length>=2);assert.ok(['/llms.txt','/api/arena'].includes(new URL(entry.url).pathname));assert.ok(!entry.type.includes('mcp'));}
 const sitemap=readFileSync('public/sitemap.xml','utf8');for(const page of ['/collection','/api/','/account/','/support/'])assert.ok(!sitemap.includes(page));
});

test('page metadata stays canonical and private pages stay unindexed; legal rendering replaces the prerendered home',()=>{
 for(const locale of ['es','en']){
  assert.equal(pageInfo('/collection?checkout=private',locale).robots,'noindex,follow');
  assert.equal(pageInfo('/leaderboard/flex?lang=en#top',locale).canonical,'https://badgewars.com/leaderboard/flex');
  assert.ok(pageInfo('/leaderboard/funded',locale).title.includes('Build Funded'));
 }
 const legal=legalPageHtml(readFileSync('public/index.html','utf8'),'/refunds');
 assert.ok(!legal.includes('class="hero"'));assert.ok(legal.includes('rel="canonical" href="https://badgewars.com/refunds"'));
 assert.ok(legal.includes('class="brand"'));assert.ok(legal.includes('class="legal-footer"'));assert.equal((legal.match(/<h1>/g)||[]).length,1);
});
