import {
  mkdirSync,
  createReadStream,
  createWriteStream,
  statSync,
} from 'node:fs';
import { readFile, unlink, rename } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { Transform, Readable } from 'node:stream';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { DATA, fail, uid, now, mutate, find, getFilm, number } from './store.mjs';
export const run = promisify(execFile),
  MEDIA = resolve(DATA, 'media');
mkdirSync(MEDIA, { recursive: true });
export async function probe(path) {
  try {
    const { stdout } = await run(
      'ffprobe',
      ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', path],
      { timeout: 30000, maxBuffer: 2 * 1024 * 1024 },
    );
    return JSON.parse(stdout);
  } catch {
    fail(
      'File could not be read. Import a supported image, video, or audio file; FFmpeg must be installed.',
    );
  }
}
export function absolute(file) {
  if (!file || !/^[a-zA-Z0-9_.-]+$/.test(file)) fail('Invalid media path');
  return resolve(MEDIA, file);
}
export async function storeStream(stream, suffix = 'bin') {
  let filename = `${uid()}.${suffix.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'bin'}`;
  const path = absolute(filename),
    hash = createHash('sha256');
  let size = 0;
  const limit = new Transform({
    transform(chunk, _encoding, cb) {
      size += chunk.length;
      if (size > 250 * 1024 * 1024)
        return cb(new Error('Maximum asset size is 250 MB.'));
      hash.update(chunk);
      cb(null, chunk);
    },
  });
  try {
    await pipeline(stream, limit, createWriteStream(path));
    const meta = await probe(path);
    const visual = meta.streams.find((s) => s.codec_type === 'video');
    const duration = Number(meta.format?.duration || 0);
    const kind = visual
      ? duration > 0 &&
        !['png', 'mjpeg', 'webp', 'bmp', 'tiff'].includes(visual.codec_name)
        ? 'video'
        : 'image'
      : 'audio';
    if (!visual && !meta.streams.some((s) => s.codec_type === 'audio'))
      fail('No supported media stream.');
    if (suffix === 'bin') {
      const ext =
        kind === 'image'
          ? visual.codec_name === 'mjpeg'
            ? 'jpg'
            : visual.codec_name === 'webp'
              ? 'webp'
              : 'png'
          : kind === 'video'
            ? 'mp4'
            : meta.format?.format_name?.includes('mp3')
              ? 'mp3'
              : 'wav';
      const target = filename.replace(/\.bin$/, '.' + ext);
      await rename(path, absolute(target));
      filename = target;
    }
    return {
      localPath: filename,
      sha256: hash.digest('hex'),
      size,
      kind,
      duration: kind === 'image' ? 0 : duration,
      width: visual?.width || 0,
      height: visual?.height || 0,
      hasAudio: meta.streams.some((s) => s.codec_type === 'audio'),
    };
  } catch (e) {
    await unlink(path).catch(() => {});
    throw e;
  }
}
export async function downloadAsset(url) {
  const u = new URL(url);
  if (
    u.protocol !== 'https:' ||
    !(
      /(^|\.)fal\.media$/.test(u.hostname) ||
      u.hostname === 'storage.googleapis.com' ||
      /(^|\.)fal\.ai$/.test(u.hostname) ||
      /(^|\.)cloudfront\.net$/.test(u.hostname)
    )
  )
    fail('Provider returned an unsupported asset host.');
  const r = await fetch(u, {
    signal: AbortSignal.timeout(180000),
    redirect: 'error',
  });
  if (!r.ok) fail('Could not archive provider output.');
  return storeStream(
    Readable.fromWeb(r.body),
    extname(u.pathname).slice(1) || 'bin',
  );
}
export async function importAsset(filmId, shotId, req, name) {
  const media = await storeStream(req, extname(name).slice(1));
  return mutate(filmId, 'asset.imported', (f) => {
    if (shotId) find(f, 'shots', shotId);
    const v = {
      id: uid(),
      shotId: shotId || null,
      label: name.slice(0, 200),
      number:
        f.versions.filter((v) => v.shotId === (shotId || null)).length + 1,
      source: 'import',
      model: 'Original source',
      prompt: '',
      correction: '',
      references: [],
      input: { filename: name },
      context: { bibleRevision: f.bibleRevision },
      bibleRevision: f.bibleRevision,
      createdAt: now(),
      status: 'review',
      checks: {},
      notes: [],
      ...media,
    };
    f.versions.push(v);
    return v;
  });
}
export async function providerFile(v, fal) {
  const bytes = await readFile(absolute(v.localPath));
  return fal.storage.upload(
    new File([bytes], v.localPath, {
      type:
        {
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.webp': 'image/webp',
          '.mp3': 'audio/mpeg',
          '.wav': 'audio/wav',
          '.mp4': 'video/mp4',
          '.webm': 'video/webm',
          '.mov': 'video/quicktime',
        }[extname(v.localPath)] || 'application/octet-stream',
    }),
  );
}
export function serveMedia(req, res, file) {
  const path = absolute(file);
  let stat;
  try {
    stat = statSync(path);
  } catch {
    res.writeHead(404);
    return res.end();
  }
  const types = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    wav: 'audio/wav',
    mp3: 'audio/mpeg',
    webm: 'video/webm',
  };
  const headers = {
    'Content-Type': types[extname(file).slice(1)] || 'application/octet-stream',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
  };
  const match = req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
  if (match) {
    const start = Number(match[1]),
      end = match[2]
        ? Math.min(Number(match[2]), stat.size - 1)
        : stat.size - 1;
    if (start > end || start >= stat.size) {
      res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
      return res.end();
    }
    res.writeHead(206, {
      ...headers,
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Content-Length': end - start + 1,
    });
    createReadStream(path, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { ...headers, 'Content-Length': stat.size });
    createReadStream(path).pipe(res);
  }
}

