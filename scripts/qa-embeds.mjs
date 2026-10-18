// Opt-in native D1 integration test. Fictional users in isolated local state only.
// Start Wrangler on 8788 with --persist-to .wrangler/qa-state --test-scheduled.
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {TERMS_VERSION} from '../public/terms.js';
import {catalog,escapeXml} from '../public/badges.js';
const origin='http://127.0.0.1:8788',directory='.wrangler/qa';
mkdirSync(directory,{recursive:true});mkdirSync('artifacts',{recursive:true});
const people=Object.fromEntries(['owner','rival','supporter','checkout'].map(name=>[name,{id:randomUUID(),token:randomBytes(32).toString('hex'),name}]));
const sql=Object.values(people).map(p=>`INSERT INTO bw_users(id,provider,subject,name) VALUES('${p.id}','github','qa-${p.id}','Embed QA ${p.name}');\n${p.name==='checkout'?'':`INSERT INTO bw_ledger(id,user_id,delta,kind,reference) VALUES('${randomUUID()}','${p.id}',5000,'topup','qa-${p.id}');`}\nINSERT INTO bw_sessions(token_hash,user_id,expires) VALUES('${createHash('sha256').update(p.token).digest('hex')}','${p.id}',${Date.now()+4*3600000});`).join('\n');
writeFileSync(directory+'/embeds-seed.sql',sql);writeFileSync(directory+'/embeds-session.json',JSON.stringify(people),{mode:0o600});
execFileSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','execute','badgewars','--local','--persist-to','.wrangler/qa-state','--file',directory+'/embeds-seed.sql'],{env:{...process.env,XDG_CONFIG_HOME:process.cwd()+'/.wrangler/config',WRANGLER_LOG_PATH:process.cwd()+'/.wrangler/logs',WRANGLER_SEND_METRICS:'false'},stdio:'pipe'});
const headers=p=>({Cookie:'bw_session='+p.token,Origin:origin,'Content-Type':'application/json'});
async function call(p,path,body){const r=await fetch(origin+path,{headers:{...headers(p),...(body?{'Idempotency-Key':randomUUID()}:{})},...(body?{method:'POST',body:JSON.stringify(body)}:{})});const data=await r.json();assert.equal(r.status,200,JSON.stringify(data));return data;}
async function buy(p,badge,level,extra={}){return call(p,'/api/wallet/spend',{badge,owner:'qa_'+p.name,amount:level*100,accepted:true,executionRequested:true,withdrawalAcknowledged:true,termsVersion:TERMS_VERSION,...extra});}
const owned={};for(const b of catalog){const q=await call(people.owner,'/api/me/quote?badge='+b.id);owned[b.id]=await buy(people.owner,b.id,q.level);}
const first=(await call(people.owner,'/api/me/embed?badge='+owned.flex.holderId+'&format=html&lang=es')).imageUrl;
await buy(people.rival,'flex',(await call(people.rival,'/api/me/quote?badge=flex')).level);const renewed=await buy(people.owner,'flex',(await call(people.owner,'/api/me/quote?badge=flex')).level);assert.equal(renewed.holderId,owned.flex.holderId);assert.equal(renewed.cost,2);
const rivalBag=await buy(people.rival,'quality',20);await buy(people.rival,'genesis',1000);
await buy(people.supporter,'quality',10,{kind:'support',targetId:rivalBag.holderId});
await buy(people.supporter,'quality',15,{kind:'support',targetId:owned.quality.holderId});
const inventory=await call(people.owner,'/api/me/badges');assert.equal(inventory.items.length,5);assert.equal(inventory.items.find(b=>b.badgeId==='quality').rank,1);
assert.equal((await call(people.owner,'/api/me/embed?badge='+owned.flex.holderId+'&format=html&lang=es')).imageUrl,first);
assert.equal((await fetch(origin+'/api/me/embed?badge='+owned.flex.holderId)).status,401);
assert.equal((await fetch(origin+'/api/me/embed?badge='+owned.flex.holderId,{headers:headers(people.rival)})).status,404);
console.log('Native D1 purchases and stable personal URLs passed. Waiting for the publication interval.');
await new Promise(resolve=>setTimeout(resolve,11000));
const cron=await fetch(origin+'/cdn-cgi/local/explorer/api/local/scheduled?worker=badgewars',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cron:'*/5 * * * *'})});assert.equal(cron.status,200);
const variants=[];
for(const b of catalog)for(const locale of ['es','en'])for(const style of ['', 'compact'])for(const format of ['html','md']){
 const query=new URLSearchParams({badge:owned[b.id].holderId,lang:locale,style,format});const embed=await call(people.owner,'/api/me/embed?'+query);
 assert.equal(new URL(embed.imageUrl).search,'');assert.equal(new URL(embed.imageUrl).hash,'');
 if(format==='html')assert.ok(embed.code.includes('src="'+embed.imageUrl+'"'));
 else assert.ok(embed.code.includes(']('+embed.imageUrl+')]('+embed.targetUrl+')'));
 const response=await fetch(embed.imageUrl,{headers:{Origin:'http://127.0.0.1:8790'}});assert.equal(response.status,200);assert.match(response.headers.get('Content-Type'),/^image\/svg\+xml/);assert.equal(response.headers.get('Access-Control-Allow-Origin'),'*');assert.equal(response.headers.get('Content-Language'),locale);
 const svg=await response.text();assert.match(svg,/<svg\b/);assert.ok(svg.includes('qa_owner'));assert.ok(!/<script\b|<foreignObject\b/.test(svg));
 const head=await fetch(embed.imageUrl,{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
 const conditional=await fetch(embed.imageUrl,{headers:{'If-None-Match':response.headers.get('ETag')}});assert.equal(conditional.status,304);
 // Convert the exact supported Markdown form to HTML for a second-origin browser check.
 const html=format==='html'?embed.code:embed.code.replace(/^\[!\[([^\]]+)\]\(([^)]+)\)\]\(([^)]+)\)$/,(all,alt,src,href)=>`<a href="${escapeXml(href)}"><img src="${escapeXml(src)}" alt="${escapeXml(alt)}" /></a>`);
 variants.push({badge:b.id,locale,style:style||'full',format,html,imageUrl:embed.imageUrl});
}
const report={date:new Date().toISOString(),environment:'local native Worker + D1 + KV; fictional accounts',termsVersion:TERMS_VERSION,variants:variants.length,ownerOnly:true,stableRenewalUrl:true,renewalCost:renewed.cost,currentInventoryCount:inventory.items.length,crossOriginHeaders:true,conditionalGet:true,head:true};
writeFileSync('artifacts/embed-qa.json',JSON.stringify(report,null,2));
writeFileSync(directory+'/embed-gallery.html',`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BadgeWars · Prueba de inserción externa</title><style>body{margin:0;background:#0a0d16;color:#e9edf8;font:16px system-ui;padding:36px}h1{font-size:32px}p{color:#9daac1}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:22px}article{background:#121829;border:1px solid #28334c;border-radius:16px;padding:20px}img{display:block;max-width:100%;height:auto}small{display:block;color:#9daac1;margin:0 0 14px}a{color:#a3afff}h2{font-size:17px}</style><h1>Badges en una web externa</h1><p>Origen de esta página: 127.0.0.1:8790 · SVG desde 127.0.0.1:8788 · sin sesión en las imágenes.<br>40 variantes: cinco badges, dos idiomas, dos tamaños y código HTML / Markdown.</p><div class="grid">${variants.map(v=>`<article data-badge="${v.badge}" data-locale="${v.locale}" data-format="${v.format}" data-style="${v.style}"><h2>${v.badge}</h2><small>${v.locale.toUpperCase()} · ${v.style} · ${v.format.toUpperCase()}</small>${v.html}</article>`).join('')}</div></html>`);
console.log(JSON.stringify(report,null,2));
