import { fal } from '@fal-ai/client';
import { ensureImageSchema, getBindings, imageModels, json, localOnly, PROJECT_ID, rowToRun, runSelect, sha256 } from './shared';

export async function GET(request:Request){
 if(!localOnly(request))return json({error:'Image generation jobs are owner-local only.'},403);
 const {db}=getBindings();if(!db)return json({error:'D1 is not configured for this runtime.'},409);await ensureImageSchema(db);
 const shotId=new URL(request.url).searchParams.get('shotId');
 const query=shotId?db.prepare(`${runSelect} WHERE gr.project_id=? AND gr.shot_id=? ORDER BY gr.created_at DESC LIMIT 30`).bind(PROJECT_ID,shotId):db.prepare(`${runSelect} WHERE gr.project_id=? ORDER BY gr.created_at DESC LIMIT 50`).bind(PROJECT_ID);
 const result=await query.all();return json({runs:(result.results as never[]).map(rowToRun)});
}

export async function POST(request:Request){
 if(!localOnly(request))return json({error:'Paid image generation is owner-local only.'},403);
 const origin=request.headers.get('origin'),fetchSite=request.headers.get('sec-fetch-site'),expectedOrigin=new URL(request.url).origin;if(origin!==expectedOrigin&&fetchSite!=='same-origin')return json({error:'Same-origin approval is required.'},403);
 if(!request.headers.get('content-type')?.toLowerCase().includes('application/json'))return json({error:'JSON approval request required.'},415);
 const {key,db}=getBindings();if(!key)return json({error:'FAL_KEY is not configured for this runtime.'},409);if(!db)return json({error:'D1 is not configured for this runtime.'},409);await ensureImageSchema(db);
 const body=await request.json().catch(()=>null) as null|{shotId?:string;model?:string;prompt?:string;imageUrl?:string;idempotencyKey?:string};
 const info=body?.model?imageModels.get(body.model):undefined;
 if(!body?.shotId||!body.model||!body.prompt||!body.imageUrl)return json({error:'Missing shotId, model, prompt, or imageUrl.'},400);
 if(!/^S\d{3}$/.test(body.shotId)||!info)return json({error:'Unsupported image generation request.'},400);
 if(body.prompt.length>8000||!/^https:\/\//.test(body.imageUrl))return json({error:'Invalid prompt or source image.'},400);
 const now=Math.floor(Date.now()/1000),quoteId=crypto.randomUUID(),approvalId=crypto.randomUUID(),runId=crypto.randomUUID(),jobId=crypto.randomUUID();
 const snapshot={shotId:body.shotId,model:body.model,modelLabel:info.label,estimatedCost:`$${info.cost} / image`,prompt:body.prompt,imageUrl:body.imageUrl,outputFormat:'png',numImages:1};
 const payloadJson=JSON.stringify(snapshot),payloadHash=await sha256(payloadJson),idempotencyKey=(body.idempotencyKey??request.headers.get('idempotency-key')??payloadHash).trim();
 if(idempotencyKey.length<8||idempotencyKey.length>200)return json({error:'idempotencyKey must be between 8 and 200 characters.'},400);
 const requestHash=body.idempotencyKey||request.headers.get('idempotency-key')?await sha256(`${payloadJson}:${idempotencyKey}`):payloadHash;
 const statusFor=(status:string)=>status==='running'?'IN_PROGRESS':status==='completed'?'COMPLETED':status==='failed'?'FAILED':'IN_QUEUE';
 const dedupe=(run:{run_id:string;job_id:string;provider_request_id:string|null;status:string})=>json({runId:run.run_id,jobId:run.job_id,requestId:run.provider_request_id,providerStatus:statusFor(run.status),deduplicated:true},200);
 // Check the durable idempotency record before enforcing the concurrency cap. A replay
 // must return the original job, even when the three-job safety limit is now full.
 const priorApproval=await db.prepare(`SELECT gr.id AS run_id,j.id AS job_id,gr.provider_request_id,gr.status,pa.quote_payload_hash
   FROM paid_approvals pa JOIN generation_runs gr ON gr.approval_id=pa.id JOIN jobs j ON j.run_id=gr.id
   WHERE pa.project_id=? AND pa.idempotency_key=? LIMIT 1`).bind(PROJECT_ID,idempotencyKey).first<{run_id:string;job_id:string;provider_request_id:string|null;status:string;quote_payload_hash:string}>();
 if(priorApproval){if(priorApproval.quote_payload_hash!==payloadHash)return json({error:'This idempotency key was already used for a different image request.'},409);return dedupe(priorApproval);}
 const prior=await db.prepare('SELECT id AS run_id,(SELECT id FROM jobs WHERE run_id=generation_runs.id LIMIT 1) AS job_id,provider_request_id,status FROM generation_runs WHERE project_id=? AND request_hash=? LIMIT 1').bind(PROJECT_ID,requestHash).first<{run_id:string;job_id:string|null;provider_request_id:string|null;status:string}>();
 if(prior)return dedupe({run_id:prior.run_id,job_id:prior.job_id??'',provider_request_id:prior.provider_request_id,status:prior.status});
 const activeCount=await db.prepare("SELECT COUNT(*) AS count FROM generation_runs WHERE project_id=? AND status NOT IN ('failed','completed')").bind(PROJECT_ID).first<{count:number}>();if(Number(activeCount?.count??0)>=3)return json({error:'The approved safety limit of three image runs has been reached.'},409);
 try{
  await db.batch([
   db.prepare('INSERT INTO quotes (id,project_id,provider,model,payload_hash,payload_json,max_cost_usd,currency,expires_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(quoteId,PROJECT_ID,'Fal',body.model,payloadHash,payloadJson,info.cost,'USD',now+600,now),
   db.prepare('INSERT INTO paid_approvals (id,project_id,quote_id,quote_payload_hash,approval_snapshot_json,actor_id,idempotency_key,approved_at,created_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(approvalId,PROJECT_ID,quoteId,payloadHash,JSON.stringify({...snapshot,approvedAction:'submit-one-image-job'}),'local-owner',idempotencyKey,now,now),
   db.prepare('INSERT INTO generation_runs (id,project_id,shot_id,approval_id,provider,model,request_hash,request_snapshot_json,reference_snapshot_json,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').bind(runId,PROJECT_ID,body.shotId,approvalId,'Fal',body.model,requestHash,payloadJson,JSON.stringify([{role:'source-keyframe',url:body.imageUrl}]),'submitting',now,now),
   db.prepare('INSERT INTO jobs (id,quote_id,run_id,status,retry_count,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').bind(jobId,quoteId,runId,'submitting',0,now,now),
  ]);
 }catch(error){const message=error instanceof Error?error.message:'Could not persist the approved job.';if(message.toLowerCase().includes('unique')){const existing=await db.prepare(`SELECT gr.id AS run_id,j.id AS job_id,gr.provider_request_id,gr.status,pa.quote_payload_hash FROM paid_approvals pa JOIN generation_runs gr ON gr.approval_id=pa.id JOIN jobs j ON j.run_id=gr.id WHERE pa.project_id=? AND pa.idempotency_key=? LIMIT 1`).bind(PROJECT_ID,idempotencyKey).first<{run_id:string;job_id:string;provider_request_id:string|null;status:string;quote_payload_hash:string}>();if(existing&&existing.quote_payload_hash===payloadHash)return dedupe(existing);if(existing)return json({error:'This idempotency key was already used for a different image request.'},409);return json({error:'This image request was already submitted. Refresh the jobs panel.'},409);}return json({error:message},500)}
 fal.config({credentials:key});
 try{const queued=await fal.queue.submit(body.model as never,{input:{prompt:body.prompt,image_url:body.imageUrl,output_format:'png',num_images:1} as never}) as unknown as {status?:string;request_id:string};const providerStatus=queued.status??'IN_QUEUE',status=providerStatus==='IN_PROGRESS'?'running':'queued';await db.prepare('UPDATE generation_runs SET status=?,provider_request_id=?,started_at=?,updated_at=? WHERE id=?').bind(status,queued.request_id,now,now,runId).run();await db.prepare('UPDATE jobs SET status=?,provider_request_id=?,updated_at=? WHERE id=?').bind(status,queued.request_id,now,jobId).run();return json({runId,jobId,requestId:queued.request_id,providerStatus},202)}catch(error){const message=error instanceof Error?error.message:'Fal did not accept the request.';await db.prepare('UPDATE generation_runs SET status=?,updated_at=? WHERE id=?').bind('failed',now,runId).run();await db.prepare('UPDATE jobs SET status=?,last_error_code=?,last_error_safe_message=?,updated_at=? WHERE id=?').bind('failed','FAL_SUBMIT_FAILED',message,now,jobId).run();return json({error:message,runId,jobId},502)}
}
