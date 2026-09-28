// Disposable browser-only verification harness. Production bridge is unchanged.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {handler} from './fixture.mjs';
const root=resolve('dist/renderer');
const bridge=`<script>window.workspace={request:async(method,payload={})=>{const response=await fetch('/__fixture/request',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({method,payload})});const value=await response.json();if(!response.ok)throw new Error(value.error);return value;}};</script>`;
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{try {
 if(req.url==='/__fixture/request'&&req.method==='POST'){let body='';for await(const chunk of req){body+=chunk;if(body.length>1000000)throw Error('Fixture request too large');}const {method,payload}=JSON.parse(body);const result=await handler(null,method,payload);res.setHeader('content-type','application/json');res.end(JSON.stringify(result));return;}
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const path=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(path!==root&&!path.startsWith(root+sep))throw Error('Invalid path');let data=await readFile(path);if(extname(path)==='.html')data=Buffer.from(data.toString().replace('<head>','<head>'+bridge));res.setHeader('content-type',types[extname(path)]||'application/octet-stream');res.end(data);
 }catch(error){res.statusCode=500;res.setHeader('content-type','application/json');res.end(JSON.stringify({error:error.message}));}});
server.listen(38901,'127.0.0.1',()=>console.log('Workspace disposable browser fixture http://127.0.0.1:38901'));
