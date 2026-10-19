// Disposable, fictional cross-origin fixtures. Never deployed or used as a proxy.
import {createServer} from 'node:http';
import {writeFile,mkdir} from 'node:fs/promises';
import {resilientEmbed} from '../public/embed-fallback.js';
import {badgeSvg} from '../public/badges.js';
import {suspendedBadgeSvg} from '../public/badge-status.js';
const origin='http://127.0.0.1:8795',target='https://badgewars.com/',stats={};
const cards=[
 ['active','Conexión disponible','Activo: se ve el SVG real.'],
 ['unreachable','Conexión rechazada','El host no responde: alternativa incluida en el HTML.'],
 ['error','API con error HTTP','Error 503: alternativa sin ranking.'],
 ['pending','Conexión pendiente','Sin respuesta: la alternativa se ve durante la espera.'],
 ['suspended','Badge suspendido','La tarjeta de pausa recibida sustituye al badge activo.'],
 ['english','English fallback','Unreachable image: locally included fallback.']
];
const html=`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>BadgeWars — Protección de conexión</title><style>body{background:#0b0e17;color:#f0f2fc;font:16px system-ui;margin:0;padding:32px}h1{font-size:30px;margin:0}p{color:#a7b5ce;line-height:1.5}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}article{background:#141b2a;padding:18px;border-radius:18px;border:1px solid #30394d}h2{margin:0 0 6px;font-size:18px}.compact{margin-top:12px}@media(max-width:700px){.grid{grid-template-columns:1fr}}</style><h1>Una conexión fallida no rompe el badge</h1><p>Prueba local: HTML en 8794, SVG en 8795. Cuentas y valores ficticios. No simula un bloqueo real de ningún ISP.</p><div class="grid">${cards.map(([kind,title,note])=>`<article id="${kind}"><h2>${title}</h2><p>${note}</p>${['','compact'].map(style=>resilientEmbed(kind==='unreachable'||kind==='english'?'http://127.0.0.1:8796/unreachable.svg':origin+'/'+kind+(style?'-compact':'')+'.svg',target,'BadgeWars QA',kind==='english'?'en':'es',Boolean(style))).join('<div class="compact"></div>')}</article>`).join('')}</div></html>`;
await mkdir('artifacts',{recursive:true});await writeFile('artifacts/embed-fallback-gallery.html',html);
createServer((req,res)=>{
 if(req.url==='/report'){res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify(stats));return;}
 res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}).end(html);
}).listen(8794,'127.0.0.1');
createServer((req,res)=>{
 stats[req.url]=(stats[req.url]||0)+1;
 if(req.url.startsWith('/pending'))return; // Remains pending until the browser closes it.
 if(req.url.startsWith('/error')){res.writeHead(503).end('Unavailable');return;}
 const compact=req.url.includes('compact'),svg=req.url.startsWith('/suspended')?suspendedBadgeSvg(target,'es',compact):badgeSvg('flex',{owner:'qa_demo',amount:300,rank:1},compact,'es');
 res.writeHead(200,{'Content-Type':'image/svg+xml','Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}).end(svg);
}).listen(8795,'127.0.0.1',()=>console.log('Connection fallback QA: http://127.0.0.1:8794/'));
