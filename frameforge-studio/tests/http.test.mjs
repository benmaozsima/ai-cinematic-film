import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
const folder = mkdtempSync(resolve(tmpdir(), 'frameforge-http-'));
const base = 'http://127.0.0.1:3421/api';
async function start() {
  const child = spawn(process.execPath, ['server/index.mjs'], {
    env: {
      ...process.env,
      API_PORT: '3421',
      UI_PORT: '3420',
      FRAMEFORGE_DATA_DIR: folder,
      FAL_KEY: '',
    },
    stdio: 'ignore',
  });
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(base + '/status');
      if (r.ok) return child;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  child.kill();
  throw Error('API did not start');
}
async function stop(child) {
  const exit = new Promise((r) => child.once('exit', r));
  child.kill('SIGTERM');
  await exit;
}
async function request(path, body) {
  const r = await fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: r.status, data: await r.json() };
}
void test('HTTP API persists across restarts, rejects foreign origins, and never exposes credentials', async () => {
  let child = await start();
  try {
    const status = await (await fetch(base + '/status')).json();
    assert.equal(status.falConfigured, false);
    assert.equal(status.falKey, undefined);
    assert.equal(status.credentialMode, 'local');
    assert.deepEqual(Object.keys(status.credentials[0]).sort(), [
      'configured',
      'editable',
      'envName',
      'label',
      'source',
    ]);
    assert.equal(status.credentials[0].envName, 'FAL_KEY');
    assert.equal(status.credentials[0].secret, undefined);
    const f = await request('/films', { title: 'Persisted film' });
    assert.equal(f.status, 201);
    const scene = await request(`/films/${f.data.id}/scenes`, {
      title: 'INT. STUDIO — DAY',
    });
    const shot = await request(`/films/${f.data.id}/shots`, {
      title: 'Close-up',
      sceneId: scene.data.scenes[0].id,
    });
    assert.equal(shot.status, 200);
    const originalDuration=shot.data.shots[0].duration;
    const timing=await fetch(`${base}/films/${f.data.id}/shots/${shot.data.shots[0].id}`, {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({duration:2})});
    assert.equal(timing.status,200);
    const undo=await request(`/films/${f.data.id}/cut-history`,{direction:'undo'});
    assert.equal(undo.status,200);
    assert.equal(undo.data.shots[0].duration,originalDuration);
    const redo=await request(`/films/${f.data.id}/cut-history`,{direction:'redo'});
    assert.equal(redo.status,200);
    assert.equal(redo.data.shots[0].duration,2);
    const shotId=shot.data.shots[0].id;
    await fetch(`${base}/films/${f.data.id}/shots/${shotId}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({entityIds:[]})});
    const beforeRead=await (await fetch(`${base}/films/${f.data.id}`)).json();
    const afterRead=await (await fetch(`${base}/films/${f.data.id}`)).json();
    assert.equal(afterRead.revision,beforeRead.revision);
    assert.deepEqual(afterRead.shots[0].entityIds,[]);
    const prepared=await request(`/films/${f.data.id}/shots/${shotId}/prepare-locations`,{});
    assert.equal(prepared.status,200);
    assert.equal(prepared.data.shots[0].entityIds.length,1);


    const workflow = await (
      await fetch(`${base}/films/${f.data.id}/workflow`)
    ).json();
    assert.equal(workflow.drafts.length, 0);
    assert.ok(workflow.writers.includes('google/gemini-2.5-flash'));
    const preview = await request(`/films/${f.data.id}/workflow/preview`, {
      stage: 'story',
      model: workflow.writers[0],
      instructions: 'סיפור קצר בעברית',
      language: 'he',
    });
    assert.equal(preview.status, 200);
    assert.equal(preview.data.endpoint, 'fal-ai/any-llm');
    assert.match(preview.data.input.system_prompt, /Hebrew/);
    const captionResponse = await fetch(`${base}/films/${f.data.id}/subtitles`);
    assert.equal(captionResponse.status, 200);
    assert.match(captionResponse.headers.get('content-type'), /subrip/);
    const denial = await fetch(base + '/films', {
      method: 'POST',
      headers: {
        Origin: 'https://untrusted.example',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: 'Forbidden' }),
    });
    assert.equal(denial.status, 403);
    const bad = await request(`/films/${f.data.id}/cut`, {
      order: ['not-a-shot'],
    });
    assert.equal(bad.status, 400);
    await stop(child);
    child = await start();
    const persisted = await (await fetch(base + `/films/${f.data.id}`)).json();
    assert.equal(persisted.shots[0].title, 'Close-up');
    assert.equal(persisted.scenes.length, 1);
  } finally {
    await stop(child);
    rmSync(folder, { recursive: true, force: true });
  }
});

void test('remote mode reports environment credentials without returning or accepting secrets', async () => {
  const remoteFolder = mkdtempSync(resolve(tmpdir(), 'frameforge-remote-'));
  const remotePort = 3422;
  const remoteBase = `http://127.0.0.1:${remotePort}/api`;
  const child = spawn(process.execPath, ['server/index.mjs'], {
    env: {
      ...process.env,
      API_PORT: String(remotePort),
      UI_PORT: '3420',
      FRAMEFORGE_DATA_DIR: remoteFolder,
      FRAMEFORGE_DEPLOYMENT_MODE: 'remote',
      FRAMEFORGE_TRUSTED_ORIGINS: 'https://studio.example.com',
      FRAMEFORGE_CREDENTIALS: 'FAL_KEY,OPENAI_API_KEY',
      FAL_KEY: 'remote-secret-that-must-not-leak',
      OPENAI_API_KEY: '',
    },
    stdio: 'ignore',
  });
  try {
    for (let i = 0; i < 60; i++) {
      try {
        const response = await fetch(`${remoteBase}/status`);
        if (response.ok) break;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const status = await (await fetch(`${remoteBase}/status`)).json();
    assert.equal(status.credentialMode, 'remote');
    assert.deepEqual(status.credentials, [
      {
        envName: 'FAL_KEY',
        label: 'FAL',
        configured: true,
        source: 'remote-environment',
        editable: false,
      },
      {
        envName: 'OPENAI_API_KEY',
        label: 'OPENAI_API_KEY',
        configured: false,
        source: 'not-configured',
        editable: false,
      },
    ]);
    assert.equal(
      JSON.stringify(status).includes('remote-secret-that-must-not-leak'),
      false,
    );
    const denied = await fetch(`${remoteBase}/credentials`, {
      method: 'POST',
      headers: {
        Origin: 'https://studio.example.com',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        label: 'OpenAI',
        envName: 'OPENAI_API_KEY',
        secret: 'new-secret',
      }),
    });
    assert.equal(denied.status, 409);
    const foreignOrigin = await fetch(`${remoteBase}/status`, {
      headers: { Origin: 'https://untrusted.example' },
    });
    assert.equal(foreignOrigin.status, 403);
  } finally {
    const exited = new Promise((resolve) => child.once('exit', resolve));
    child.kill('SIGTERM');
    await exited;
    rmSync(remoteFolder, { recursive: true, force: true });
  }
});
