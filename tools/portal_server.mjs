import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'); const port=Number(process.env.PORT||8765);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.mp4':'video/mp4'};
function safePath(p){const c=path.resolve(root,decodeURIComponent(p.split('?')[0]).replace(/^\/+/,''));return c.startsWith(root+path.sep)?c:null}
http.createServer((req,res)=>{const u=new URL(req.url,`http://${req.headers.host}`);
 if(u.pathname==='/api/registry'){res.writeHead(200,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(fs.readFileSync(path.join(root,'data/media_registry_v0.1.json')));return}
 if(u.pathname==='/api/download/assembly'){const f=path.join(root,'outputs/assembled/ai_cinematic_film_S001-S016_review.mp4');if(!fs.existsSync(f)){res.writeHead(404,{'content-type':'text/plain'});res.end('Assembly is not available locally yet.');return}res.writeHead(200,{'content-type':'video/mp4','content-length':fs.statSync(f).size,'content-disposition':'attachment; filename="ai_cinematic_film_S001-S016_review.mp4"','cache-control':'no-store'});fs.createReadStream(f).pipe(res);return}
 const f=u.pathname==='/'?path.join(root,'dashboard/index.html'):safePath(u.pathname);if(!f||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end('Not found');return}res.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream','cache-control':'no-store'});fs.createReadStream(f).pipe(res);
}).listen(port,'127.0.0.1',()=>console.log(`AI film portal: http://127.0.0.1:${port}/dashboard/#sequence-review`));
