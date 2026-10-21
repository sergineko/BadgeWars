import {termsDocument,operatorDetails,TERMS_VERSION,paymentSeller} from '../public/terms.js';
import {routeState} from '../public/routes.js';
import {normalizedBadgeUrl} from '../src/badge-url.mjs';
import {legalPageHtml} from '../src/legal-page.mjs';
import {legalRoutes} from '../public/legal.js';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {badgeSvg,catalog} from '../public/badges.js';
import {demoArena} from '../public/demo.js';
const root=resolve('public');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.woff2':'font/woff2','.json':'application/json; charset=utf-8','.txt':'text/plain; charset=utf-8','.xml':'application/xml; charset=utf-8','.ico':'image/x-icon','.png':'image/png','.jpg':'image/jpeg'};
createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost:8787');
  if(url.pathname==='/api/legal'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({version:TERMS_VERSION,operator:operatorDetails(),merchantOfRecord:paymentSeller}));return;}
  if(url.pathname.startsWith('/api/legal/terms/')){const locale=url.pathname.endsWith('/en.txt')?'en':'es',doc=termsDocument({},locale);res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8'});res.end(['BadgeWars — '+doc.version,JSON.stringify({operator:doc.operator,merchantOfRecord:doc.merchantOfRecord},null,2),...doc.sections.map(s=>s.title+'\n'+s.text)].join('\n\n'));return;}
  if(url.pathname==='/api/arena'){res.writeHead(process.env.BADGEWARS_DEMO_OFFLINE==='1'?503:200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(process.env.BADGEWARS_DEMO_OFFLINE==='1'?{error:'offline'}:demoArena));return;}
  if(url.pathname==='/__design-preview'){const file=await readFile(resolve('artifacts/badge-gallery.html'));res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(file);return;}
  if(url.pathname==='/api/auth/config'||url.pathname==='/api/auth/me'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(url.pathname.endsWith('config')?{providers:[]}:{user:null}));return;}
  if(url.pathname.startsWith('/api/')){res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end('{"error":"demo_only"}');return;}
  if(url.pathname.startsWith('/badges/')&&url.pathname.endsWith('.svg')){
   const badgeUrl=normalizedBadgeUrl(url);if(!badgeUrl)throw Error();const id=badgeUrl.pathname.split('/').pop().replace('.svg','');if(!catalog.some(b=>b.id===id))throw Error();
   const claim=badgeUrl.searchParams.get('claim');const state=claim?demoArena.states[id].claims.find(p=>p.id===claim||p.aliases?.includes(claim)):demoArena.states[id];if(!state)throw Error();
   res.writeHead(200,{'Content-Type':'image/svg+xml','Access-Control-Allow-Origin':'*'});res.end(badgeSvg(id,state,badgeUrl.searchParams.get('style')==='compact',badgeUrl.searchParams.get('lang')||'en'));return;
  }
  if(legalRoutes.includes(url.pathname)){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(legalPageHtml(await readFile(resolve(root,'index.html'),'utf8'),url.pathname));return;}
  const route=routeState(url.href),prerendered=['/collection','/leaderboard/flex','/leaderboard/bait','/leaderboard/funded','/leaderboard/trust','/leaderboard/genesis'].includes(route.path);
  const path=resolve(root,'.'+decodeURIComponent(prerendered?route.path+'/index.html':['/','/leaderboard','/collection',...legalRoutes].includes(route.page)?'/index.html':url.pathname));
  if(!path.startsWith(root+'\\')&&!path.startsWith(root+'/'))throw Error();
  const file=await readFile(path);res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream'});res.end(file);
 }catch{const url=new URL(req.url,'http://localhost:8787');if(!extname(url.pathname)&&!url.pathname.startsWith('/api/')){res.writeHead(404,{'Content-Type':'text/html; charset=utf-8'});res.end(await readFile(resolve(root,'index.html')));}else{res.writeHead(404);res.end('Not found');}}
}).listen(Number(process.env.PORT)||8787,'127.0.0.1',()=>console.log(`BadgeWars preview: http://127.0.0.1:${Number(process.env.PORT)||8787}`));
