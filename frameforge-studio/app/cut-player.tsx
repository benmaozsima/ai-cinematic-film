'use client';
import { useState, useRef, useEffect } from 'react';
import { Play, Pause, SkipBack, Clapperboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Film, Row, media, clock } from './studio-types';
export function CutPlayer({ film }: { film: Film }) {
  const [time, setTime] = useState(0),
    [playing, setPlaying] = useState(false),
    [buffering, setBuffering] = useState(false),
    [playError, setPlayError] = useState('');
  const timeRef = useRef(0);
  timeRef.current = time;
  const video = useRef<HTMLVideoElement>(null),
    audios = useRef<Record<string, HTMLAudioElement | null>>({});
  const shots = [...film.shots].sort((a, b) => a.order - b.order);
  const clips: Row[] = shots.map((s, index) => ({
    ...s,
    start: shots.slice(0, index).reduce((n, item) => n + item.duration, 0),
    version: film.versions.find((v) => v.id === s.selectedVersionId),
  }));
  const total = shots.reduce((n, s) => n + s.duration, 0);
  const editSignature = film.shots
    .map(
      (s) =>
        `${s.id}:${s.selectedVersionId}:${s.duration}:${s.trimIn}:${s.order}:${Boolean(s.originalAudioMuted)}`,
    )
    .join('|');
  const clip =
    clips.find((c) => time >= c.start && time < c.start + c.duration) ||
    clips[clips.length - 1];
  const clipKey = clip ? clip.id + ':' + clip.version?.id : '';
  useEffect(() => {
    setPlaying(false);
    setBuffering(false);
    setPlayError('');
    setTime(0);
  }, [film.id, editSignature]);
  // The browser media clock is authoritative. Never seek the video to chase a
  // wall clock: a seek can restart decoding and cause a buffering/seek loop.
  useEffect(() => {
    if (!playing || !clip) return;
    let frame = 0, previous = performance.now(), lastPaint = 0;
    const tick = (now: number) => {
      const el = video.current;
      let next = timeRef.current;
      if (clip.version?.kind === 'video') {
        if (el && !el.seeking && el.readyState >= 2)
          next = clip.start + Math.max(0, el.currentTime - clip.trimIn);
      } else next += (now - previous) / 1000;
      previous = now;
      if (next >= clip.start + clip.duration - 0.02) {
        next = clip.start + clip.duration;
        if (next >= total) {
          setPlaying(false);
          setTime(total);
        } else setTime(next);
        return;
      }
      timeRef.current = next;
      if (now - lastPaint >= 80) {
        setTime(next);
        lastPaint = now;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, clipKey, clip?.start, clip?.duration, clip?.trimIn, total]);
  useEffect(() => {
    const el = video.current;
    if (!el) { setBuffering(false); return; }
    if (playing) {
      setBuffering(el.readyState < 3);
      void el.play().catch((e) => {
        if (e.name !== 'AbortError') {
          setPlayError('לא ניתן לנגן את הווידאו. נסו שוב.');
          setPlaying(false);
        }
      });
    } else el.pause();
  }, [playing, clipKey]);
  useEffect(() => {
    for (const t of film.tracks) {
      const el = audios.current[t.id];
      if (!el) continue;
      const local = time - t.start;
      el.volume = Math.min(1, t.gain);
      if (
        !t.muted &&
        playing &&
        !buffering &&
        local >= 0 &&
        (!Number.isFinite(el.duration) || local < el.duration)
      ) {
        if (Math.abs(el.currentTime - local) > 0.35) el.currentTime = local;
        void el.play().catch(() => {});
      } else el.pause();
    }
  }, [time, playing, buffering, film.tracks]);
  const seek = (n: number) => {
    setPlayError('');
    timeRef.current = n;
    setTime(n);
    if (
      video.current &&
      clip &&
      n >= clip.start &&
      n < clip.start + clip.duration
    )
      video.current.currentTime = clip.trimIn + n - clip.start;
  };
  return (
    <div className="cut-player">
      <div className="viewer">
        {clip?.version?.localPath ? (
          clip.version.kind === 'video' ? (
            <video
              key={clipKey}
              ref={video}
              src={media(clip.version)}
              muted={Boolean(clip.originalAudioMuted)}
              playsInline
              preload="auto"
              onWaiting={() => setBuffering(true)}
              onSeeking={() => setBuffering(true)}
              onPlaying={() => setBuffering(false)}
              onSeeked={() => setBuffering(false)}
              onError={() => { setPlayError('טעינת הווידאו נכשלה'); setPlaying(false); }}
              onEnded={() => {
                const end = clip.start + clip.duration;
                if (clip.version.duration + 0.1 < clip.trimIn + clip.duration) {
                  setPlayError('הווידאו קצר ממשך השוט בעריכה. יש להתאים את משך השוט.');
                  setPlaying(false);
                } else { setTime(end); if (end >= total) setPlaying(false); }
              }}
              onLoadedMetadata={(e) => {
                e.currentTarget.currentTime =
                  clip.trimIn + Math.max(0, timeRef.current - clip.start);
                if (playing)
                  void e.currentTarget.play().catch(() => setPlaying(false));
              }}
            />
          ) : (
            <img src={media(clip.version)} alt={clip.title} />
          )
        ) : (
          <div className="viewer-slate">
            <Clapperboard size={40} />
            <h2>{clip?.title || 'Your evolving cut'}</h2>
            <p>
              {clip
                ? 'Select a version for this shot'
                : 'Add and select picture versions to watch your film.'}
            </p>
          </div>
        )}
        <span className="viewer-label">
          {clip?.code || 'PROGRAM'}{' '}
          {clip?.version ? `/ V${clip.version.number}` : ''}
        </span>
        <span className="viewer-format">
          {film.aspectRatio} · {film.fps} FPS
        </span>
      </div>
      <div className="transport">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Return to start"
          onClick={() => seek(0)}
        >
          <SkipBack />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={playing ? 'Pause' : 'Play cut'}
          disabled={!total}
          onClick={() => {
            setPlayError('');
            if (!playing && time >= total) seek(0);
            setPlaying(!playing);
          }}
        >
          {playing ? <Pause /> : <Play />}
        </Button>
        <span dir="ltr">
          {clock(time)} <i>/ {clock(total)}</i>
        </span>
        <Slider
          aria-label="Cut playhead"
          value={[time]}
          min={0}
          max={total || 1}
          step={0.1}
          onValueChange={(v) => seek(Array.isArray(v) ? v[0] : v)}
        />
        <span className="muted">WORKING CUT</span>
      </div>
      {buffering && playing && <p role="status">טוען וידאו…</p>}
      {playError && <p role="alert">{playError}</p>}
      <div className="timeline">
        {clips.map((c) => (
          <button
            key={c.id}
            className={`timeline-clip ${clip?.id === c.id ? 'active' : ''}`}
            onClick={() => seek(c.start)}
            style={{ flex: Math.max(c.duration, 2) }}
          >
            <span>{c.code}</span>
            <strong>{c.title}</strong>
            <small>
              {c.duration}s ·{' '}
              {c.version ? `v${c.version.number}` : 'No picture'}
            </small>
          </button>
        ))}
      </div>
      {film.tracks.map((t) => {
        const v = film.versions.find((v) => v.id === t.versionId);
        return v ? (
          <audio
            key={t.id}
            ref={(el) => {
              audios.current[t.id] = el;
            }}
            src={media(v)}
            preload="auto"
          />
        ) : null;
      })}
    </div>
  );
}
