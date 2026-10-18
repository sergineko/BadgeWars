import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
createServer((req,res)=>{if(req.url!=='/'){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}).end(readFileSync('.wrangler/qa/embed-gallery.html'));}).listen(8790,'127.0.0.1',()=>console.log('External-origin embed QA: http://127.0.0.1:8790/'));
