import {
  mkdirSync,
  writeFileSync,
  createReadStream,
  existsSync,
} from 'node:fs';
import { resolve } from 'node:path';
import {
  db,
  DATA,
  uid,
  now,
  getFilm,
  events,
  issues,
  qcComplete,
  fail,
  mutate,
} from './store.mjs';
import { run, absolute, probe } from './media.mjs';
import { subtitles } from './subtitles.mjs';
export const EXPORTS = resolve(DATA, 'exports');
mkdirSync(EXPORTS, { recursive: true });
export const listExports = (id) =>
  db
    .prepare('SELECT data FROM exports WHERE film_id=?')
    .all(id)
    .map((r) => JSON.parse(r.data));
function update(record) {
  db.prepare('INSERT OR REPLACE INTO exports VALUES (?,?,?)').run(
    record.id,
    record.filmId,
    JSON.stringify(record),
  );
}
export function manifest(id) {
  const f = getFilm(id);
  return {
    format: 'frameforge-production-archive',
    schemaVersion: 1,
    exportedAt: now(),
    film: f,
    events: events(id),
    warnings: issues(f),
  };
}
export function startExport(id, b) {
  const f = getFilm(id);
  if (!f.shots.length) fail('Add shots before exporting.');
  const shots = [...f.shots].sort((a, b) => a.order - b.order);
  for (const s of shots) {
    const v = f.versions.find((v) => v.id === s.selectedVersionId);
    if (!v?.localPath || v.status === 'rejected')
      fail(`${s.code} needs a selected, non-rejected picture.`);
    if (
      b.final &&
      (v.kind !== 'video' || v.status !== 'approved' || !qcComplete(f, v))
    )
      fail(
        `${s.code} needs an approved, fully reviewed video for final delivery.`,
      );
    if (v.kind === 'video' && s.trimIn + s.duration > v.duration + 0.1)
      fail(`${s.code} trim exceeds its source duration.`);
  }
  if (b.final && issues(f).some((i) => i.severity === 'warning'))
    fail('Resolve continuity warnings before final delivery.');
  for (const t of f.tracks.filter((t) => !t.muted)) {
    const v = f.versions.find((v) => v.id === t.versionId);
    if (!v?.localPath || v.status === 'rejected')
      fail('An audio track is unavailable.');
    if (b.final && (v.status !== 'approved' || !qcComplete(f, v)))
      fail('Approve all active audio tracks before final delivery.');
  }
  const rec = {
    id: uid(),
    filmId: id,
    title: f.title,
    createdAt: now(),
    status: 'rendering',
    progress: 'Preparing cut',
    final: !!b.final,
    revision: f.revision,
    shotCount: shots.length,
    filename: 'film.mp4',
    hasSubtitles: true,
  };
  const dir = resolve(EXPORTS, rec.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, 'subtitles.srt'), subtitles(f));
  writeFileSync(
    resolve(dir, 'production.json'),
    JSON.stringify(manifest(id), null, 2),
  );
  writeFileSync(
    resolve(dir, 'cut.csv'),
    [
      'shot,version,source,in_seconds,duration_seconds',
      ...shots.map((s) =>
        [
          s.code,
          s.selectedVersionId,
          f.versions.find((v) => v.id === s.selectedVersionId).localPath,
          s.trimIn,
          s.duration,
        ].join(','),
      ),
    ].join('\n'),
  );
  update(rec);
  mutate(id, 'export.started', () => rec);
  void render(f, shots, rec, dir);
  return rec;
}
async function render(f, shots, rec, dir) {
  try {
    let index = 0;
    const [w, h] =
      f.aspectRatio === '9:16'
        ? [1080, 1920]
        : f.aspectRatio === '1:1'
          ? [1080, 1080]
          : f.aspectRatio === '2.39:1'
            ? [1920, 804]
            : [1920, 1080];
    for (const s of shots) {
      rec.progress = `Rendering shot ${index + 1} of ${shots.length}`;
      update(rec);
      const v = f.versions.find((v) => v.id === s.selectedVersionId),
        file = absolute(v.localPath);
      const inputs =
        v.kind === 'image'
          ? ['-loop', '1', '-i', file]
          : ['-ss', String(s.trimIn), '-i', file];
      if (!v.hasAudio || v.kind === 'image')
        inputs.push('-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo');
      const out = resolve(dir, `part-${index++}.mp4`);
      await run(
        'ffmpeg',
        [
          '-hide_banner',
          '-loglevel',
          'error',
          '-y',
          ...inputs,
          '-map',
          '0:v:0',
          '-map',
          v.hasAudio && v.kind !== 'image' ? '0:a:0' : '1:a:0',
          '-t',
          String(s.duration),
          '-vf',
          `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${f.fps},format=yuv420p`,
          '-af',
          'apad',
          '-c:v',
          'libx264',
          '-preset',
          'fast',
          '-crf',
          '18',
          '-c:a',
          'aac',
          '-ar',
          '48000',
          '-ac',
          '2',
          out,
        ],
        { timeout: 600000, maxBuffer: 1024 * 1024 },
      );
    }
    writeFileSync(
      resolve(dir, 'concat.txt'),
      shots.map((_, i) => `file 'part-${i}.mp4'`).join('\n'),
    );
    await run(
      'ffmpeg',
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-y',
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        resolve(dir, 'concat.txt'),
        '-c',
        'copy',
        resolve(dir, 'picture.mp4'),
      ],
      { timeout: 600000 },
    );
    const tracks = f.tracks.filter((t) => !t.muted),
      duration = shots.reduce((n, s) => n + s.duration, 0);
    const args = [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-i',
      resolve(dir, 'picture.mp4'),
    ];
    if (tracks.length) {
      for (const t of tracks)
        args.push(
          '-i',
          absolute(f.versions.find((v) => v.id === t.versionId).localPath),
        );
      const filters = tracks.map(
        (t, i) =>
          `[${i + 1}:a]volume=${t.gain},adelay=${Math.round(t.start * 1000)}:all=1[a${i}]`,
      );
      filters.push(
        `[0:a]${tracks.map((_, i) => `[a${i}]`).join('')}amix=inputs=${tracks.length + 1}:duration=first:normalize=0,alimiter=limit=0.95:level=0[mix]`,
      );
      args.push(
        '-filter_complex',
        filters.join(';'),
        '-map',
        '0:v',
        '-map',
        '[mix]',
        '-c:a',
        'aac',
      );
    } else args.push('-map', '0', '-c:a', 'copy');
    args.push(
      '-c:v',
      'copy',
      '-t',
      String(duration),
      '-movflags',
      '+faststart',
      resolve(dir, 'film.mp4'),
    );
    await run('ffmpeg', args, { timeout: 600000, maxBuffer: 1024 * 1024 });
    const meta = await probe(resolve(dir, 'film.mp4'));
    rec.status = 'complete';
    rec.progress = 'Ready to download';
    rec.duration = Number(meta.format.duration);
    rec.completedAt = now();
    update(rec);
    mutate(f.id, 'export.completed', () => rec);
  } catch (e) {
    rec.status = 'failed';
    rec.error = String(e.message).slice(0, 2000);
    update(rec);
    mutate(f.id, 'export.failed', () => rec);
  }
}
export function recoverExports() {
  for (const row of db.prepare('SELECT data FROM exports').all()) {
    const r = JSON.parse(row.data);
    if (r.status === 'rendering') {
      r.status = 'failed';
      r.error =
        'Application stopped during rendering. Start a new export; the snapshot is preserved.';
      update(r);
    }
  }
}
export function serveExport(res, id, name) {
  if (
    !/^[a-f0-9-]{36}$/.test(id) ||
    !['film.mp4', 'production.json', 'cut.csv', 'subtitles.srt'].includes(name)
  )
    fail('Export not found.', 404);
  const file = resolve(EXPORTS, id, name);
  if (!existsSync(file)) fail('Export file is not ready.', 404);
  res.writeHead(200, {
    'Content-Type': name.endsWith('mp4')
      ? 'video/mp4'
      : name.endsWith('json')
        ? 'application/json'
        : name.endsWith('srt')
          ? 'application/x-subrip; charset=utf-8'
          : 'text/csv',
    'Content-Disposition': `attachment; filename="${name}"`,
  });
  createReadStream(file).pipe(res);
}
