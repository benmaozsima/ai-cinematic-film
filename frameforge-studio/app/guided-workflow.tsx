'use client';
import { useEffect, useRef, useState } from 'react';
import {
  WandSparkles,
  Check,
  ArrowLeft,
  ArrowRight,
  MessageSquare,
  Play,
  Film,
  Volume2,
  FileText,
  LoaderCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field, Pick, Toggle, Status, Media, Empty } from './studio-ui';
import { api, type Film as FilmData, type Row } from './studio-types';

import { ShotAssets } from './shot-assets';
import { ProductionBoard, ShotConnection } from './production-board';

const STEPS = [
  ['story', 'רעיון וסיפור', 'Story'],
  ['screenplay', 'תסריט ודמויות', 'Screenplay'],
  ['shots', 'חלוקה לשוטים', 'Shot planning'],
  ['keyframe', 'תמונות מפתח', 'Keyframes'],
  ['dialogue', 'דיבור וקולות', 'Voices'],
  ['video', 'תנועה וסנכרון', 'Motion'],
  ['sound', 'אפקטים ומוזיקה', 'Sound'],
  ['cut', 'עריכה וכתוביות', 'Cut & captions'],
];
const compactLabel = (value: unknown, max = 72) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};
const sceneLabel = (scene: Row, index: number) =>
  `${String(index + 1).padStart(2, '0')} · ${scene.title || 'סצנה'}${scene.summary ? ` — ${compactLabel(scene.summary)}` : ''}`;
