import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'); const port=Number(process.env.PORT||8765);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.mp4':'video/mp4'};
function safePath(p){const c=path.resolve(root,decodeURIComponent(p.split('?')[0]).replace(/^\/+/,''));return c.startsWith(root+path.sep)?c:null}
const portalDir=path.join(root,'.portal'); const jobsFile=path.join(portalDir,'jobs.json');
fs.mkdirSync(portalDir,{recursive:true});
function readJson(file,fallback){try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch{return fallback}}
function send(res,status,payload){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*'});res.end(JSON.stringify(payload,null,2))}
async function body(req){let s='';for await(const chunk of req)s+=chunk;if(!s)return{};try{return JSON.parse(s)}catch{throw new Error('Body must be valid JSON')}}
function models(){return readJson(path.join(root,'data/model_capabilities_v0.1.json'),{schema_version:'0.1',providers:[]})}
function allModels(){return models().providers.flatMap(p=>p.models.map(m=>({...m,provider:p.provider})))}
function estimate(input){const m=allModels().find(x=>x.provider===input.provider&&x.model===input.model);if(!m)throw new Error('Unknown provider/model');const seconds=Number(input.duration_seconds||5);if(!Number.isFinite(seconds)||seconds<=0)throw new Error('duration_seconds must be positive');const cost=seconds*(m.price_usd_per_second||0);return {provider:m.provider,model:m.model,duration_seconds:seconds,estimated_cost_usd:Number(cost.toFixed(4)),requires_approval:Boolean(m.requires_approval),warnings:m.audio?'':'Model output is silent; add voice/lip-sync in a separate approved pass.'}}
function jobs(){return readJson(jobsFile,[])}
http.createServer(async (req,res)=>{const u=new URL(req.url,`http://${req.headers.host}`);
 if(req.method==='OPTIONS'){res.writeHead(204,{'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type'});res.end();return}
 try {
 if(req.method==='GET'&&u.pathname==='/api/registry'){send(res,200,readJson(path.join(root,'data/media_registry_v0.1.json'),{}));return}
 if(req.method==='GET'&&u.pathname==='/api/models'){send(res,200,models());return}
 if(req.method==='GET'&&u.pathname==='/api/jobs'){send(res,200,{schema_version:'0.1',jobs:jobs().map(({secret,...j})=>j)});return}
 if(req.method==='GET'&&u.pathname.startsWith('/api/jobs/')){const j=jobs().find(x=>x.id===u.pathname.split('/')[3]);if(!j){send(res,404,{error:'job_not_found'});return}const{secret,...safe}=j;send(res,200,safe);return}
 if(req.method==='POST'&&u.pathname==='/api/estimate'){send(res,200,estimate(await body(req)));return}
 if(req.method==='POST'&&u.pathname==='/api/jobs'){const input=await body(req);const e=estimate(input);const j={id:`job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`,created_at:new Date().toISOString(),status:e.requires_approval?'awaiting_approval':'queued',shot_id:input.shot_id||null,version:input.version||null,prompt:input.prompt||'',negative_constraints:input.negative_constraints||'',references:input.references||[],...e,approval:null};const list=jobs();list.push(j);fs.writeFileSync(jobsFile,JSON.stringify(list,null,2));send(res,201,j);return}
 if(req.method==='POST'&&u.pathname.match(/^\/api\/jobs\/[^/]+\/approve$/)){const id=u.pathname.split('/')[3],input=await body(req),list=jobs(),j=list.find(x=>x.id===id);if(!j){send(res,404,{error:'job_not_found'});return}if(input.approved!==true){send(res,400,{error:'explicit_approval_required',message:'Send {"approved":true} for this exact job.'});return}j.approval={approved:true,approved_at:new Date().toISOString(),note:input.note||null};j.status='approved_pending_submission';fs.writeFileSync(jobsFile,JSON.stringify(list,null,2));send(res,200,{...j,submission:{performed:false,reason:'Provider submission is intentionally disabled in this local API until a provider adapter is explicitly enabled.'}});return}
 if(u.pathname==='/api/download/assembly'){const f=path.join(root,'outputs/assembled/ai_cinematic_film_S001-S016_review.mp4');if(!fs.existsSync(f)){res.writeHead(404,{'content-type':'text/plain'});res.end('Assembly is not available locally yet.');return}res.writeHead(200,{'content-type':'video/mp4','content-length':fs.statSync(f).size,'content-disposition':'attachment; filename="ai_cinematic_film_S001-S016_review.mp4"','cache-control':'no-store'});fs.createReadStream(f).pipe(res);return}
 let f=u.pathname==='/'?path.join(root,'dashboard/index.html'):safePath(u.pathname);if(f&&fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');if(!f||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end('Not found');return}res.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream','cache-control':'no-store'});fs.createReadStream(f).pipe(res);
 } catch(err){send(res,400,{error:'bad_request',message:err.message})}
}).listen(port,'127.0.0.1',()=>console.log(`AI film portal: http://127.0.0.1:${port}/dashboard/#sequence-review`));
