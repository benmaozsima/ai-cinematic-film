import { env } from 'cloudflare:workers';
import { ensureImageSchema, localOnly, PROJECT_ID, json } from '../image-jobs/shared';

export async function GET(request: Request) {
  if (!localOnly(request)) return json({ error: 'Image assets are owner-local only.' }, 403);
  await ensureImageSchema(env.DB);
  const shotId = new URL(request.url).searchParams.get('shotId');
  const query = shotId
    ? env.DB.prepare(`SELECT a.id,a.shot_id,a.version,a.status,a.media_url,a.width,a.height,a.sha256,s.asset_revision_id AS active_asset_id FROM assets a LEFT JOIN shot_selections s ON s.project_id=a.project_id AND s.shot_id=a.shot_id AND s.role='first-frame' AND s.canonical_asset_id=? WHERE a.project_id=? AND a.shot_id=? AND a.type='keyframe' AND a.status='approved' ORDER BY a.created_at DESC`).bind(`KEYFRAME:${shotId}`, PROJECT_ID, shotId)
    : env.DB.prepare(`SELECT a.id,a.shot_id,a.version,a.status,a.media_url,a.width,a.height,a.sha256,s.asset_revision_id AS active_asset_id FROM assets a LEFT JOIN shot_selections s ON s.project_id=a.project_id AND s.shot_id=a.shot_id AND s.role='first-frame' AND s.canonical_asset_id='KEYFRAME:'||a.shot_id WHERE a.project_id=? AND a.type='keyframe' AND a.status='approved' ORDER BY a.created_at DESC`).bind(PROJECT_ID);
  const result = await query.all();
  return json({ assets: result.results });
}

export async function POST(request: Request) {
  if (!localOnly(request)) return json({ error: 'Image asset selection is owner-local only.' }, 403);
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).origin !== new URL(request.url).origin) return json({ error: 'Cross-origin asset selection is not allowed.' }, 403);
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return json({ error: 'Expected application/json.' }, 415);
  const body = await request.json().catch(() => null) as null | { assetId?: string };
  if (!body?.assetId || (!/^SOURCE:S\d{3}$/.test(body.assetId) && !/^[0-9a-f-]{36}$/i.test(body.assetId))) return json({ error: 'Invalid asset selection.' }, 400);
  await ensureImageSchema(env.DB);
  if (body.assetId.startsWith('SOURCE:')) {
    const shotId = body.assetId.slice('SOURCE:'.length);
    await env.DB.prepare("UPDATE shot_selections SET asset_revision_id=NULL,locked=0,notes='Source keyframe selected from timeline',updated_at=? WHERE project_id=? AND shot_id=? AND canonical_asset_id=? AND role='first-frame'").bind(Math.floor(Date.now() / 1000), PROJECT_ID, shotId, `KEYFRAME:${shotId}`).run();
    return json({ ok: true, shotId, assetId: body.assetId });
  }
  const asset = await env.DB.prepare("SELECT id,project_id,shot_id FROM assets WHERE id=? AND project_id=? AND type='keyframe' AND status='approved' LIMIT 1").bind(body.assetId, PROJECT_ID).first<{ id: string; project_id: string; shot_id: string }>();
  if (!asset) return json({ error: 'Only an approved keyframe can be selected.' }, 409);
  const now = Math.floor(Date.now() / 1000), selectionId = crypto.randomUUID(), canonicalId = `KEYFRAME:${asset.shot_id}`;
  await env.DB.prepare("INSERT INTO shot_selections (id,project_id,shot_id,canonical_asset_id,asset_revision_id,role,locked,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(shot_id,canonical_asset_id,role) DO UPDATE SET asset_revision_id=excluded.asset_revision_id,updated_at=excluded.updated_at,notes=excluded.notes").bind(selectionId, PROJECT_ID, asset.shot_id, canonicalId, asset.id, 'first-frame', 1, 'Selected from timeline', now, now).run();
  return json({ ok: true, shotId: asset.shot_id, assetId: asset.id });
}
