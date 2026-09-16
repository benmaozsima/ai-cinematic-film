import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { matchesApprovedDialogue } from '../shared/script-contract.mjs';
export const uid = () => randomUUID(),
  now = () => new Date().toISOString();
export const DATA = resolve(process.env.FRAMEFORGE_DATA_DIR || 'studio-data');
mkdirSync(DATA, { recursive: true });
export const db = new DatabaseSync(resolve(DATA, 'production.sqlite'));
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS films(id TEXT PRIMARY KEY,data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY AUTOINCREMENT,film_id TEXT NOT NULL REFERENCES films(id),at TEXT NOT NULL,action TEXT NOT NULL,data TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_events_film ON events(film_id,id);
CREATE TABLE IF NOT EXISTS exports(id TEXT PRIMARY KEY,film_id TEXT NOT NULL REFERENCES films(id),data TEXT NOT NULL); PRAGMA optimize;`);
export function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}
export function required(v, label = 'Name', max = 10000) {
  if (typeof v !== 'string' || !v.trim() || v.length > max)
    fail(`${label} is required (maximum ${max} characters).`);
  return v.trim();
}
export function number(v, min, max, label) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max)
    fail(`${label} must be between ${min} and ${max}.`);
  return n;
}
export const listFilms = () =>
  db
    .prepare('SELECT data FROM films')
    .all()
    .map((r) => {
      const f = JSON.parse(r.data);
      return {
        id: f.id,
        title: f.title,
        logline: f.logline,
        updatedAt: f.updatedAt,
      };
    });
export function getFilm(id) {
  const r = db.prepare('SELECT data FROM films WHERE id=?').get(id);
  if (!r) fail('Film not found.', 404);
  return JSON.parse(r.data);
}
export function mutate(id, action, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const f = getFilm(id);
    const recordCut = ['cut.version_selected', 'cut.reordered', 'shot.updated'].includes(action);
    const beforeCut = recordCut ? structuredClone(f.shots) : [];
    const result = fn(f);
    if (recordCut) {
      const changes = [];
      for (const shot of f.shots) {
        const before = beforeCut.find(s => s.id === shot.id);
        if (!before) continue;
        for (const key of ['selectedVersionId','order','trimIn','duration','originalAudioMuted']) {
          const previous = before[key] ?? null, next = shot[key] ?? null;
          if (previous !== next) changes.push({shotId:shot.id,key,before:previous,after:next});
        }
      }
      if (changes.length) {
        f.cutHistory ||= {past:[],future:[]};
        f.cutHistory.past.push({id:uid(),action,at:now(),changes});
        f.cutHistory.past = f.cutHistory.past.slice(-100);
        f.cutHistory.future = [];
      }
    }
    f.updatedAt = now();
    f.revision++;
    db.prepare('UPDATE films SET data=? WHERE id=?').run(JSON.stringify(f), id);
    db.prepare(
      'INSERT INTO events(film_id,at,action,data) VALUES (?,?,?,?)',
    ).run(id, now(), action, JSON.stringify(result ?? {}));
    db.exec('COMMIT');
    return f;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
export function createFilm(b) {
  const f = {
    id: uid(),
    title: required(b.title, 'Film title', 160),
    logline: b.logline || '',
    screenplay: '',
    style: '',
    aspectRatio: '16:9',
    fps: 24,
    budget: 100,
    bibleRevision: 0,
    revision: 1,
    createdAt: now(),
    updatedAt: now(),
    scenes: [],
    shots: [],
    entities: [],
    versions: [],
    tracks: [],
    jobs: [],
  };
  db.prepare('INSERT INTO films VALUES (?,?)').run(f.id, JSON.stringify(f));
  db.prepare('INSERT INTO events(film_id,at,action,data) VALUES (?,?,?,?)').run(
    f.id,
    now(),
    'film.created',
    JSON.stringify({ title: f.title }),
  );
  return f;
}
// Called during planning mutations, never while reading a film.
export function prepareLocationsForShots(f, shotIds) {
  const changed = [];
  for (const sid of shotIds) {
    const shot = find(f, 'shots', sid);
    const linked = [...(shot.entityIds || []), ...(shot.locationEntityIds || [])];
    if (linked.some(id => f.entities.some(e=>e.id===id && e.type==='location'))) continue;
    const scene = f.scenes.find(scene=>scene.id===shot.sceneId);
    if (!scene) continue;
    const explicitId = scene.locationEntityId || scene.locationId ||
      (Array.isArray(scene.locationEntityIds) ? scene.locationEntityIds[0] : null);
    let location = explicitId
      ? f.entities.find(e => e.id === explicitId && e.type === 'location')
      : null;
    const explicitName = typeof scene.location === 'string' ? scene.location.trim() : '';
    let name = explicitName;
    if (!location && !name) {
      const raw = String(scene.title || '').trim();
      const screenplayHeading = /^(?:\d+\s*[.)-]\s*)?(?:INT\s*\/\s*EXT|EXT\s*\/\s*INT|INT|EXT|פנים|חוץ)[.\s]+/i.test(raw);
      const stripped = raw.replace(/^\s*(?:\d+\s*[.)-]\s*)?(?:INT\s*\/\s*EXT|EXT\s*\/\s*INT|INT|EXT|פנים|חוץ)[.\s]+/i, '');
      // Production board titles often carry the location after a pipe. A
      // numbered title without a screenplay heading is metadata, not a place.
      if (stripped.includes('|')) name = stripped.split('|').at(-1).trim();
      else if (screenplayHeading) name = stripped.split(/\s+[—–-]\s+/)[0].trim();
    }
    if (!location && !name) continue;
    location ||= f.entities.find(e=>e.type==='location' && e.name.trim().toLowerCase()===name.toLowerCase());
    if (!location) {
      location = {id:uid(), type:'location', name, description:`${name}.`,
        continuity:'Preserve geography, materials, entrances and recurring landmarks.',
        locked:false, referenceVersionIds:[]};
      f.entities.push(location);
    }
    shot.entityIds = [...new Set([...(shot.entityIds || []), location.id])];
    shot.continuityRevision = (shot.continuityRevision || 0) + 1;
    changed.push({shotId:sid, locationId:location.id});
  }
  return changed;
}
export function prepareShotLocations(id, sid) {
  return mutate(id, 'shot.locations_prepared', f=>({links:prepareLocationsForShots(f,[sid])}));
}
export function events(id) {
  getFilm(id);
  return db
    .prepare('SELECT * FROM events WHERE film_id=? ORDER BY id DESC')
    .all(id)
    .map((r) => ({ ...r, data: JSON.parse(r.data) }));
}
export function find(f, key, id) {
  const v = f[key].find((x) => x.id === id);
  if (!v) fail(`${key} record not found.`, 404);
  return v;
}
export const CHECKS = {
  image: [
    'Cinematic composition',
    'Character identity & age',
    'Wardrobe & proportions',
    'Anatomy & realism',
    'Props & object orientation',
    'Location & lighting',
    'Screens & readable text',
    'Unwanted people & glitches',
  ],
  video: [
    'Cinematic composition',
    'Character identity & age',
    'Wardrobe & proportions',
    'Anatomy & realism',
    'Props & object orientation',
    'Location & lighting',
    'Screens & readable text',
    'Unwanted people & glitches',
    'Motion & temporal consistency',
    'Scripted action is visible',
    'Camera language & continuity',
    'Dialogue performance',
    'Spoken words match approved dialogue',
    'Audio quality',
    'Lip-sync',
  ],
  audio: [
    'Dialogue performance',
    'Spoken words match approved dialogue',
    'Pronunciation & timing',
    'Voice identity',
    'Audio quality',
    'Music / sound creative fit',
  ],
};
export function scriptContractIssue(f, v) {
  const shot = v.shotId && f.shots.find((s) => s.id === v.shotId);
  if (!shot || v.source !== 'generation') return null;
  if (v.kind === 'video' && v.checks?.['Scripted action is visible'] !== 'pass')
    return 'Confirm that the required screenplay action is visible before approval.';
  const dialogue = shot.dialogue;
  if (!dialogue) return null;
  if (v.workflowTask === 'dialogue' || v.model?.includes('elevenlabs/tts')) {
    if (!matchesApprovedDialogue(v.input?.text, dialogue))
      return 'The generated speech text differs from the approved screenplay dialogue.';
    if (v.checks?.['Spoken words match approved dialogue'] !== 'pass')
      return 'Confirm that the spoken words match the approved screenplay dialogue.';
  }
  if (v.workflowTask === 'lipsync' || v.model?.includes('sync-lipsync')) {
    const audio = (v.references || [])
      .map((id) => f.versions.find((candidate) => candidate.id === id))
      .find((candidate) => candidate?.kind === 'audio');
    if (!audio || scriptContractIssue(f, audio))
      return 'Lip-sync must use an approved dialogue recording that matches the screenplay.';
    if (v.checks?.['Spoken words match approved dialogue'] !== 'pass')
      return 'Confirm that the lip-synced words match the approved screenplay dialogue.';
  }
  return null;
}
export function qcComplete(f, v) {
  return (
    !scriptContractIssue(f, v) &&
    (CHECKS[v.kind] || []).every((k) =>
      ['pass', 'na'].includes(v.checks?.[k]),
    ) &&
    !(v.notes || []).some((n) => !n.resolved) &&
    v.reviewBibleRevision === f.bibleRevision &&
    (!v.shotId ||
      (v.reviewShotRevision ?? 0) ===
        (f.shots.find((s) => s.id === v.shotId)?.continuityRevision ?? 0))
  );
}
export function issues(f) {
  const out = [];
  for (const s of f.shots) {
    if (s.connection?.mode === 'continue') {
      const ordered=[...f.shots].sort((a,b)=>a.order-b.order);
      const previous=ordered[ordered.findIndex(shot=>shot.id===s.id)-1], link=s.connection;
      if (!previous || previous.id!==link.sourceShotId || previous.selectedVersionId!==link.sourceVersionId || (previous.trimIn||0)!==link.sourceTrimIn || previous.duration!==link.sourceDuration)
        out.push({shotId:s.id,severity:'warning',text:`${s.code}: פריים החיבור מיושן לאחר שינוי השוט הקודם.`});
    }
    const v = f.versions.find((v) => v.id === s.selectedVersionId);
    if (!v)
      out.push({
        shotId: s.id,
        severity: 'warning',
        text: `${s.code}: no selected picture.`,
      });
    else {
      if (v.status !== 'approved')
        out.push({
          shotId: s.id,
          severity: 'warning',
          text: `${s.code}: selected version needs approval.`,
        });
      if (!qcComplete(f, v))
        out.push({
          shotId: s.id,
          severity: 'warning',
          text: `${s.code}: ${scriptContractIssue(f, v) || 'review incomplete or production bible / shot direction changed.'}`,
        });
      if (v.kind === 'image')
        out.push({
          shotId: s.id,
          severity: 'info',
          text: `${s.code}: still frame in cut (animatic).`,
        });
    }
    for (const eid of s.entityIds) {
      const e = f.entities.find((e) => e.id === eid);
      if (!e?.locked)
        out.push({
          shotId: s.id,
          severity: 'warning',
          text: `${s.code}: ${e?.name || 'reference'} is not locked.`,
        });
    }
    if (!s.prompt)
      out.push({
        shotId: s.id,
        severity: 'info',
        text: `${s.code}: shot direction missing.`,
      });
  }
  return out;
}
export function assemblePrompt(f, s, prompt, correction = '') {
  const entityIds = [
    ...(s.entityIds || []),
    ...(s.locationEntityIds || []),
  ];
  const entities = [...new Set(entityIds)].map((id) => find(f, 'entities', id));
  return {
    prompt: [
      prompt,
      `CAMERA: ${s.camera || 'As directed'}. LIGHTING: ${s.lighting || 'As directed'}.`,
      f.style && `FILM STYLE: ${f.style}`,
      entities
        .map(
          (e) =>
            `${e.type.toUpperCase()} ${e.name}${e.locked ? ' [LOCKED]' : ''}: ${e.description}\nContinuity: ${e.continuity}`,
        )
        .join('\n'),
      s.continuity && `SHOT CONTINUITY: ${s.continuity}`,
      correction && `CORRECTION FOR THIS VERSION: ${correction}`,
    ]
      .filter(Boolean)
      .join('\n\n'),
    context: {
      bibleRevision: f.bibleRevision,
      style: f.style,
      entities: structuredClone(entities),
      shot: structuredClone(s),
    },
  };
}
export function editFilm(id, b) {
  return mutate(id, 'film.updated', (f) => {
    const before = {
      title: f.title,
      logline: f.logline,
      screenplay: f.screenplay,
      style: f.style,
      aspectRatio: f.aspectRatio,
      fps: f.fps,
      budget: f.budget,
    };
    for (const k of ['title', 'logline', 'screenplay', 'style'])
      if (b[k] !== undefined) {
        if (typeof b[k] !== 'string' || b[k].length > 200000)
          fail('Invalid text.');
        f[k] = b[k];
      }
    required(f.title, 'Film title', 160);
    if (b.aspectRatio) {
      if (!['16:9', '9:16', '1:1', '2.39:1'].includes(b.aspectRatio))
        fail('Invalid aspect ratio');
      f.aspectRatio = b.aspectRatio;
    }
    if (b.fps !== undefined) f.fps = number(b.fps, 1, 60, 'Frame rate');
    if (b.budget !== undefined)
      f.budget = number(b.budget, 0, 1000000, 'Budget');
    if (f.style !== before.style) f.bibleRevision++;
    return { before, after: b };
  });
}
export function addScene(id, b) {
  return mutate(id, 'scene.created', (f) => {
    const s = {
      id: uid(),
      title: required(b.title, 'Scene heading', 200),
      summary: b.summary || '',
      order: f.scenes.length,
    };
    f.scenes.push(s);
    return s;
  });
}
export function addShot(id, b) {
  return mutate(id, 'shot.created', (f) => {
    if (b.sceneId) find(f, 'scenes', b.sceneId);
    const s = {
      id: uid(),
      code: `SH${String(f.shots.length + 1).padStart(3, '0')}`,
      title: required(b.title, 'Shot title', 200),
      sceneId: b.sceneId || '',
      prompt: b.prompt || '',
      dialogue: b.dialogue || '',
      referenceVersionIds: [],
      camera: b.camera || '35mm · locked-off',
      lighting: b.lighting || '',
      continuity: b.continuity || '',
      duration: number(b.duration || 5, 0.1, 600, 'Duration'),
      trimIn: 0,
      originalAudioMuted: false,
      entityIds: [],
      selectedVersionId: null,
      order: f.shots.length,
    };
    f.shots.push(s);
    prepareLocationsForShots(f, [s.id]);
    return s;
  });
}
export function editShot(id, sid, b) {
  return mutate(id, 'shot.updated', (f) => {
    const s = find(f, 'shots', sid),
      before = structuredClone(s);
    for (const k of [
      'title',
      'prompt',
      'dialogue',
      'camera',
      'lighting',
      'continuity',
      'sceneId',
    ])
      if (b[k] !== undefined) s[k] = String(b[k]).slice(0, 20000);
    if (b.connection !== undefined) {
      if (b.connection?.mode !== 'cut') fail('Use frame extraction to create a continuation.');
      s.connection = {mode:'cut'};
    }
    required(s.title);
    if (s.sceneId) find(f, 'scenes', s.sceneId);
    if (b.duration !== undefined)
      s.duration = number(b.duration, 0.1, 600, 'Duration');
    if (b.trimIn !== undefined)
      s.trimIn = number(b.trimIn, 0, 36000, 'Trim in');
    if (b.originalAudioMuted !== undefined) {
      if (typeof b.originalAudioMuted !== 'boolean')
        fail('Original audio mute must be true or false.');
      s.originalAudioMuted = b.originalAudioMuted;
    }
    if (b.captions !== undefined) {
      if (!Array.isArray(b.captions) || b.captions.length > 100)
        fail('Invalid caption list.');
      s.captions = b.captions
        .map((c) => {
          const start = number(c.start, 0, s.duration, 'Caption start');
          const end = number(c.end, 0, s.duration, 'Caption end');
          if (end <= start) fail('Caption end must be after its start.');
          return {
            start,
            end,
            text: required(c.text, 'Caption text', 2000)
              .replaceAll('-->', '→')
              .replace(/\r/g, '')
              .replace(/\n{2,}/g, '\n'),
          };
        })
        .sort((a, b) => a.start - b.start);
      if (s.captions.some((c, i, arr) => i > 0 && c.start < arr[i - 1].end))
        fail('Caption times cannot overlap within a shot.');
    }
    if ((s.captions || []).some((c) => c.end > s.duration))
      fail('Adjust captions before shortening this shot.');
    if (b.entityIds) {
      if (!Array.isArray(b.entityIds)) fail('Invalid references');
      for (const eid of b.entityIds) find(f, 'entities', eid);
      s.entityIds = [...new Set(b.entityIds)];
      s.locationEntityIds = [];
    }
    if (b.referenceVersionIds) {
      if (!Array.isArray(b.referenceVersionIds)) fail('Invalid asset references');
      for (const vid of b.referenceVersionIds) {
        const version = find(f, 'versions', vid);
        if (version.status === 'rejected' || !version.localPath)
          fail('Asset references must be ready and not rejected.');
      }
      s.referenceVersionIds = [...new Set(b.referenceVersionIds)];
    }
    if (
      [
        'prompt',
        'camera',
        'lighting',
        'continuity',
        'dialogue',
        'entityIds',
        'referenceVersionIds',
      ].some((k) => JSON.stringify(before[k]) !== JSON.stringify(s[k]))
    )
      s.continuityRevision = (s.continuityRevision || 0) + 1;
    return { before, after: s };
  });
}
export function saveEntity(id, b, eid) {
  return mutate(id, eid ? 'entity.updated' : 'entity.created', (f) => {
    const e = eid
        ? find(f, 'entities', eid)
        : { id: uid(), referenceVersionIds: [] },
      before = structuredClone(e);
    e.name = required(b.name, 'Name', 160);
    if (!['character', 'location', 'prop', 'style', 'voice'].includes(b.type))
      fail('Invalid bible category.');
    e.type = b.type;
    e.description = String(b.description || '').slice(0, 20000);
    e.continuity = String(b.continuity || '').slice(0, 20000);
    e.locked = Boolean(b.locked);
    e.referenceVersionIds = b.referenceVersionIds || [];
    for (const vid of e.referenceVersionIds) find(f, 'versions', vid);
    if (!eid) f.entities.push(e);
    f.bibleRevision++;
    return { before, after: e };
  });
}
export function reviewVersion(id, vid, b) {
  return mutate(id, 'version.reviewed', (f) => {
    const v = find(f, 'versions', vid),
      before = {
        checks: structuredClone(v.checks),
        status: v.status,
        notes: structuredClone(v.notes),
      };
    if (!v.localPath) fail('Asset is not ready to review.');
    if (b.checks) {
      for (const [k, val] of Object.entries(b.checks))
        if (
          !(CHECKS[v.kind] || []).includes(k) ||
          !['pass', 'fail', 'na', 'pending'].includes(val)
        )
          fail('Invalid review check.');
      const shotRevision = v.shotId
        ? find(f, 'shots', v.shotId).continuityRevision || 0
        : 0;
      if (
        v.reviewBibleRevision !== f.bibleRevision ||
        (v.reviewShotRevision || 0) !== shotRevision
      )
        v.checks = {};
      v.reviewShotRevision = shotRevision;
      v.checks = { ...v.checks, ...b.checks };
      v.reviewBibleRevision = f.bibleRevision;
    }
    if (b.note)
      v.notes.push({
        id: uid(),
        text: required(b.note, 'Correction note', 10000),
        time:
          b.time === undefined ? null : number(b.time, 0, 36000, 'Timecode'),
        x: b.x == null ? null : number(b.x, 0, 1, 'X'),
        y: b.y == null ? null : number(b.y, 0, 1, 'Y'),
        createdAt: now(),
        resolved: false,
      });
    if (b.resolveNote) {
      const n = v.notes.find((n) => n.id === b.resolveNote);
      if (!n) fail('Note not found');
      n.resolved = !n.resolved;
    }
    if (b.status) {
      if (!['review', 'rejected', 'approved'].includes(b.status))
        fail('Invalid review state.');
      if (b.status === 'approved' && !qcComplete(f, v))
        fail(scriptContractIssue(f, v) ||
          'Complete all review checks and resolve correction notes before approval. Recheck after bible changes.');
      v.status = b.status;
      if (b.status === 'approved' && v.entityId) {
        const entity = find(f, 'entities', v.entityId);
        entity.referenceVersionIds = [
          ...new Set([...(entity.referenceVersionIds || []), v.id]),
        ];
      }
      if (b.status === 'rejected')
        for (const shot of f.shots)
          if (shot.selectedVersionId === v.id) shot.selectedVersionId = null;
      if (b.status === 'rejected' && v.entityId) {
        const entity = find(f, 'entities', v.entityId);
        entity.referenceVersionIds = (entity.referenceVersionIds || []).filter(
          (id) => id !== v.id,
        );
      }
    }
    if (v.status === 'approved' && !qcComplete(f, v)) v.status = 'review';
    return {
      versionId: vid,
      before,
      after: { checks: v.checks, status: v.status, notes: v.notes },
    };
  });
}
export function selectVersion(id, sid, vid) {
  return mutate(id, 'cut.version_selected', (f) => {
    const s = find(f, 'shots', sid),
      v = find(f, 'versions', vid);
    if (
      v.shotId !== sid ||
      !['image', 'video'].includes(v.kind) ||
      !v.localPath ||
      v.status === 'rejected'
    )
      fail('Choose a ready, non-rejected picture version from this shot.');
    const previous = s.selectedVersionId;
    s.selectedVersionId = vid;
    return { shotId: sid, previous, selected: vid };
  });
}
export function deleteVersion(id, vid) {
  const film = mutate(id, 'version.archived', (f) => {
    const v = find(f, 'versions', vid);
    if (['queued', 'running', 'submission_unknown'].includes(v.status))
      fail('היצירה עדיין פעילה. אפשר להעביר לארכיון לאחר שתסתיים.');
    if (f.shots.some(s => s.selectedVersionId === vid || (s.referenceVersionIds || []).includes(vid) || s.connection?.frameVersionId === vid || s.connection?.sourceVersionId === vid) ||
        f.entities.some(e => (e.referenceVersionIds || []).includes(vid)) ||
        f.tracks.some(t => t.versionId === vid) ||
        f.versions.some(other => other.id !== vid && ((other.references || []).includes(vid) || other.parentVersionId === vid)))
      fail('הגרסה בשימוש בעריכה, ברפרנסים או בגרסה אחרת. יש להחליף את הקישור לפני העברה לארכיון.');
    f.archivedVersions ||= [];
    f.archivedVersions.push({...v, archivedAt: now()});
    f.versions = f.versions.filter(other => other.id !== vid);
    return {versionId: vid};
  });
  return {film};
}
export function restoreVersion(id, vid) {
  return mutate(id, 'version.restored', f => {
    const v = (f.archivedVersions || []).find(v => v.id === vid);
    if (!v) fail('Archived version not found.', 404);
    const restored = {...v}; delete restored.archivedAt;
    f.versions.push(restored);
    f.archivedVersions = f.archivedVersions.filter(v => v.id !== vid);
    return {versionId: vid};
  });
}
export function travelCutHistory(id, direction) {
  if (!['undo','redo'].includes(direction)) fail('Invalid history direction.');
  return mutate(id, 'cut.' + direction, f => {
    const history = f.cutHistory || {past:[],future:[]};
    const from = direction === 'undo' ? history.past : history.future;
    const to = direction === 'undo' ? history.future : history.past;
    const entry = from.at(-1);
    if (!entry) fail('אין פעולה נוספת לביטול או להחזרה.');
    for (const change of entry.changes) {
      const shot = find(f,'shots',change.shotId);
      const expected = direction === 'undo' ? change.after : change.before;
      const value = direction === 'undo' ? change.before : change.after;
      if ((shot[change.key] ?? null) !== expected) fail('העריכה השתנתה מאז הפעולה. לא נדרוס את השינויים החדשים.');
      if (change.key === 'selectedVersionId' && value) {
        const version = f.versions.find(v=>v.id===value);
        if (!version?.localPath || version.status==='rejected' || version.shotId!==shot.id) fail('הגרסה הקודמת אינה זמינה. יש לשחזר אותה מהארכיון או לבחור אחרת.');
      }
      if (change.key === 'duration' && (shot.captions || []).some(c=>c.end>value)) fail('יש להתאים את הכתוביות לפני קיצור השוט.');
      shot[change.key] = value;
    }
    from.pop(); to.push(entry); f.cutHistory=history;
    return {commandId:entry.id,changes:entry.changes};
  });
}
export function reorder(id, ids) {
  return mutate(id, 'cut.reordered', (f) => {
    if (
      !Array.isArray(ids) ||
      ids.length !== f.shots.length ||
      new Set(ids).size !== ids.length ||
      ids.some((id) => !f.shots.some((s) => s.id === id))
    )
      fail('Order must include every shot exactly once.');
    ids.forEach((id, i) => (find(f, 'shots', id).order = i));
    return { order: ids };
  });
}
export function addTrack(id, b) {
  return mutate(id, 'audio.track_added', (f) => {
    const v = find(f, 'versions', b.versionId);
    if (v.kind !== 'audio' || !v.localPath || v.status === 'rejected')
      fail('Choose a ready audio version.');
    const t = {
      id: uid(),
      versionId: v.id,
      label: b.label || 'Audio track',
      role: ['dialogue', 'music', 'sfx'].includes(b.role) ? b.role : 'music',
      start: number(b.start || 0, 0, 36000, 'Start'),
      gain: number(b.gain ?? 1, 0, 3, 'Gain'),
      muted: false,
    };
    f.tracks.push(t);
    return t;
  });
}
export function updateTrack(id, tid, b) {
  return mutate(id, 'audio.track_updated', (f) => {
    const t = find(f, 'tracks', tid),
      before = structuredClone(t);
    if (b.remove) {
      f.tracks = f.tracks.filter((t) => t.id !== tid);
      return { removed: before };
    }
    if (b.start !== undefined) t.start = number(b.start, 0, 36000, 'Start');
    if (b.gain !== undefined) t.gain = number(b.gain, 0, 3, 'Gain');
    if (b.muted !== undefined) t.muted = !!b.muted;
    return { before, after: t };
  });
}

export function editScene(id, sid, b) {
  return mutate(id, 'scene.updated', (f) => {
    const scene = find(f, 'scenes', sid),
      before = structuredClone(scene);
    scene.title = required(b.title, 'Scene heading', 200);
    scene.summary = String(b.summary || '').slice(0, 20000);
    return { before, after: scene };
  });
}
export function recordCost(id, vid, b) {
  return mutate(id, 'version.cost_recorded', (f) => {
    const v = find(f, 'versions', vid),
      previous = v.actualCost ?? null;
    v.actualCost = number(b.actualCost, 0, 1000000, 'Actual cost');
    return { versionId: vid, previous, actualCost: v.actualCost };
  });
}
