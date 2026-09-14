import './env.mjs';
import { createServer } from 'node:http';
import { unlink } from 'node:fs/promises';
import * as S from './store.mjs';
import { MODELS, PROVIDER_CATALOG } from './models.mjs';
import { serveMedia, importAsset, extractFrame, run, absolute } from './media.mjs';
import { preview, generate, startWorker, reconcile } from './generation.mjs';
import {
  workflowState,
  planPreview,
  createPlan,
  revisePlan,
  approvePlan,
  startPlanningWorker,
} from './workflow.mjs';
import { subtitles } from './subtitles.mjs';
import {
  credentials,
  deploymentMode,
  hydrateSecrets,
  removeCredential,
  saveCredential,
  secret,
} from './secrets.mjs';
import {
  manifest,
  startExport,
  listExports,
  serveExport,
  recoverExports,
} from './export.mjs';

const PORT = Number(process.env.API_PORT || 3211),
  UI_PORT = Number(process.env.UI_PORT || 3210);
const localHosts = new Set([
  `localhost:${PORT}`,
  `127.0.0.1:${PORT}`,
  `localhost:${UI_PORT}`,
  `127.0.0.1:${UI_PORT}`,
]);
const trustedOrigins = new Set(
  String(process.env.FRAMEFORGE_TRUSTED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
);
const json = (res, data, status = 200) => {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(data));
};
let falCatalogCache = { at: 0, models: [] };
async function falCatalog() {
  if (Date.now() - falCatalogCache.at < 60_000 && falCatalogCache.models.length)
    return falCatalogCache.models;
  const headers = {};
  const key = secret('FAL_KEY');
  if (key) headers.Authorization = `Key ${key}`;
  const models = [];
  let cursor = '';
  for (let page = 0; page < 20; page += 1) {
    const url = new URL('https://api.fal.ai/v1/models');
    url.searchParams.set('status', 'active');
    if (cursor) url.searchParams.set('cursor', cursor);
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(20_000) });
    if (!response.ok) S.fail('FAL model catalog is temporarily unavailable.', 502);
    const data = await response.json();
    for (const item of data.models || []) {
      const metadata = item.metadata || {};
      models.push({
        id: item.endpoint_id,
        name: metadata.display_name || item.endpoint_id,
        category: metadata.category || 'other',
        description: metadata.description || '',
        status: metadata.status || 'active',
        updatedAt: metadata.updated_at || null,
        docs: `https://fal.ai/models/${item.endpoint_id}/api`,
      });
    }
    cursor = data.next_cursor || '';
    if (!cursor) break;
  }
  falCatalogCache = { at: Date.now(), models };
  return models;
}
async function body(req) {
  let bytes = 0;
  const chunks = [];
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 2 * 1024 * 1024) S.fail('Request too large.', 413);
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString() || '{}');
  } catch {
    S.fail('Invalid JSON.');
  }
}
let ffmpeg = false;
try {
  await run('ffmpeg', ['-version']);
  ffmpeg = true;
} catch {}
await hydrateSecrets();
if (!S.listFilms().length) S.createFilm({ title: 'Untitled film' });
recoverExports();
const worker = startWorker();
const planningWorker = startPlanningWorker();
const server = createServer(async (req, res) => {
  try {
    const host = req.headers.host || '';
    if (deploymentMode === 'local' && !localHosts.has(host))
      S.fail('Local connections only.', 403);
    if (req.headers.origin) {
      const locallyTrusted = new Set([
        `http://localhost:${UI_PORT}`,
        `http://127.0.0.1:${UI_PORT}`,
        `http://localhost:${PORT}`,
      ]);
      const allowed =
        deploymentMode === 'local' ? locallyTrusted : trustedOrigins;
      if (!allowed.has(req.headers.origin)) S.fail('Origin not allowed.', 403);
    }
    const url = new URL(req.url, `http://localhost:${PORT}`),
      parts = url.pathname.split('/').filter(Boolean),
      method = req.method;
    if (parts[0] !== 'api') S.fail('Not found', 404);
    if (parts[1] === 'media' && method === 'GET')
      return serveMedia(req, res, parts[2]);
    if (parts[1] === 'exports' && method === 'GET' && parts[3])
      return serveExport(res, parts[2], parts[3]);
    if (parts[1] === 'status' && method === 'GET')
      return json(res, {
        falConfigured: !!secret('FAL_KEY'),
        credentialMode: deploymentMode,
        credentials: await credentials(),
        ffmpeg,
        storage: S.DATA,
        models: MODELS,
        providers: PROVIDER_CATALOG,
        checks: S.CHECKS,
      });
    if (parts[1] === 'models' && parts[2] === 'catalog' && method === 'GET')
      return json(res, { models: await falCatalog() });
    if (parts[1] === 'credentials') {
      if (method === 'GET') return json(res, await credentials());
      if (method === 'POST')
        return json(res, await saveCredential(await body(req)), 201);
      if (method === 'DELETE')
        return json(res, await removeCredential(parts[2]));
    }
    if (parts[1] !== 'films') S.fail('Not found.', 404);
    if (parts.length === 2) {
      if (method === 'GET') return json(res, S.listFilms());
      if (method === 'POST')
        return json(res, S.createFilm(await body(req)), 201);
    }
    const id = parts[2];
    S.getFilm(id);
    if (parts.length === 3) {
      if (method === 'GET') {
        return json(res, S.getFilm(id));
      }
      if (method === 'PATCH') return json(res, S.editFilm(id, await body(req)));
    }
    const resource = parts[3],
      rid = parts[4];
    if (resource === 'subtitles' && method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'application/x-subrip; charset=utf-8',
        'Content-Disposition': 'attachment; filename="subtitles.srt"',
        'Cache-Control': 'no-store',
      });
      return res.end(subtitles(S.getFilm(id)));
    }
    if (resource === 'workflow') {
      if (method === 'GET') return json(res, workflowState(S.getFilm(id)));
      const b = await body(req);
      if (rid === 'preview' && method === 'POST')
        return json(res, planPreview(id, b));
      if (!rid && method === 'POST') return json(res, createPlan(id, b), 202);
      if (rid && method === 'PATCH') return json(res, revisePlan(id, rid, b));
      if (parts[5] === 'approve' && method === 'POST')
        return json(res, approvePlan(id, rid, b));
      S.fail('Not found.', 404);
    }
    if (resource === 'events' && method === 'GET')
      return json(res, S.events(id));
    if (resource === 'issues' && method === 'GET')
      return json(res, S.issues(S.getFilm(id)));
    if (resource === 'archive' && method === 'GET') {
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="production.json"',
      );
      return json(res, manifest(id));
    }
    if (resource === 'exports') {
      if (method === 'GET') return json(res, listExports(id));
      if (method === 'POST') {
        if (!ffmpeg) S.fail('FFmpeg is required for video export.');
        return json(res, startExport(id, await body(req)), 202);
      }
    }
    if (resource === 'import' && method === 'POST') {
      if (url.searchParams.get('shotId'))
        S.find(S.getFilm(id), 'shots', url.searchParams.get('shotId'));
      return json(
        res,
        await importAsset(
          id,
          url.searchParams.get('shotId'),
          req,
          url.searchParams.get('name') || 'import.bin',
        ),
      );
    }
    const b = await body(req);
    if (resource === 'shots' && parts[5] === 'prepare-locations' && method === 'POST')
      return json(res, S.prepareShotLocations(id, rid));
    if (resource === 'cut-history' && method === 'POST')
      return json(res, S.travelCutHistory(id, b.direction));
    if (resource === 'versions' && parts[5] === 'frame' && method === 'POST')
      return json(res, await extractFrame(id, rid, b), 201);
    if (resource === 'scenes' && method === 'PATCH')
      return json(res, S.editScene(id, rid, b));
    if (resource === 'versions' && parts[5] === 'cost' && method === 'POST')
      return json(res, S.recordCost(id, rid, b));
    if (resource === 'versions' && parts[5] === 'restore' && method === 'POST')
      return json(res, S.restoreVersion(id, rid));
    if (resource === 'versions' && method === 'DELETE')
      return json(res, S.deleteVersion(id, rid).film);
    if (resource === 'scenes' && method === 'POST')
      return json(res, S.addScene(id, b));
    if (resource === 'shots') {
      if (method === 'POST' && !rid) return json(res, S.addShot(id, b));
      if (method === 'PATCH') return json(res, S.editShot(id, rid, b));
      if (method === 'POST' && parts[5] === 'select')
        return json(res, S.selectVersion(id, rid, b.versionId));
    }
    if (resource === 'entities' && ['POST', 'PATCH'].includes(method))
      return json(res, S.saveEntity(id, b, rid));
    if (resource === 'versions' && method === 'PATCH')
      return json(res, S.reviewVersion(id, rid, b));
    if (
      resource === 'versions' &&
      parts[5] === 'reconcile' &&
      method === 'POST'
    )
      return json(res, reconcile(id, rid, b));
    if (resource === 'cut' && method === 'POST')
      return json(res, S.reorder(id, b.order));
    if (resource === 'tracks') {
      if (method === 'POST') return json(res, S.addTrack(id, b));
      if (method === 'PATCH') return json(res, S.updateTrack(id, rid, b));
    }
    if (resource === 'generate' && method === 'POST')
      return json(res, generate(id, b), 202);
    if (resource === 'preview' && method === 'POST')
      return json(res, preview(id, b));
    S.fail('Not found.', 404);
  } catch (e) {
    if (!res.headersSent)
      json(res, { error: e.message || 'Server error' }, e.status || 500);
    else res.end();
  }
});
server.listen(PORT, deploymentMode === 'remote' ? '0.0.0.0' : '127.0.0.1', () =>
  console.log(
    `Frameforge production API (${deploymentMode}): http://${deploymentMode === 'remote' ? '0.0.0.0' : '127.0.0.1'}:${PORT}`,
  ),
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    clearInterval(worker);
    clearInterval(planningWorker);
    server.close(() => process.exit(0));
  });