// Reuse FFmpeg for frame extraction; retain the parent and exact source time.
export async function extractFrame(filmId, versionId, options = {}) {
  const film = getFilm(filmId);
  const parent = find(film, 'versions', versionId);
  const target = options.targetShotId ? find(film, 'shots', options.targetShotId) : null;
  const ordered = [...film.shots].sort((a,b)=>a.order-b.order);
  const previous = target ? ordered[ordered.findIndex(s=>s.id===target.id)-1] : null;
  if (target && (!previous || previous.id !== parent.shotId || previous.selectedVersionId !== parent.id)) fail('Choose the selected video of the immediately preceding shot.');
  if (parent.kind !== 'video' || !parent.localPath) fail('Choose a ready video.');
  const time = options.at === 'end'
    ? Math.max(0, Math.min(parent.duration, target ? (previous.trimIn || 0) + previous.duration : parent.duration) - 1 / (parent.fps || 24))
    : number(options.time, 0, Math.max(0, parent.duration - 0.001), 'Frame time');
  const path = absolute(uid() + '.png');
  try {
    await run('ffmpeg', ['-v', 'error', '-y', '-ss', String(time), '-i',
      absolute(parent.localPath), '-frames:v', '1', path], { timeout: 30000 });
    const stored = await storeStream(createReadStream(path), 'png');
    return mutate(filmId, 'asset.frame_extracted', (f) => {
      if (target && find(f, 'shots', previous.id).selectedVersionId !== parent.id) fail('Previous selection changed. Try again.');
      const v = { ...stored, id: uid(), shotId: target?.id || parent.shotId, workflowTask: target ? 'keyframe' : null,
        number: f.versions.filter((v) => v.shotId === parent.shotId).length + 1,
        label: 'Frame ' + time.toFixed(2) + 's · ' + parent.label,
        source: 'extracted-frame', model: 'FFmpeg frame extraction',
        parentVersionId: parent.id, references: [parent.id],
        prompt: '', correction: '', input: { sourceVersionId: parent.id, time },
        context: parent.context, bibleRevision: f.bibleRevision,
        status: 'review', checks: {}, notes: [], createdAt: now() };
      f.versions.push(v);
      if (target) {
        const shot = find(f, 'shots', target.id);
        shot.connection = {mode:'continue', sourceShotId:parent.shotId, sourceVersionId:parent.id, frameVersionId:v.id, time, sourceTrimIn:previous.trimIn || 0, sourceDuration:previous.duration};
      }
      return v;
    });
  } finally { await unlink(path).catch(() => {}); }
}