export function GuidedWorkflow({
  film,
  configured,
  isHebrew,
  onChanged,
  onGenerate,
  onReview,
  onEntity,
  onNavigate,
}: {
  film: FilmData;
  configured: boolean;
  isHebrew: boolean;
  onChanged: () => Promise<unknown>;
  onGenerate: (shotId: string, preset: Row) => void;
  onReview: (id: string) => void;
  onEntity: (id: string) => void;
  onNavigate: (view: string) => void;
}) {
  const t = (en: string, he: string) => (isHebrew ? he : en);
  const stageMap = useRef<HTMLDetailsElement>(null);
  const [step, setStep] = useState('story'),
    [sceneId, setSceneId] = useState(''),
    [shotId, setShotId] = useState(''),
    [state, setState] = useState<Row>({ drafts: [], writers: [] }),
    [error, setError] = useState('');
  useEffect(() => {
    const saved = localStorage.getItem(`frameforge-workflow-${film.id}`);
    setStep(
      STEPS.some(([id]) => id === saved) ? saved! : 'story',
    );
    let position: Row = {};
    try { position = JSON.parse(localStorage.getItem(`frameforge-position-${film.id}`) || '{}'); } catch { /* Ignore invalid saved navigation. */ }
    setSceneId(position.sceneId || '');
    setShotId(position.shotId || '');
  }, [film.id]);
  useEffect(() => {
    let alive = true;
    api(`/films/${film.id}/workflow`)
      .then((s) => {
        if (alive) {
          setState(s);
          setError('');
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [film.id, film.revision]);
  const go = (id: string) => {
    if (!canEnter(id)) return;
    setStep(id);
    if (stageMap.current) stageMap.current.open = false;
    localStorage.setItem(`frameforge-workflow-${film.id}`, id);
  };
  const scene = film.scenes.find((s) => s.id === sceneId) || film.scenes[0];
  const shots = [...film.shots]
    .filter((s) => !scene || s.sceneId === scene.id)
    .sort((a, b) => a.order - b.order);
  const shot = shots.find((s) => s.id === shotId) || shots[0];
  useEffect(() => {
    if (scene) localStorage.setItem(`frameforge-position-${film.id}`, JSON.stringify({sceneId: scene.id, shotId: shot?.id || ''}));
  }, [film.id, scene?.id, shot?.id]);
  const approved = (stage: string, sid = '') =>
    state.drafts.some(
      (d: Row) =>
        d.stage === stage &&
        d.sceneId === sid &&
        d.status === 'approved' &&
        !d.stale,
    );
  const completed = (id: string) =>
    id === 'story' || id === 'screenplay'
      ? approved(id) ||
        (id === 'story'
          ? Boolean(film.logline && film.treatment)
          : Boolean(film.screenplay && film.scenes.length))
      : id === 'shots'
        ? film.scenes.length > 0 && film.scenes.every((s) => approved(id, s.id))
        : false;
  const hasApprovedMedia = (kind: string) =>
    film.versions.some(
      (v) =>
        v.kind === kind &&
        v.status === 'approved' &&
        v.localPath &&
        v.reviewBibleRevision === film.bibleRevision,
    );
  const canEnter = (id: string) => {
    if (id === 'story') return true;
    if (id === 'screenplay') return completed('story');
    if (id === 'shots')
      return completed('screenplay') && film.scenes.length > 0;
    if (id === 'keyframe') return film.shots.length > 0;
    if (id === 'dialogue')
      return (
        film.shots.length > 0 &&
        (hasApprovedMedia('image') ||
          film.shots.some((s) => !s.dialogue && !s.dialogueLines?.length))
      );
    if (id === 'video')
      return film.shots.length > 0 && hasApprovedMedia('image');
    if (id === 'sound')
      return film.shots.length > 0 && hasApprovedMedia('video');
    if (id === 'cut') return film.shots.length > 0 && hasApprovedMedia('video');
    return false;
  };
  const index = STEPS.findIndex(([id]) => id === step);
  const planning = ['story', 'screenplay', 'shots'].includes(step);
  const readyForStage = (() => {
    if (planning)
      return (
        completed(step) ||
        (step === 'shots' && Boolean(scene && approved('shots', scene.id)))
      );
    if (step === 'cut')
      return (
        film.shots.length > 0 && film.shots.every((s) => s.selectedVersionId)
      );
    if (!shot) return false;
    const currentVersions = film.versions.filter(
      (v) =>
        v.shotId === shot.id &&
        v.status === 'approved' &&
        v.localPath &&
        v.reviewBibleRevision === film.bibleRevision &&
        (v.reviewShotRevision || 0) === (shot.continuityRevision || 0),
    );
    if (step === 'keyframe')
      return currentVersions.some((v) => v.kind === 'image');
    if (step === 'video')
      return currentVersions.some((v) => v.kind === 'video');
    if (step === 'dialogue') {
      const lines = shot.dialogueLines || (shot.dialogue ? [{ id: '' }] : []);
      return (
        !lines.length ||
        lines.every((line: Row) =>
          currentVersions.some(
            (v) =>
              v.kind === 'audio' &&
              (v.audioRole === 'dialogue' || v.model?.includes('/tts/')) &&
              (!line.id || v.dialogueLineId === line.id),
          ),
        )
      );
    }
    return true;
  })();
  const next = () => {
    if (step === 'shots') {
      const remaining = film.scenes.find(
        (s) => s.id !== scene?.id && !approved('shots', s.id),
      );
      if (remaining) {
        setSceneId(remaining.id);
        setShotId('');
        return;
      }
    }
    if (!planning && step !== 'cut') {
      const ordered = [...film.shots].sort((a, b) => a.order - b.order);
      const following =
        ordered[ordered.findIndex((s) => s.id === shot?.id) + 1];
      if (following) {
        setSceneId(following.sceneId);
        setShotId(following.id);
        return;
      }
      setSceneId(film.scenes[0]?.id || '');
      setShotId('');
    }
    if (index < STEPS.length - 1) go(STEPS[index + 1][0]);
  };
  const nextLabel =
    step === 'shots' &&
    film.scenes.some((s) => s.id !== scene?.id && !approved('shots', s.id))
      ? t('Continue to the next scene', 'המשך לסצנה הבאה')
      : !planning &&
          step !== 'cut' &&
          [...film.shots].sort((a, b) => a.order - b.order).at(-1)?.id !==
            shot?.id
        ? t('Continue to the next shot', 'המשך לשוט הבא')
        : t('Continue to', 'המשך אל') +
          ' ' +
          t(STEPS[Math.min(index + 1, 7)][2], STEPS[Math.min(index + 1, 7)][1]);
  const startSceneAssets = () => {
    if (step !== 'shots' || !scene) return;
    const firstShot = [...film.shots]
      .filter((s) => s.sceneId === scene.id)
      .sort((a, b) => a.order - b.order)[0];
    if (!firstShot) return;
    setSceneId(scene.id);
    setShotId(firstShot.id);
    setStep('keyframe');
    localStorage.setItem(`frameforge-workflow-${film.id}`, 'keyframe');
    if (stageMap.current) stageMap.current.open = false;
  };
  const startShotMotion = () => {
    if (step !== 'keyframe' || !shot) return;
    setSceneId(shot.sceneId);
    setShotId(shot.id);
    setStep('video');
    localStorage.setItem(`frameforge-workflow-${film.id}`, 'video');
    if (stageMap.current) stageMap.current.open = false;
  };
  return (
    <div className="guided-workflow">
      {film.scenes.length > 0 && <ProductionBoard film={film} sceneId={scene?.id} shotId={shot?.id} hebrew={isHebrew}
        onAssets={() => onNavigate('bible')}
        onOpen={(sid, shid, stage) => {setSceneId(sid); setShotId(shid); setStep(stage); localStorage.setItem(`frameforge-workflow-${film.id}`, stage); requestAnimationFrame(() => document.querySelector('.workflow-heading')?.scrollIntoView({behavior:'smooth', block:'start'}));}} />}
      <details ref={stageMap} className="workflow-map">
        <summary>
          {t(
            'All stages · jump back to make changes',
            'כל השלבים · חזרה לשלב שרוצים לשנות',
          )}
        </summary>
        <nav
          className="workflow-steps"
          aria-label={t('Film production stages', 'שלבי הפקת הסרט')}
        >
          {STEPS.map(([id, he, en], i) => (
            <button
              key={id}
              className={`${step === id ? 'active' : ''} ${!canEnter(id) ? 'locked' : ''}`}
              onClick={() => go(id)}
              disabled={!canEnter(id)}
              title={
                !canEnter(id)
                  ? t(
                      'Complete the previous stage first',
                      'יש להשלים קודם את השלב הקודם',
                    )
                  : undefined
              }
              aria-current={step === id ? 'step' : undefined}
            >
              <span className={completed(id) ? 'done' : ''}>
                {completed(id) ? (
                  <Check size={16} />
                ) : (
                  String(i + 1).padStart(2, '0')
                )}
              </span>
              <strong>{t(en, he)}</strong>
            </button>
          ))}
        </nav>
      </details>
      <div className="workflow-heading">
        <div>
          <span className="eyebrow">
            {t('STEP', 'שלב')} {index + 1} / 8
          </span>
          <h2>{t(STEPS[index][2], STEPS[index][1])}</h2>
        </div>
        <p>
          {t(
            'Create one piece. Review it. Continue when it feels right.',
            'יוצרים חלק אחד, בודקים ומתקנים. ממשיכים כשמרוצים.',
          )}
        </p>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {!configured && (
        <p className="notice">
          <Button variant="outline" onClick={() => onNavigate('settings')}>
            {t('Add a FAL key to start', 'הוספת מפתח Fal כדי להתחיל')}
          </Button>
        </p>
      )}
      {step !== 'story' &&
        step !== 'screenplay' &&
        step !== 'cut' &&
        film.scenes.length > 0 && (
          <div className="workflow-selectors">
            <Field label={t('Current scene', 'הסצנה שעליה עובדים')}>
              <Pick
                value={scene?.id || ''}
                onChange={(id) => {
                  setSceneId(id);
                  setShotId('');
                }}
                label={t('Scene', 'סצנה')}
                items={film.scenes.map((s, i) => ({
                  value: s.id,
                  label: sceneLabel(s, i),
                }))}
              />
            </Field>
            {!planning && shots.length > 0 && (
              <Field label={t('Current shot', 'השוט שעליו עובדים')}>
                <Pick
                  value={shot?.id || ''}
                  onChange={setShotId}
                  label={t('Shot', 'שוט')}
                  items={shots.map((s) => ({
                    value: s.id,
                    label: `${s.code} · ${s.title}`,
                  }))}
                />
              </Field>
            )}
          </div>
        )}
      {shot && ['keyframe','video'].includes(step) && <ShotAssets key={`assets-${shot.id}`} film={film} shot={shot} hebrew={isHebrew} onChanged={onChanged} onEntity={onEntity} />}
      {shot && ['keyframe','video'].includes(step) && <ShotConnection key={shot.id} film={film} shot={shot} hebrew={isHebrew} onChanged={onChanged} onReview={onReview} />}
      {step === 'video' && shot && !film.versions.some(v=>v.shotId===shot.id && v.kind==='image' && v.status==='approved' && v.reviewBibleRevision===film.bibleRevision && (v.reviewShotRevision||0)===(shot.continuityRevision||0)) && <Button variant="outline" onClick={()=>go('keyframe')}>{t('Prepare the keyframe for this shot', 'הכנת תמונת המפתח לשוט הזה')}</Button>}
      {planning ? (
        <WritingStage
          key={`${film.id}/${step}/${step === 'shots' ? scene?.id : ''}`}
          film={film}
          stage={step}
          sceneId={
            step === 'shots' ? scene?.id || '' : ''
          }
          state={state}
          t={t}
          configured={configured}
          language={isHebrew ? 'he' : 'en'}
          onChanged={onChanged}
          onContinue={next}
          onNavigate={onNavigate}
        />
      ) : step === 'cut' ? (
        <div className="workflow-cut panel">
          <Film size={30} />
          <h3>
            {t('Watch the film as a connected sequence', 'צפו בסרט כרצף מחובר')}
          </h3>
          <p>
            {t(
              'Choose the picture for each shot, then adjust dialogue, effects and score in Sound studio. Check pronunciation, timing, lip-sync, and readable text before delivery.',
              'בחרו גרסה לכל שוט וכוונו את הדיבור, האפקטים והמוזיקה באולפן הסאונד. לפני המסירה בדקו הגייה, תזמון, סנכרון שפתיים ומלל קריא.',
            )}
          </p>
          {film.shots.length === 0 ? (
            <Empty
              title={t(
                'Finish shot planning first',
                'יש להשלים קודם את תכנון השוטים',
              )}
              text={t(
                'The connected cut becomes available after approved shots exist.',
                'העריכה המחוברת תיפתח אחרי שיהיו שוטים מאושרים.',
              )}
              action={
                <Button onClick={() => onNavigate('shots')}>
                  {t('Back to shot planning', 'חזרה לתכנון השוטים')}
                </Button>
              }
            />
          ) : (
            <div className="row-actions">
              <Button onClick={() => onNavigate('cut')}>
                <Play />
                {t('Open connected cut', 'פתיחת העריכה המחוברת')}
              </Button>
              <Button variant="outline" onClick={() => onNavigate('audio')}>
                <Volume2 />
                {t('Mix sound layers', 'מיקס שכבות הסאונד')}
              </Button>
              <Button variant="outline" onClick={() => onNavigate('review')}>
                {t('Final quality review', 'בדיקת איכות סופית')}
              </Button>
            </div>
          )}
          <CaptionEditor film={film} onChanged={onChanged} t={t} />
        </div>
      ) : shot ? (
        <MediaStage
          key={`${step}/${shot.id}`}
          film={film}
          shot={shot}
          step={step}
          t={t}
          language={isHebrew ? 'he' : 'en'}
          onGenerate={onGenerate}
          onReview={onReview}
          onChanged={onChanged}
          onNavigate={onNavigate}
        />
      ) : (
        <Empty
          title={t('Plan this scene first', 'נתכנן קודם את הסצנה')}
          text={t(
            'Approve a screenplay, then a shot breakdown for one scene.',
            'מאשרים תסריט, ואז חלוקה לשוטים עבור סצנה אחת.',
          )}
          action={
            <Button
              onClick={() => go(film.scenes.length ? 'shots' : 'screenplay')}
            >
              {t('Go to planning', 'מעבר לתכנון')}
            </Button>
          }
        />
      )}
      <div className="workflow-footer">
        <Button
          variant="outline"
          disabled={index === 0}
          onClick={() => go(STEPS[index - 1][0])}
        >
          {isHebrew ? <ArrowRight /> : <ArrowLeft />}
          {t('Previous stage', 'השלב הקודם')}
        </Button>
        <span>
          {t(
            'Nothing starts automatically when you move to another stage.',
            'המעבר בין השלבים אינו מפעיל יצירה אוטומטית.',
          )}
        </span>
        {readyForStage && index < STEPS.length - 1 && (
          <>
            {step === 'shots' &&
              scene &&
              approved('shots', scene.id) &&
              film.shots.some((s) => s.sceneId === scene.id) && (
                <Button variant="outline" onClick={startSceneAssets}>
                  {t('Generate assets for this scene', 'הפקת נכסים לסצנה הזו')}
                  {isHebrew ? <ArrowLeft /> : <ArrowRight />}
                </Button>
              )}
            {step === 'keyframe' &&
              shot &&
              film.versions.some(
                (v) =>
                  v.shotId === shot.id &&
                  v.kind === 'image' &&
                  v.status === 'approved' &&
                  v.localPath,
              ) && (
                <Button variant="outline" onClick={startShotMotion}>
                  {t('Animate this shot', 'הנפשת השוט הזה')}
                  {isHebrew ? <ArrowLeft /> : <ArrowRight />}
                </Button>
              )}
            <Button onClick={next}>
              {nextLabel}
              {isHebrew ? <ArrowLeft /> : <ArrowRight />}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

type Translate = (en: string, he: string) => string;
function WritingStage({
  film,
  stage,
  sceneId,
  state,
  configured,
  language,
  onChanged,
  onContinue,
  onNavigate,
  t,
}: {
  film: FilmData;
  stage: string;
  sceneId: string;
  state: Row;
  configured: boolean;
  language: string;
  onChanged: () => Promise<unknown>;
  onContinue: () => void;
  onNavigate: (view: string) => void;
  t: Translate;
}) {
  const all = state.drafts.filter(
    (d: Row) => d.stage === stage && d.sceneId === sceneId,
  );
  const [selectedId, setSelectedId] = useState(''),
    [focusOnly, setFocusOnly] = useState(stage === 'screenplay'),
    [instructions, setInstructions] = useState(
      stage === 'story'
        ? film.logline || ''
        : stage === 'screenplay'
          ? t(
              'Develop the approved story into a short cinematic screenplay. Keep dialogue natural, identify consistent characters, and separate scenes clearly.',
              'פתח את הסיפור המאושר לתסריט קולנועי קצר. כתוב דיאלוג טבעי, דמויות עקביות וסצנות ברורות.',
            )
          : t(
              'Break down only this scene into short, filmable shots. One speaker per dialogue shot; plan keyframes, speech, motion, effects and music separately.',
              'חלק רק את הסצנה הזו לשוטים קצרים שאפשר להפיק. דובר אחד בכל שוט דיאלוג; תכנן בנפרד תמונה, דיבור, תנועה, אפקטים ומוזיקה.',
            ),
    ),
    [model, setModel] = useState('google/gemini-2.5-flash'),
    [focusSceneId, setFocusSceneId] = useState(
      sceneId || film.scenes[0]?.id || '',
    ),
    [feedback, setFeedback] = useState(''),
    [preview, setPreview] = useState<Row | null>(null),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [requestId, setRequestId] = useState('');
  const current = all.find((d: Row) => d.id === selectedId) || all.at(-1);
  const displayError = (message: string) =>
    language === 'he' && message.includes('Invalid scenes')
      ? 'המודל החזיר יותר מדי סצנות. במצב עריכת סצנה נשלחת ונשמרת רק סצנה אחת; נסו ליצור תיקון חדש.'
      : message;
  const applied =
    stage === 'story'
      ? Boolean(film.logline && film.treatment)
      : stage === 'screenplay'
        ? Boolean(film.screenplay && film.scenes.length)
        : Boolean(sceneId && film.shots.some((s) => s.sceneId === sceneId));
  const pending = all.some((d: Row) =>
    ['submitting', 'queued', 'running', 'submission_unknown'].includes(
      d.status,
    ),
  );
  const ready =
    stage === 'story' ||
    (stage === 'screenplay'
      ? state.drafts.some(
          (d: Row) =>
            d.stage === 'story' && d.status === 'approved' && !d.stale,
        )
      : sceneId &&
        state.drafts.some(
          (d: Row) =>
            d.stage === 'screenplay' && d.status === 'approved' && !d.stale,
        ));
  const base = `/films/${film.id}/workflow`;
  const requestedSceneId =
    stage === 'screenplay' && focusOnly ? focusSceneId : sceneId;
  const brief = useRef<HTMLDetailsElement>(null);
  const run = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await work();
      await onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    setPreview(null);
    setConsent(false);
  }, [instructions, model, feedback, selectedId]);
  const prepare = () =>
    run(async () => {
      if (feedback.trim() && current)
        await api(`${base}/${current.id}`, { note: feedback }, 'PATCH');
      const body = {
        stage,
        sceneId: requestedSceneId,
        model,
        language,
        instructions: feedback.trim()
          ? `${instructions}\n\n${feedback}`
          : instructions,
        parentId: current?.content ? current.id : null,
      };
      const p = await api(`${base}/preview`, body);
      setPreview({ ...p, body, idempotencyKey: crypto.randomUUID() });
      setConsent(false);
      if (brief.current) {
        brief.current.open = true;
        brief.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  return (
    <div className="writing-layout">
      <details
        ref={brief}
        className="panel writing-brief"
        open={!current?.content}
        key={current?.id || 'brief'}
      >
        <summary>
          {current?.content
            ? t('Change brief or model', 'שינוי ההנחיות או המודל')
            : t('Start with your idea', 'מתחילים ברעיון שלך')}
        </summary>
        <div className="panel-heading">
          <h3>
            <WandSparkles size={18} />
            {t('Director’s brief', 'הנחיות לבמאי AI')}
          </h3>
        </div>
        <Field
          label={t(
            'What should we create in this stage?',
            'מה ניצור בשלב הזה?',
          )}
        >
          <Textarea
            rows={7}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder={t(
              'Describe your idea, audience, target length, atmosphere and language…',
              'תארו את הרעיון, הקהל, האורך הרצוי, האווירה והשפה…',
            )}
          />
        </Field>
        {stage === 'screenplay' && film.scenes.length > 0 && (
          <Toggle checked={focusOnly} onChange={setFocusOnly}>
            {t('Edit one existing scene only', 'עריכת סצנה קיימת בלבד')}
          </Toggle>
        )}
        {stage === 'screenplay' && focusOnly && film.scenes.length > 0 && (
          <Field label={t('Scene to edit', 'הסצנה לעריכה')}>
            <Pick
              value={focusSceneId}
              onChange={setFocusSceneId}
              label={t('Scene', 'סצנה')}
              items={film.scenes.map((s, i) => ({
                value: s.id,
                label: sceneLabel(s, i),
              }))}
            />
          </Field>
        )}
        <details className="advanced-options">
          <summary>
            {t('Advanced · model selection', 'מתקדם · בחירת מודל')}
          </summary>
          <Field label={t('Writing model through Fal', 'מודל כתיבה דרך Fal')}>
            <Pick
              value={model}
              onChange={setModel}
              label={t('Writing model', 'מודל כתיבה')}
              items={(state.writers.length
                ? state.writers
                : ['google/gemini-2.5-flash']
              ).map((id: string) => ({ value: id, label: id.split('/')[1] }))}
            />
          </Field>
        </details>
        <p className="small">
          {t(
            'This creates a text draft only. You approve it before it becomes production material.',
            'נוצרת טיוטת טקסט בלבד. היא תיכנס להפקה רק לאחר אישור שלך.',
          )}
        </p>
        {!ready && (
          <p className="notice">
            {t(
              'Approve the previous writing stage first.',
              'יש לאשר קודם את שלב הכתיבה הקודם.',
            )}
          </p>
        )}
        <Button
          disabled={
            !ready || busy || pending || !configured || !instructions.trim()
          }
          onClick={() => void prepare()}
        >
          {busy ? <LoaderCircle className="spin" /> : <WandSparkles />}
          {current?.content
            ? t('Prepare revised draft', 'הכנת טיוטה מתוקנת')
            : t('Prepare AI draft', 'הכנת טיוטת AI')}
        </Button>
        {preview && (
          <div className="request-preview">
            <strong>{t('One writing request', 'בקשת כתיבה אחת')}</strong>
            <p>
              {t(
                'Billed by Fal; the price depends on the writing model and tokens. No media is generated.',
                'החיוב דרך Fal תלוי במודל ובכמות הטקסט. לא נוצרים כאן תמונות או וידאו.',
              )}
            </p>
            <a
              href="https://fal.ai/models/fal-ai/any-llm"
              target="_blank"
              rel="noreferrer"
            >
              {t('View current pricing', 'למחיר העדכני')}
            </a>
            <details>
              <summary>{t('View exact request', 'הצגת הבקשה המלאה')}</summary>
              <pre>{JSON.stringify(preview.input, null, 2)}</pre>
            </details>
            <Toggle checked={consent} onChange={setConsent}>
              {t(
                'I accept the current Fal charge for this draft.',
                'אני מאשר/ת את החיוב של Fal עבור הטיוטה הזו.',
              )}
            </Toggle>
            <Button
              disabled={!consent || busy || pending}
              onClick={() =>
                void run(async () => {
                  await api(base, {
                    ...preview.body,
                    expectedRevision: preview.filmRevision,
                    idempotencyKey: preview.idempotencyKey,
                    confirmCost: true,
                    acceptUnknownCost: true,
                  });
                  setPreview(null);
                  setFeedback('');
                  setSelectedId('');
                })
              }
            >
              {t('Generate this draft', 'יצירת הטיוטה הזו')}
            </Button>
          </div>
        )}
        {error && (
          <p className="error" role="alert">
            {displayError(error)}
          </p>
        )}
      </details>
      <section className="panel draft-review">
        <div className="panel-heading">
          <h3>{t('Review & refine', 'בדיקה ושיפור')}</h3>
          {current && <Status value={current.status} />}
        </div>
        {all.length > 0 && (
          <Pick
            value={current?.id || ''}
            onChange={setSelectedId}
            label={t('Draft history', 'היסטוריית טיוטות')}
            items={all.map((d: Row, i: number) => ({
              value: d.id,
              label: `${t('Draft', 'טיוטה')} ${i + 1} · ${d.source === 'manual-revision' ? t('Manual edit', 'עריכה ידנית') : d.model.split('/')[1]} · ${new Date(d.createdAt).toLocaleTimeString()}`,
            }))}
          />
        )}
        {!current && applied && (
          <div className="workflow-saved" role="status">
            <Check size={28} />
            <h3>
              {t('Approved and saved to this film', 'אושר ונשמר בסרט הזה')}
            </h3>
            <p>
              {t(
                'Your approved direction is active. You can continue, or open the stage map to review it.',
                'הכיוון שאישרת פעיל בסרט. אפשר להמשיך, או לפתוח את מפת השלבים כדי לחזור ולבדוק אותו.',
              )}
            </p>
            <Button onClick={onContinue}>{t('Continue', 'המשך')}</Button>
          </div>
        )}
        {!current && !applied && (
          <div className="workflow-empty">
            <FileText size={32} />
            <h3>
              {t('Your next draft will appear here', 'הטיוטה הבאה תופיע כאן')}
            </h3>
            <p>
              {t(
                'Start with a brief. Then edit, leave feedback, or approve before continuing.',
                'מתחילים בהנחיות. אחר כך עורכים, מוסיפים הערות או מאשרים להמשך.',
              )}
            </p>
          </div>
        )}
        {current &&
          ['submitting', 'queued', 'running'].includes(current.status) && (
            <p className="notice">
              <LoaderCircle className="spin" size={18} />
              {t(
                'Writing this stage… You can leave and return; the request is saved.',
                'כותב את השלב הזה… אפשר לצאת ולחזור, הבקשה נשמרה.',
              )}
            </p>
          )}
        {current?.error && (
          <p className="error" role="alert">
            {displayError(current.error)}
          </p>
        )}
        {current?.status === 'submission_unknown' && (
          <div className="field">
            <p>
              {t(
                'Check the request in Fal and paste its ID to resume without another charge.',
                'בדקו את הבקשה ב־Fal והדביקו את המזהה כדי להמשיך בלי לשלוח בקשה נוספת.',
              )}
            </p>
            <Input
              aria-label="FAL request ID"
              value={requestId}
              onChange={(e) => setRequestId(e.target.value)}
            />
            <Button
              disabled={busy || !requestId}
              onClick={() =>
                void run(() =>
                  api(`${base}/${current.id}`, { requestId }, 'PATCH'),
                )
              }
            >
              {t('Resume existing request', 'המשך הבקשה הקיימת')}
            </Button>
          </div>
        )}
        {current?.stale && (
          <p className="notice">
            {t(
              'The source direction has changed. Ask AI for a revised draft before approval.',
              'ההנחיות שעליהן מבוססת הטיוטה השתנו. בקשו טיוטה מתוקנת לפני אישור.',
            )}
          </p>
        )}
        {current?.content && (
          <DraftEditor
            key={current.id}
            content={current.content}
            stage={stage}
            t={t}
            busy={busy}
            canApprove={current.status === 'review' && !current.stale}
            onSave={(content) =>
              run(async () => {
                await api(
                  `${base}/${current.id}`,
                  { content, expectedRevision: film.revision },
                  'PATCH',
                );
                setSelectedId('');
              })
            }
            onApprove={() =>
              run(async () => {
                await api(`${base}/${current.id}/approve`, {
                  expectedRevision: film.revision,
                });
                await onChanged();
                onContinue();
              })
            }
          />
        )}
        {stage === 'screenplay' && film.entities.length > 0 && (
          <div className="workflow-bible-callout panel">
            <div>
              <h3>{t('Production bible', 'ספר ההפקה')}</h3>
              <p>
                {t(
                  'Your approved characters, locations and props are built here. Add identity references, lock continuity rules, and reuse them in every shot.',
                  'הדמויות, הלוקיישנים והאביזרים שאישרת נבנים כאן. הוסיפו רפרנסים לזהות, נעלו כללי רציפות והשתמשו בהם בכל שוט.',
                )}
              </p>
            </div>
            <Button variant="outline" onClick={() => onNavigate('bible')}>
              {t('Open production bible', 'פתיחת ספר ההפקה')}
            </Button>
          </div>
        )}
        {current?.content && (
          <div className="draft-feedback">
            <h3>
              <MessageSquare size={18} />
              {t('What should change?', 'מה כדאי לתקן?')}
            </h3>
            <div className="feedback-chips">
              {[
                t(
                  'Keep the story, make the dialogue more natural.',
                  'שמור על הסיפור, הפוך את הדיאלוג לטבעי יותר.',
                ),
                t(
                  'Shorten this without losing the emotional beat.',
                  'קצר בלי לאבד את הרגע הרגשי.',
                ),
                t(
                  'Keep character identity and clarify continuity.',
                  'שמור על זהות הדמויות וחדד את הרציפות.',
                ),
              ].map((text) => (
                <button
                  key={text}
                  onClick={() =>
                    setFeedback((s) => `${s}${s ? '\n' : ''}${text}`)
                  }
                >
                  {text}
                </button>
              ))}
            </div>
            <Textarea
              rows={3}
              aria-label={t('Feedback for this draft', 'הערות לטיוטה הזו')}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder={t(
                'Point to the scene, line or detail and describe the desired change.',
                'ציינו סצנה, שורה או פרט והסבירו מה הייתם רוצים לשנות.',
              )}
            />
            <Button
              disabled={
                busy || pending || !configured || !ready || !feedback.trim()
              }
              onClick={() => void prepare()}
            >
              <WandSparkles />
              {t('Revise with these notes', 'תיקון לפי ההערות שלי')}
            </Button>
            <Button
              variant="outline"
              disabled={busy || !feedback.trim()}
              onClick={() =>
                void run(async () => {
                  await api(
                    `${base}/${current.id}`,
                    { note: feedback },
                    'PATCH',
                  );
                  setFeedback('');
                })
              }
            >
              {t('Save feedback', 'שמירת הערה')}
            </Button>
            <p className="small">
              {t(
                'Review the cost before generating. Your previous version stays available.',
                'לפני היצירה תוצג העלות לאישור. הגרסה הקודמת תישמר.',
              )}
            </p>
            {current.notes?.map((n: Row) => (
              <p className="note" key={n.id}>
                {n.text}
              </p>
            ))}
          </div>
        )}
        {current?.content && current.status === 'review' && (
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() =>
              void run(() =>
                api(`${base}/${current.id}`, { reject: true }, 'PATCH'),
              )
            }
          >
            {t('Reject this draft', 'דחיית הטיוטה הזו')}
          </Button>
        )}
        {current?.requestId && (
          <details className="provenance">
            <summary>
              {t('Request & billing record', 'תיעוד הבקשה והעלות')}
            </summary>
            <p dir="ltr">
              Fal · {current.model} · {current.requestId}
            </p>
            <p>
              {t(
                'Actual cost is available in your Fal dashboard. The full request and output are saved in the production archive.',
                'העלות בפועל זמינה בחשבון Fal. הבקשה והתשובה המלאות נשמרות בארכיון ההפקה.',
              )}
            </p>
            <CostEntry
              value={current.actualCost}
              onSave={(actualCost) =>
                run(() => api(`${base}/${current.id}`, { actualCost }, 'PATCH'))
              }
              t={t}
            />
          </details>
        )}
      </section>
    </div>
  );
}

const LABELS: Record<string, [string, string]> = {
  logline: ['Logline', 'תקציר במשפט'],
  treatment: ['Treatment', 'מהלך הסיפור'],
  style: ['Visual style', 'שפה חזותית'],
  screenplay: ['Screenplay', 'תסריט'],
  title: ['Title', 'כותרת'],
  summary: ['Scene action & dialogue', 'מהלך הסצנה ודיאלוג'],
  name: ['Name', 'שם'],
  description: ['Identity & appearance', 'זהות ומראה'],
  continuity: ['Continuity rules', 'כללי רציפות'],
  voice: ['Voice name / ID', 'שם קול / מזהה'],
  prompt: ['Visual direction', 'הכוונה חזותית'],
  camera: ['Camera', 'מצלמה'],
  lighting: ['Lighting', 'תאורה'],
  duration: ['Seconds', 'משך בשניות'],
  soundEffects: ['Effects & atmosphere', 'אפקטים ואווירה'],
  music: ['Music', 'מוזיקה'],
  onScreenText: ['Exact on-screen text', 'מלל מדויק על המסך'],
  speaker: ['Speaker', 'דובר'],
  text: ['Spoken words', 'המילים שנאמרות'],
};
function DraftEditor({
  content,
  stage,
  t,
  busy,
  canApprove,
  onSave,
  onApprove,
}: {
  content: Row;
  stage: string;
  t: Translate;
  busy: boolean;
  canApprove: boolean;
  onSave: (c: Row) => Promise<unknown>;
  onApprove: () => Promise<unknown>;
}) {
  const [value, setValue] = useState<Row>(structuredClone(content));
  const [editing, setEditing] = useState(false);
  const dirty = JSON.stringify(value) !== JSON.stringify(content);
  const fields = (row: Row, keys: string[], update: (next: Row) => void) =>
    keys.map((key) => (
      <Field key={key} label={t(...LABELS[key])}>
        {!editing ? (
          <p className="draft-reading" dir="auto">
            {row[key] || '—'}
          </p>
        ) : key === 'duration' ? (
          <Input
            type="number"
            min={1}
            max={10}
            value={row[key]}
            onChange={(e) => update({ ...row, [key]: Number(e.target.value) })}
          />
        ) : (
          <Textarea
            dir="auto"
            rows={
              ['screenplay', 'treatment'].includes(key)
                ? 9
                : ['title', 'name', 'voice', 'speaker'].includes(key)
                  ? 1
                  : 3
            }
            value={row[key] || ''}
            onChange={(e) => update({ ...row, [key]: e.target.value })}
          />
        )}
      </Field>
    ));
  const group = (key: string, title: string, keys: string[]) => (
    <div className="draft-items">
      <h3>{title}</h3>
      {value[key]?.map((row: Row, i: number) => (
        <details key={row.id} open={value[key].length === 1}>
          <summary>
            <span>{String(i + 1).padStart(2, '0')}</span>
            {row.title || row.name}
            {key === 'scenes' && row.summary && (
              <small> — {compactLabel(row.summary, 90)}</small>
            )}
          </summary>
          <div className="draft-item-fields">
            {fields(row, keys, (next) =>
              setValue({
                ...value,
                [key]: value[key].map((v: Row, n: number) =>
                  n === i ? next : v,
                ),
              }),
            )}
            {key === 'shots' &&
              row.dialogueLines?.map((line: Row, j: number) => (
                <div className="dialogue-line" key={j}>
                  <strong>
                    {t('Dialogue line', 'שורת דיאלוג')} {j + 1}
                  </strong>
                  {fields(line, ['speaker', 'text', 'voice'], (next) =>
                    setValue({
                      ...value,
                      shots: value.shots.map((v: Row, n: number) =>
                        n === i
                          ? {
                              ...v,
                              dialogueLines: v.dialogueLines.map(
                                (l: Row, k: number) => (k === j ? next : l),
                              ),
                            }
                          : v,
                      ),
                    }),
                  )}
                </div>
              ))}
          </div>
        </details>
      ))}
    </div>
  );
  return (
    <div className="draft-editor">
      <Button variant="outline" onClick={() => setEditing(!editing)}>
        {editing
          ? t('Read draft', 'תצוגת קריאה')
          : t('Edit text myself', 'עריכת הטקסט בעצמי')}
      </Button>
      {stage === 'story' ? (
        fields(value, ['logline', 'treatment', 'style'], setValue)
      ) : stage === 'screenplay' ? (
        <>
          {fields(value, ['screenplay'], setValue)}
          {group('entities', t('Production bible', 'דמויות, מקומות ואביזרים'), [
            'name',
            'description',
            'continuity',
            'voice',
          ])}
          <p className="small draft-history-hint">
            {t(
              'Every model version of the characters and screenplay stays in Draft history. Manual edits are saved as a new version.',
              'כל גרסה של הדמויות והתסריט נשמרת בהיסטוריית הטיוטות. עריכה ידנית נשמרת כגרסה חדשה.',
            )}
          </p>
          {group('scenes', t('Scenes', 'סצנות'), ['title', 'summary'])}
        </>
      ) : (
        group('shots', t('Shots in this scene', 'שוטים בסצנה הזו'), [
          'title',
          'prompt',
          'camera',
          'lighting',
          'continuity',
          'duration',
          'soundEffects',
          'music',
          'onScreenText',
        ])
      )}
      <div className="draft-approval">
        {dirty && (
          <Button
            variant="outline"
            disabled={busy || !dirty}
            onClick={() => void onSave(value)}
          >
            {t('Save edited version', 'שמירת גרסה ערוכה')}
          </Button>
        )}
        {canApprove && (
          <Button
            disabled={busy || dirty || !canApprove}
            onClick={() => void onApprove()}
          >
            <Check />
            {t('Approve & continue', 'אישור והמשך')}
          </Button>
        )}
      </div>
      <p className="small">
        {dirty
          ? t(
              'Save your edits as a new version before approving.',
              'שמרו את העריכה כגרסה חדשה לפני האישור.',
            )
          : t(
              'Approval applies these items to the film. Existing shots, media and edit choices remain available.',
              'האישור מכניס את הפריטים לסרט. שוטים קיימים, נכסים ובחירות עריכה נשמרים.',
            )}
      </p>
    </div>
  );
}
function CostEntry({
  value,
  onSave,
  t,
}: {
  value: number | null;
  onSave: (n: number) => Promise<unknown>;
  t: Translate;
}) {
  const [cost, setCost] = useState(value == null ? '' : String(value));
  return (
    <div className="row-actions">
      <Input
        type="number"
        min={0}
        step="0.001"
        aria-label={t('Billed cost in USD', 'עלות שחויבה בדולרים')}
        value={cost}
        onChange={(e) => setCost(e.target.value)}
      />
      <Button
        variant="outline"
        disabled={cost === ''}
        onClick={() => void onSave(Number(cost))}
      >
        {t('Record actual cost', 'תיעוד עלות בפועל')}
      </Button>
    </div>
  );
}

function MediaStage({
  film,
  shot,
  step,
  t,
  language,
  onGenerate,
  onReview,
  onChanged,
  onNavigate,
}: {
  film: FilmData;
  shot: Row;
  step: string;
  t: Translate;
  language: string;
  onGenerate: (id: string, preset: Row) => void;
  onReview: (id: string) => void;
  onChanged: () => Promise<unknown>;
  onNavigate: (view: string) => void;
}) {
  const versions = film.versions.filter((v) => v.shotId === shot.id);
  const valid = (v: Row) =>
    v.localPath &&
    v.status === 'approved' &&
    v.reviewBibleRevision === film.bibleRevision &&
    (v.reviewShotRevision || 0) === (shot.continuityRevision || 0);
  const images = versions.filter((v) => v.kind === 'image' && valid(v));
  const videos = versions.filter((v) => v.kind === 'video' && valid(v));
  const audios = versions.filter(
    (v) =>
      v.kind === 'audio' &&
      valid(v) &&
      (v.audioRole === 'dialogue' || v.model?.includes('/tts/')),
  );
  const [imageId, setImageId] = useState(images.at(-1)?.id || ''),
    [videoId, setVideoId] = useState(videos.at(-1)?.id || ''),
    [audioId, setAudioId] = useState(audios.at(-1)?.id || ''),
    [native, setNative] = useState(false),
    [speechStart, setSpeechStart] = useState(0),
    [error, setError] = useState('');
  const connectionImage = images.find(v=>v.id===shot.connection?.frameVersionId)?.id;
  useEffect(()=>{ if(connectionImage) setImageId(connectionImage); }, [connectionImage]);
  const effectiveImage =
    images.find((v) => v.id === imageId)?.id || images.at(-1)?.id;
  const effectiveVideo =
    videos.find((v) => v.id === videoId)?.id || videos.at(-1)?.id;
  const effectiveAudio =
    audios.find((v) => v.id === audioId)?.id || audios.at(-1)?.id;
  const refs = [
    ...new Set<string>(
      [...new Set([...(shot.entityIds || []), ...(shot.locationEntityIds || [])])].flatMap(
        (id: string) =>
          film.entities.find((e) => e.id === id)?.referenceVersionIds || [],
      ),
    ),
  ];
  const create = (preset: Row) => onGenerate(shot.id, preset);
  const pick = (
    label: string,
    value: string | undefined,
    onChange: (id: string) => void,
    rows: Row[],
  ) =>
    rows.length > 0 && (
      <Field label={label}>
        <Pick
          label={label}
          value={value || ''}
          onChange={onChange}
          items={rows.map((v) => ({
            value: v.id,
            label: `v${v.number} · ${v.label}`,
          }))}
        />
      </Field>
    );
  const visible = versions
    .filter((v) =>
      step === 'keyframe'
        ? v.kind === 'image'
        : step === 'dialogue'
          ? v.audioRole === 'dialogue' || v.model?.includes('/tts/')
          : step === 'video'
            ? v.kind === 'video'
            : v.kind === 'audio' &&
              v.audioRole !== 'dialogue' &&
              !v.model?.includes('/tts/'),
    )
    .slice()
    .reverse();
  const addToCut = async (v: Row) => {
    setError('');
    try {
      if (v.kind === 'audio') {
        const start = film.shots
          .filter((s) => s.order < shot.order)
          .reduce((n, s) => n + s.duration, 0);
        await api(`/films/${film.id}/tracks`, {
          versionId: v.id,
          role: v.audioRole || 'sfx',
          label: `${shot.code} · ${v.audioRole || v.label}`,
          start,
          gain: v.audioRole === 'music' ? 0.25 : 1,
        });
      } else
        await api(`/films/${film.id}/shots/${shot.id}/select`, {
          versionId: v.id,
        });
      await onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <div className="media-stage">
      <div className="panel media-direction">
        <div className="panel-heading">
          <h3>
            {shot.code} · {shot.title}
          </h3>
          <span>{shot.duration}s</span>
        </div>
        <details className="advanced-options">
          <summary>
            {t(
              'Shot direction · camera & lighting',
              'הנחיות השוט · מצלמה ותאורה',
            )}
          </summary>
          <p dir="auto">{shot.prompt}</p>
          <p className="small" dir="auto">
            {shot.camera} · {shot.lighting}
          </p>
        </details>
        {step === 'keyframe' && (
          <>
            <p>
              {t(
                'Create and approve the frame before adding motion. Link identity reference images in the production bible for consistent characters.',
                'צרו ואשרו את הפריים לפני ההנפשה. קשרו תמונות רפרנס בספר ההפקה לשמירת זהות הדמויות.',
              )}
            </p>
            <div className="row-actions">
              <Button
                onClick={() =>
                  create({
                    model: refs.length ? 'fal-ai/flux-2/edit' : 'fal-ai/flux-2',
                    prompt: shot.prompt,
                    references: refs,
                    workflowTask: 'keyframe',
                  })
                }
              >
                <WandSparkles />
                {t('Create this keyframe', 'יצירת תמונת המפתח הזו')}
              </Button>
              <Button variant="outline" onClick={() => onNavigate('bible')}>
                {t('Identity & references', 'זהות ורפרנסים')}
              </Button>
            </div>
          </>
        )}
        {step === 'dialogue' && (
          <>
            <p>
              {t(
                'Generate each speaker separately with a stable voice. Listen for exact words, pronunciation and performance before lip-sync.',
                'מפיקים כל דובר בנפרד עם קול קבוע. מאזינים למילים, להגייה ולמשחק לפני סנכרון שפתיים.',
              )}
            </p>
            {(shot.dialogueLines?.length
              ? shot.dialogueLines
              : shot.dialogue
                ? [
                    {
                      id: 'manual',
                      speaker: t('Speaker', 'דובר'),
                      text: shot.dialogue,
                      voice: 'Rachel',
                    },
                  ]
                : []
            ).map((line: Row) => (
              <div className="speech-card" key={line.id}>
                <div>
                  <strong>{line.speaker}</strong>
                  <p dir="auto">{line.text}</p>
                  <small>{line.voice || 'Rachel'}</small>
                </div>
                <Button
                  onClick={() =>
                    create({
                      model: 'fal-ai/elevenlabs/tts/eleven-v3',
                      prompt: line.text,
                      options: {
                        voice: line.voice || 'Rachel',
                        language_code: language,
                      },
                      workflowTask: 'dialogue',
                      audioRole: 'dialogue',
                      dialogueLineId: line.id,
                      references: [],
                    })
                  }
                >
                  <Volume2 />
                  {t('Generate this line', 'יצירת השורה הזו')}
                </Button>
              </div>
            ))}
            {!shot.dialogue && !shot.dialogueLines?.length && (
              <p className="notice">
                {t(
                  'This shot has no dialogue. Continue to motion or generate narration.',
                  'בשוט הזה אין דיאלוג. אפשר להמשיך לתנועה או ליצור קריינות.',
                )}
              </p>
            )}
            <Button
              variant="outline"
              onClick={() =>
                create({
                  model: 'fal-ai/elevenlabs/tts/eleven-v3',
                  prompt: '',
                  options: { language_code: language },
                  workflowTask: 'dialogue',
                  audioRole: 'dialogue',
                  references: [],
                })
              }
            >
              {t('Custom dialogue / narration', 'דיבור / קריינות מותאמים')}
            </Button>
          </>
        )}
        {step === 'video' && (
          <div className="motion-stages">
            <div>
              <h3>
                {t('1. Animate the approved frame', '1. הנפשת הפריים המאושר')}
              </h3>
              {pick(
                t('Source keyframe version', 'גרסת תמונת המקור'),
                effectiveImage,
                setImageId,
                images,
              )}
              <p className="small">
                {t(
                  'This menu chooses the approved image version. The video model is selected after you click Animate only this shot.',
                  'התפריט הזה בוחר את גרסת התמונה המאושרת. את מודל הווידאו בוחרים אחרי לחיצה על “הנפשת השוט הזה”.',
                )}
              </p>
              <Toggle checked={native} onChange={setNative}>
                {t(
                  'Native sound (English / Chinese dialogue)',
                  'סאונד מובנה בווידאו (דיאלוג באנגלית / סינית)',
                )}
              </Toggle>
              <p className="small">
                {t(
                  'For Hebrew, keep native sound off and approve a separate Eleven v3 recording.',
                  'לעברית, השאירו את הסאונד המובנה כבוי ואשרו הקלטת Eleven v3 נפרדת.',
                )}
              </p>
              <Button
                disabled={!effectiveImage}
                onClick={() =>
                  create({
                    model: 'fal-ai/kling-video/v2.6/pro/image-to-video',
                    prompt: shot.prompt,
                    references: [effectiveImage],
                    options: {
                      duration: shot.duration > 5 ? '10' : '5',
                      generate_audio: native,
                    },
                    workflowTask: 'video',
                  })
                }
              >
                <Play />
                {t('Animate only this shot', 'הנפשת השוט הזה בלבד')}
              </Button>
              {!images.length && (
                <p className="notice">
                  {t('Approve a keyframe first.', 'יש לאשר קודם תמונת מפתח.')}
                </p>
              )}
            </div>
            <div>
              <h3>
                {t('2. Sync the approved dialogue', '2. סנכרון הדיבור המאושר')}
              </h3>
              {pick(
                t('Approved picture', 'וידאו מאושר'),
                effectiveVideo,
                setVideoId,
                videos,
              )}
              {pick(
                t('Approved dialogue', 'הקלטת דיבור מאושרת'),
                effectiveAudio,
                setAudioId,
                audios,
              )}
              <Field label={t('Speech begins at (seconds into this shot)', 'תחילת הדיבור בתוך השוט (שניות)')}>
                <Input
                  type="number"
                  min={0}
                  max={Math.min(30, shot.duration)}
                  step="0.1"
                  value={speechStart}
                  onChange={(event) => setSpeechStart(Math.max(0, Math.min(30, Number(event.target.value) || 0)))}
                />
              </Field>
              <p className="small">
                {speechStart > 0
                  ? t(
                      `Frameforge will add ${speechStart.toFixed(1)} seconds of silence to the approved dialogue before lip-sync, so the mouth waits for the visual beat.`,
                      `Frameforge יוסיף ${speechStart.toFixed(1)} שניות שקט לפני ההקלטה המאושרת, כדי שהפה יחכה לרגע המשחק.`,
                    )
                  : t(
                      'The approved dialogue starts at frame one. This is the safest default for a separate dialogue + lip-sync workflow.',
                      'הדיבור המאושר מתחיל בפריים הראשון. זו ברירת המחדל הבטוחה ביותר לדיבור נפרד וסנכרון שפתיים.',
                    )}
              </p>
              <Button
                variant="outline"
                disabled={!effectiveVideo || !effectiveAudio || speechStart >= shot.duration}
                onClick={() =>
                  create({
                    model: 'fal-ai/sync-lipsync/v2',
                    prompt:
                      shot.dialogue ||
                      'Synchronize the approved dialogue to this shot.',
                    references: [effectiveVideo, effectiveAudio],
                    options: { speech_start_seconds: speechStart },
                    workflowTask: 'lipsync',
                  })
                }
              >
                {t('Create lip-sync version', 'יצירת גרסה עם סנכרון שפתיים')}
              </Button>
              <p className="small">
                {t(
                  'Use one visible speaker per shot. The selected lip-sync video already owns its dialogue audio, so do not add the same recording again in the sound mix.',
                  'עבדו עם דובר נראה אחד בכל שוט. סרטון הסנכרון שנבחר כבר כולל את הדיבור, לכן לא מוסיפים שוב את אותה הקלטה למיקס הסאונד.',
                )}
              </p>
            </div>
          </div>
        )}
        {step === 'sound' && (
          <div className="motion-stages">
            {[
              [
                'sfx',
                t('Effects & atmosphere', 'אפקטים ואווירה'),
                shot.soundEffects ||
                  'Natural location ambience and precise foley, no music, no voices.',
              ],
              [
                'music',
                t('Instrumental score', 'מוזיקה אינסטרומנטלית'),
                shot.music ||
                  'Restrained cinematic instrumental underscore, no vocals.',
              ],
            ].map(([role, title, prompt]) => (
              <div key={role}>
                <h3>{title}</h3>
                <p dir="auto">{prompt}</p>
                <Button
                  onClick={() =>
                    create({
                      model: 'fal-ai/stable-audio-25/text-to-audio',
                      prompt,
                      options: {
                        seconds_total:
                          role === 'music' ? 30 : Math.ceil(shot.duration),
                      },
                      workflowTask: role,
                      audioRole: role,
                      references: [],
                    })
                  }
                >
                  <Volume2 />
                  {t('Generate this layer', 'יצירת השכבה הזו')}
                </Button>
              </div>
            ))}
            <p className="small">
              {t(
                'Add the chosen take to the mix, then set its timing and volume in Sound studio. Avoid adding dialogue again when your selected lip-sync video already contains it.',
                'הוסיפו את הגרסה הנבחרת למיקס וכוונו תזמון ועוצמה באולפן הסאונד. אם הווידאו שנבחר כבר כולל דיבור, אין להוסיף את אותה הקלטה שוב.',
              )}
            </p>
            <Button variant="outline" onClick={() => onNavigate('audio')}>
              {t('Open sound mixer', 'פתיחת מיקס הסאונד')}
            </Button>
          </div>
        )}
        {shot.onScreenText && (
          <p className="notice">
            {t(
              'Text to verify / add in editing:',
              'מלל לבדיקה / להוספה בעריכה:',
            )}{' '}
            <b dir="auto">{shot.onScreenText}</b>
          </p>
        )}
      </div>
      <section className="panel">
        <div className="panel-heading">
          <h3>{t('Takes for review', 'גרסאות לבדיקה')}</h3>
          <span>{visible.length}</span>
        </div>
        <p className="small">
          {t(
            'Review a take, leave a timed correction, and approve the checked take before continuing.',
            'פתחו גרסה, הוסיפו הערה בנקודת הזמן המתאימה ותקנו רק אותה. אשרו את הגרסה שנבדקה לפני שממשיכים.',
          )}
        </p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="versions-grid">
          {visible.map((v, i) => (
            <details className="take-review" key={v.id} open={i === 0}>
              <summary>
                {t('Version', 'גרסה')} {v.number} · {v.label}
                {shot.selectedVersionId === v.id
                  ? t(' · Selected for the film', ' · נבחרה לסרט')
                  : ''}
              </summary>
              <div className="version-card">
                <div className="version-preview">
                  <Media version={v} controls />
                </div>
                <div className="version-info">
                  <div>
                    <strong>
                      v{v.number} · {v.label}
                    </strong>
                    <Status value={v.status} />
                  </div>
                  {v.error && <p className="error">{v.error}</p>}
                  <div className="row-actions">
                    <Button
                      variant="outline"
                      disabled={!v.localPath}
                      onClick={() => onReview(v.id)}
                    >
                      <MessageSquare />
                      {t('Review / correction', 'בדיקה / הערה לתיקון')}
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={
                        !valid(v) ||
                        (v.kind === 'audio'
                          ? film.tracks.some((tr) => tr.versionId === v.id)
                          : shot.selectedVersionId === v.id)
                      }
                      onClick={() => void addToCut(v)}
                    >
                      {v.kind === 'audio'
                        ? t('Add to sound mix', 'הוספה למיקס')
                        : shot.selectedVersionId === v.id
                          ? t('Selected in cut', 'נבחר לעריכה')
                          : t('Use in cut', 'בחירה לעריכה')}
                    </Button>
                  </div>
                </div>
              </div>
            </details>
          ))}
        </div>
        {!visible.length && (
          <p className="workflow-empty">
            {t(
              'No takes for this stage yet. Generate one, review it, then continue.',
              'עדיין אין גרסאות לשלב הזה. צרו אחת, בדקו אותה והמשיכו.',
            )}
          </p>
        )}
      </section>
    </div>
  );
}

function CaptionEditor({
  film,
  onChanged,
  t,
}: {
  film: FilmData;
  onChanged: () => Promise<unknown>;
  t: Translate;
}) {
  const [shotId, setShotId] = useState(film.shots[0]?.id || '');
  const shot = film.shots.find((s) => s.id === shotId) || film.shots[0];
  return (
    <section className="caption-editor">
      <h3>
        {t('Exact captions, including Hebrew', 'כתוביות מדויקות, גם בעברית')}
      </h3>
      <p>
        {t(
          'Write captions as a separate text track so AI does not distort the lettering. Set times within each shot and export an SRT file alongside the film. On-screen titles still need compositing in your editor.',
          'כותבים כתוביות כשכבת טקסט נפרדת כדי למנוע עיוות אותיות ב־AI. מגדירים זמנים בתוך כל שוט ומייצאים קובץ SRT לצד הסרט. כותרות ושלטים בתוך התמונה עדיין דורשים שילוב בתוכנת העריכה.',
        )}
      </p>
      {shot && (
        <>
          <Pick
            value={shot.id}
            onChange={setShotId}
            label={t('Caption shot', 'שוט לכתוביות')}
            items={film.shots.map((s) => ({
              value: s.id,
              label: `${s.code} · ${s.title}`,
            }))}
          />
          <ShotCaptions
            key={shot.id}
            film={film}
            shot={shot}
            onChanged={onChanged}
            t={t}
          />
        </>
      )}
      <a
        className="text-button"
        href={`/api/films/${film.id}/subtitles`}
        download="subtitles.srt"
      >
        {t('Download saved SRT captions', 'הורדת כתוביות SRT שמורות')}
      </a>
    </section>
  );
}
function ShotCaptions({
  film,
  shot,
  onChanged,
  t,
}: {
  film: FilmData;
  shot: Row;
  onChanged: () => Promise<unknown>;
  t: Translate;
}) {
  const [cues, setCues] = useState<Row[]>(shot.captions || []),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false);
  const update = (i: number, field: string, value: unknown) => {
    setSaved(false);
    setCues(cues.map((c, n) => (i === n ? { ...c, [field]: value } : c)));
  };
  return (
    <div className="shot-captions">
      {cues.map((c, i) => (
        <div className="caption-row" key={i}>
          <Field label={t('Start (s)', 'התחלה (שניות)')}>
            <Input
              type="number"
              min={0}
              max={shot.duration}
              step="0.1"
              value={c.start}
              onChange={(e) => update(i, 'start', Number(e.target.value))}
            />
          </Field>
          <Field label={t('End (s)', 'סיום (שניות)')}>
            <Input
              type="number"
              min={0}
              max={shot.duration}
              step="0.1"
              value={c.end}
              onChange={(e) => update(i, 'end', Number(e.target.value))}
            />
          </Field>
          <Field label={t('Caption text', 'טקסט הכתובית')}>
            <Textarea
              dir="auto"
              rows={2}
              value={c.text}
              onChange={(e) => update(i, 'text', e.target.value)}
            />
          </Field>
          <Button
            variant="ghost"
            onClick={() => {
              setCues(cues.filter((_, n) => i !== n));
              setSaved(false);
            }}
          >
            {t('Remove', 'הסרה')}
          </Button>
        </div>
      ))}
      <div className="row-actions">
        <Button
          variant="outline"
          onClick={() => {
            setCues([...cues, { start: 0, end: shot.duration, text: '' }]);
            setSaved(false);
          }}
        >
          {t('Add caption', 'הוספת כתובית')}
        </Button>
        <Button
          variant="outline"
          disabled={cues.length > 0 || !shot.dialogue}
          onClick={() => {
            setCues([
              {
                start: 0,
                end: shot.duration,
                text:
                  shot.dialogueLines?.map((l: Row) => l.text).join('\n') ||
                  shot.dialogue,
              },
            ]);
            setSaved(false);
          }}
        >
          {t(
            'Start from dialogue (check timing)',
            'התחלה מהדיאלוג (יש לבדוק תזמון)',
          )}
        </Button>
        <Button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError('');
            try {
              await api(
                `/films/${film.id}/shots/${shot.id}`,
                { captions: cues },
                'PATCH',
              );
              await onChanged();
              setSaved(true);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {saved ? t('Saved', 'נשמר') : t('Save captions', 'שמירת כתוביות')}
        </Button>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </div>
  );
}
