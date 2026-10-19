// Temporary public relay for one fictional SVG and its link. No API or cookies.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
const {holderId}=JSON.parse(await readFile('.wrangler/dodo-qa-b/purchase.json','utf8'));
if(!/^[a-f0-9-]{36}$/.test(holderId))throw Error('Invalid fixture');
const allowed=new Set(['es','en'].flatMap(lang=>['','-compact'].map(style=>`/badges/flex/${holderId}/${lang}${style}.svg`)));
http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1:8799');
 if(['GET','HEAD'].includes(req.method)&&!url.search&&url.pathname===`/b/${holderId}`){
  const link=await fetch('http://127.0.0.1:8798'+url.pathname,{redirect:'manual',signal:AbortSignal.timeout(10000)});
  const destination=link.headers.get('Location');
  if(link.status===302&&destination){const path=new URL(destination).pathname;if(['/badge/flex','/collection'].includes(path)){res.writeHead(302,{Location:'https://badgewars.com'+path,'Cache-Control':'no-store'});res.end();return;}}
  res.writeHead(503,{'Cache-Control':'no-store'});res.end();return;
 }
 if(!['GET','HEAD'].includes(req.method)||url.search||!allowed.has(url.pathname)){res.writeHead(404,{'Cache-Control':'no-store'});res.end();return;}
 try{
  const image=await fetch('http://127.0.0.1:8798'+url.pathname,{method:req.method,signal:AbortSignal.timeout(10000)});
  const headers=Object.fromEntries(['Content-Type','Cache-Control','Access-Control-Allow-Origin','X-Badge-Status','ETag','Content-Security-Policy'].flatMap(k=>image.headers.has(k)?[[k,image.headers.get(k)]]:[]));
  res.writeHead(image.status,headers);res.end(req.method==='HEAD'?undefined:Buffer.from(await image.arrayBuffer()));
  console.log(new Date().toISOString(),req.method,url.pathname,image.status,req.headers['user-agent']?.slice(0,100));
 }catch{res.writeHead(503,{'Cache-Control':'no-store'});res.end();}
}).listen(8799,'127.0.0.1',()=>console.log('QA SVG-only relay on loopback 8799'));
