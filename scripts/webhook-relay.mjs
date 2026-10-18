// Local Sandbox relay: expose only the signed webhook, never the dev server.
import {createServer} from 'node:http';
const upstream=new URL(process.env.WEBHOOK_UPSTREAM||'http://127.0.0.1:8788/api/polar/webhook');
if(!['127.0.0.1','localhost'].includes(upstream.hostname)||upstream.pathname!=='/api/polar/webhook')throw Error('Only the local webhook may be relayed');
createServer(async(req,res)=>{
 if(req.method!=='POST'||req.url!=='/api/polar/webhook'){res.writeHead(404).end();return;}
 try{
  let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>65536){res.writeHead(413).end();return;}chunks.push(chunk);}
  const headers={};for(const name of ['content-type','webhook-id','webhook-timestamp','webhook-signature','webhook-api-version'])if(req.headers[name])headers[name]=req.headers[name];
  const reply=await fetch(upstream,{method:'POST',headers,body:Buffer.concat(chunks),signal:AbortSignal.timeout(10000)});
  res.writeHead(reply.status,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(await reply.text());
  console.log(`Webhook relay: ${reply.status}`);
 }catch{res.writeHead(502).end();console.error('Webhook relay unavailable');}
}).listen(8791,'127.0.0.1',()=>console.log('Webhook-only Sandbox relay: http://127.0.0.1:8791'));
