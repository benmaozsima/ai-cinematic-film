import { env } from 'cloudflare:workers';
import { ensureImageSchema } from '../../../image-jobs/shared';

const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store'}});
export async function POST(request:Request,context:{params:Promise<{assetId:string}>}){
 const host=new URL(request.url).hostname;if(host!=='localhost'&&host!=='127.0.0.1')return json({error:'Image review decisions are owner-local only.'},403);
 const origin=request.headers.get('origin');if(origin&&new URL(origin).origin!==new URL(request.url).origin)return json({error:'Cross-origin review decisions are not allowed.'},403);
 if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))return json({error:'Expected application/json.'},415);
 const{assetId}=await context.params,body=await request.json().catch(()=>null) as null|{verdict?:'approved'|'revise'|'rejected';note?:string;runId?:string};
 if(!/^[0-9a-f-]{36}$/i.test(assetId)||!body?.verdict||!['approved','revise','rejected'].includes(body.verdict))return json({error:'Invalid image review decision.'},400);
 await ensureImageSchema(env.DB);const asset=await env.DB.prepare('SELECT id,project_id,shot_id FROM assets WHERE id=? LIMIT 1').bind(assetId).first<{id:string;project_id:string;shot_id:string}>();if(!asset)return json({error:'Image asset not found.'},404);
 const now=Math.floor(Date.now()/1000),reviewId=crypto.randomUUID();
 await env.DB.prepare('UPDATE assets SET status=?,updated_at=? WHERE id=?').bind(body.verdict,now,assetId).run();
 await env.DB.prepare('INSERT INTO reviews (id,project_id,asset_id,run_id,reviewer_id,reviewer_kind,verdict,checklist_json,note,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(reviewId,asset.project_id,assetId,body.runId??null,'local-owner','human',body.verdict,'{}',body.note?.trim()||null,now).run();
 if(body.verdict==='approved'){const canonicalId=`KEYFRAME:${asset.shot_id}`,selectionId=crypto.randomUUID();await env.DB.prepare('INSERT INTO shot_selections (id,project_id,shot_id,canonical_asset_id,asset_revision_id,role,locked,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(shot_id,canonical_asset_id,role) DO UPDATE SET asset_revision_id=excluded.asset_revision_id,locked=excluded.locked,notes=excluded.notes,updated_at=excluded.updated_at').bind(selectionId,asset.project_id,asset.shot_id,canonicalId,assetId,'first-frame',1,'Approved through image review',now,now).run()}
 return json({ok:true,reviewId,status:body.verdict});
}
