'use client';
import { useEffect, useState } from 'react';
import { ArrowRight, Check, Clapperboard, LoaderCircle, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { api, media, type Film } from './studio-types';

type Props = { film: Film; isHebrew: boolean; onChanged: () => void; onOpenAdvanced: () => void };
type Plan = Record<string, any>;
type Rehearsal = {
  id?: string;
  status: 'preparing' | 'rendering' | 'complete' | 'failed' | string;
  exportId?: string;
  error?: string;
  source?: 'existing-media' | 'mock' | string;
  rehearsalFilmId?: string;
};

export function DirectorChat({ film, isHebrew, onChanged, onOpenAdvanced }: Props) {
  const [brief, setBrief] = useState(film.concierge?.draft?.text || '');
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const [started, setStarted] = useState(false);
  const [proposalId, setProposalId] = useState('');
  const [error, setError] = useState('');
  const [attachments, setAttachments] = useState<any[]>([]);
  const [rehearsalBusy, setRehearsalBusy] = useState(false);
  const [rehearsalError, setRehearsalError] = useState('');
  const [localRehearsal, setLocalRehearsal] = useState<Rehearsal | null>(null);
  const he = isHebrew;
  useEffect(() => {
    setBrief(film.concierge?.draft?.text || '');
    setLocalRehearsal(null);
    const saved = film.concierge?.draft?.attachments;
    setAttachments(Array.isArray(saved) ? saved : (film.concierge?.draft?.attachmentIds || []).flatMap((id: string) => {
      const version = film.versions.find((candidate: any) => candidate.id === id);
      return version ? [{ id, kind: version.kind, label: version.label || version.input?.filename || `${version.kind} reference`, role: version.kind === 'audio' ? 'dialogue-or-sound' : version.kind === 'video' ? 'performance' : 'identity', scope: 'auto', source: 'upload' }] : [];
    }));
    setRehearsalError('');
  }, [film.id]);
  useEffect(() => {
    const latest = [...(film.concierge?.plans || [])].pop();
    const draftAttachments = film.concierge?.draft?.attachments || [];
    const signature = (items: any[]) => JSON.stringify(items.map((item) => ({ id: item.id, role: item.role, scope: item.scope || 'auto' })));
    const stillMatchesDraft = latest?.brief === String(film.concierge?.draft?.text || '').trim() && signature(latest?.inputs || []) === signature(draftAttachments);
    if (latest?.plan && stillMatchesDraft) { setPlan(latest.plan); setProposalId(latest.id || ''); setStarted(false); }
    else { setPlan(null); setProposalId(''); setStarted(false); }
  }, [film.id, film.concierge?.plans, film.concierge?.draft]);
  const latestRun = [...(film.concierge?.runs || [])].at(-1);
  const runActive = !!latestRun && ['queued', 'generating', 'awaiting_media', 'awaiting_qc', 'needs_attention', 'paused'].includes(latestRun.status);
  const runVersions = (latestRun?.versionIds || []).map((id: string) => film.versions.find((version: any) => version.id === id)).filter(Boolean);
  const safeRetry = runVersions.some((version: any) => version.status === 'failed' && !version.requestId);
  const proposalRun = proposalId ? [...(film.concierge?.runs || [])].reverse().find((run: any) => run.proposalId === proposalId) : undefined;
  const planAuthorized = !!proposalRun && proposalRun.status !== 'cancelled';
  const rehearsal = (film.concierge?.rehearsal as Rehearsal | undefined) || localRehearsal;
  const rehearsalActive = rehearsal?.status === 'preparing' || rehearsal?.status === 'rendering';
  const rehearsalStatus: Record<string, string> = {
    preparing: he ? 'מכין חזרה' : 'Preparing rehearsal',
    rendering: he ? 'מרנדר חזרה' : 'Rendering rehearsal',
    complete: he ? 'החזרה הושלמה' : 'Rehearsal complete',
    failed: he ? 'החזרה נכשלה' : 'Rehearsal failed',
  };
  async function ask(mode: 'plan' | 'authorize') {
    if (!brief.trim()) return;
    setBusy(true); setError('');
    try {
      await saveDraft();
      const result = await api(`/films/${film.id}/concierge`, { brief: brief.trim(), inputs: attachments, mode, planId: mode === 'authorize' ? proposalId : undefined, budgetCap: mode === 'authorize' ? plan?.quote?.cap : undefined, idempotencyKey: mode === 'authorize' ? `${film.id}:${proposalId}` : undefined });
      setPlan(result.plan); setProposalId(result.proposalId || proposalId); setStarted(mode === 'authorize');
      onChanged();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  async function rehearse() {
    if (!plan || rehearsalActive) return;
    setRehearsalBusy(true); setRehearsalError('');
    try {
      const result = await api(`/films/${film.id}/concierge/rehearsal`, {}, 'POST');
      const next = (result?.rehearsal || result?.concierge?.rehearsal || result) as Rehearsal;
      if (next?.status) setLocalRehearsal(next);
      onChanged();
    } catch (e: any) { setRehearsalError(e.message); } finally { setRehearsalBusy(false); }
  }
  async function attach(file: File) {
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/films/${film.id}/import?name=${encodeURIComponent(file.name)}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: file });
      const result: any = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not archive reference.');
      const version = result.versions?.at(-1);
      if (version) setAttachments((current) => {
        const next = [...current, { id: version.id, kind: version.kind, label: version.label || file.name, role: version.kind === 'audio' ? 'dialogue-or-sound' : version.kind === 'video' ? 'performance' : 'identity', scope: 'auto', source: 'upload' }];
        setPlan(null); setProposalId('');
        void saveDraft(next);
        return next;
      });
      onChanged();
    } catch (e: any) { setError(String(e?.message || e)); } finally { setBusy(false); }
  }
  async function controlRun(action: 'pause' | 'resume' | 'cancel' | 'retry') {
    if (!latestRun) return;
    setBusy(true); setError('');
    try { await api(`/films/${film.id}/runs/${latestRun.id}/actions`, { action }); onChanged(); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  const statusLabel: Record<string, string> = {
    queued: he ? 'בתור' : 'Queued', generating: he ? 'יוצר' : 'Generating', awaiting_media: he ? 'ממתין למדיה' : 'Awaiting media', awaiting_qc: he ? 'ממתין לבדיקת איכות' : 'Awaiting quality review', needs_attention: he ? 'ממתין לבדיקה' : 'Needs review', paused: he ? 'מושהה' : 'Paused', completed: he ? 'הושלם' : 'Completed', failed: he ? 'נכשל' : 'Failed', cancelled: he ? 'בוטל' : 'Cancelled',
  };
  const rolesFor = (kind: string) => kind === 'audio'
    ? [['dialogue-or-sound', he ? 'דיבור או סאונד' : 'Dialogue or sound'], ['voice', he ? 'קול' : 'Voice'], ['music', he ? 'מוזיקה' : 'Music']]
    : kind === 'video'
      ? [['performance', he ? 'ביצוע או תנועה' : 'Performance or motion'], ['style', he ? 'סגנון' : 'Style'], ['location', he ? 'מקום' : 'Location']]
      : [['identity', he ? 'דמות' : 'Character'], ['location', he ? 'מקום' : 'Location'], ['prop', he ? 'מוצר או אביזר' : 'Product or prop'], ['style', he ? 'סגנון' : 'Style'], ['composition', he ? 'קומפוזיציה' : 'Composition']];
  function saveDraft(nextAttachments = attachments) {
    return api(`/films/${film.id}/concierge/draft`, { text: brief.trim(), attachments: nextAttachments }, 'PATCH').catch(() => undefined);
  }
  function updateAttachments(change: (current: any[]) => any[]) {
    setAttachments((current) => {
      const next = change(current);
      setPlan(null); setProposalId(''); setStarted(false);
      void saveDraft(next);
      return next;
    });
  }
  return <section className="director-chat" aria-label={he ? 'צ׳ט הבמאי' : 'Director chat'} aria-busy={busy}>
    <div className="director-chat-hero">
      <div className="director-chat-mark"><Clapperboard size={22} /><Sparkles size={16} /></div>
      <div><span className="eyebrow">{he ? 'FRAMEFORGE / במאי AI' : 'FRAMEFORGE / AI DIRECTOR'}</span>
        <h2>{he ? 'מה הסרט שאתה רוצה לראות?' : 'What film do you want to see?'}</h2>
        <p>{he ? 'כתוב בקצרה. הבמאי מאחורי הקלעים יבנה סיפור, שוטים, דמויות, מצלמה, קול, רציפות וייצוא.' : 'Describe it in plain language. The director builds story, shots, characters, camera, sound, continuity and delivery behind the scenes.'}</p>
      </div>
    </div>
    <div className="director-chat-thread" aria-live="polite" role="status">
      <div className="director-message director-message-ai"><Sparkles size={16} /><span>{he ? 'אני מוכן. ספר לי על הסרט, האורך, הפורמט והתחושה. אם חסר פרט, אבחר ברירת מחדל קולנועית מתאימה.' : 'I’m ready. Tell me the film, duration, format and feeling. When a detail is missing, I’ll choose a cinematic default.'}</span></div>
      {brief && <div className="director-message director-message-user"><span>{brief}</span></div>}
      {plan && <div className="director-plan">
        <div className="director-plan-title"><Check size={18} />{
          runActive ? (he ? 'ההפקה בתהליך' : 'Production in progress')
            : planAuthorized ? (he ? 'התוכנית אושרה' : 'Plan approved')
              : started ? (he ? 'הפקה בתור להפעלה' : 'Production queued')
                : (he ? 'תוכנית מוכנה לבדיקה' : 'Plan ready to review')
        }</div>
        <div className="director-plan-grid">
          <div><b>{he ? 'מבנה' : 'Structure'}</b><span>{plan.shotCount} {he ? 'שוטים' : 'shots'} · {plan.duration}s</span></div>
          <div><b>{he ? 'פורמט' : 'Format'}</b><span>{plan.aspectRatio} · 24fps</span></div>
          <div><b>{he ? 'קריאות' : 'Calls'}</b><span>{plan.calls?.total} {he ? 'משוערות' : 'estimated'}</span></div>
          <div><b>{he ? 'עלות מדיה' : 'Media estimate'}</b><span>${plan.estimatedCost} · {he ? 'תקרה' : 'cap'} ${plan.quote?.cap ?? plan.estimatedCost}</span></div>
        </div>
        {plan.costBreakdown?.media?.length && <div className="director-plan-costs" aria-label={he ? 'פירוט עלות ומודלים' : 'Model and cost breakdown'}>
          <b>{he ? 'פירוט קריאות ועלות' : 'Call and cost breakdown'}</b>
          {plan.costBreakdown.media.map((row: any) => <div key={row.modelId}><span>{row.modelName}</span><span>{row.calls} {he ? 'קריאות' : 'calls'} · {row.seconds}s · ${row.cost}</span></div>)}
          <div><span>{he ? 'תכנון ובדיקות' : 'Planning and QC'}</span><span>{(plan.costBreakdown.planning?.[0]?.calls || 0) + (plan.costBreakdown.qualityChecks?.calls || 0)} {he ? 'קריאות כלולות' : 'included calls'} · $0</span></div>
        </div>}
        <p className="director-plan-note">{plan.cameraLanguage}</p>
        <p className="director-plan-note">{plan.audio}</p>
        {!!plan.referenceAssignments?.length && <div className="director-plan-grid" aria-label={he ? 'מיפוי רפרנסים לשוטים' : 'Shot reference mapping'}>{plan.referenceAssignments.map((assignment: any, index: number) => <div key={assignment.shotId}><b>{he ? `שוט ${index + 1}` : `Shot ${index + 1}`}</b><span>{assignment.references?.length ? assignment.references.map((reference: any) => `${reference.label} · ${reference.role}`).join(', ') : (he ? 'ללא רפרנס חיצוני' : 'No external reference')}</span></div>)}</div>}
        {!planAuthorized && <div className="director-rehearsal">
          <div className="director-rehearsal-heading">
            <div>
              <span className="director-demo-label">{he ? 'הדגמה / טיוטה' : 'DEMO / DRAFT'}</span>
              <strong>{he ? 'בדיקת התהליך ללא חיוב' : 'Free workflow rehearsal'}</strong>
            </div>
            <Button variant="outline" onClick={() => void rehearse()} disabled={busy || rehearsalBusy || rehearsalActive}>
              {rehearsalBusy || rehearsalActive ? <LoaderCircle className="spin" /> : <Sparkles size={16} />}
              {rehearsalBusy || rehearsalActive ? (he ? 'החזרה מתבצעת…' : 'Rehearsal running…') : (he ? 'בדיקת התהליך ללא חיוב' : 'Rehearse for free')}
            </Button>
          </div>
          <p className="director-rehearsal-note">{he ? 'משתמש במדיה הקיימת או בפלט מדומה בלבד. לא מתבצעות קריאות לספקים.' : 'Uses existing media or mocked output only. No provider calls are made.'}</p>
          {rehearsal && <div className={`director-rehearsal-status rehearsal-${rehearsal.status}`} aria-live="polite">
            <b>{rehearsalStatus[rehearsal.status] || rehearsal.status}</b>
            {rehearsal.source && <span> · {rehearsal.source === 'mixed' ? (he ? 'מדיה קיימת ופלט מדומה' : 'Existing and mock media') : rehearsal.source === 'mock' ? (he ? 'פלט מדומה' : 'Mock output') : (he ? 'מדיה קיימת' : 'Existing media')}</span>}
            {rehearsal.error && <p>{rehearsal.error}</p>}
            {rehearsal.status === 'complete' && rehearsal.exportId && <div className="director-rehearsal-output">
              <video controls playsInline src={`/api/exports/${rehearsal.exportId}/film.mp4?inline=1`} />
              <a className="button-link" href={`/api/exports/${rehearsal.exportId}/film.mp4`} download="frameforge-rehearsal.mp4">{he ? 'הורדת סרטון הדגמה' : 'Download rehearsal video'}</a>
              <p>{he ? 'בודק ייבוא, חיבור, רינדור, ניגון והורדה. אינו בודק תכנון, איכות יצירתית או סנכרון שפתיים.' : 'Tests import, cut, rendering, playback and download. Does not evaluate planning, creative quality or lip-sync.'}</p>
            </div>}
          </div>}
          {rehearsalError && <p className="error" role="alert">{rehearsalError}</p>}
        </div>}
        {latestRun && <div className="director-run-status" aria-live="polite"><b>{he ? 'מצב ריצה:' : 'Run status:'}</b> {statusLabel[latestRun.status] || latestRun.status} · {latestRun.progress ? `${latestRun.progress.completed}/${latestRun.progress.total}` : ''}<br />{latestRun.status === 'failed' && latestRun.error && <span className="director-run-error">{he && /likenesses of real people|private information/i.test(latestRun.error) ? 'המודל שנבחר דחה את תמונות האנשים. התוצרים לא נוצרו; יש לבנות תוכנית חלופית עם מודל שתומך ברפרנס כזה.' : latestRun.error}<br /></span>}<span>{latestRun.nextAction || ''}</span>
          {latestRun.status === 'completed' && latestRun.result?.exportId && <div className="director-rehearsal-output"><video controls playsInline src={`/api/exports/${latestRun.result.exportId}/film.mp4?inline=1`} /><a className="button-link" href={`/api/exports/${latestRun.result.exportId}/film.mp4`} download="frameforge-film.mp4">{he ? 'הורדת הסרט הסופי' : 'Download final film'}</a></div>}
          {latestRun.status === 'failed' && safeRetry && <div className="director-run-controls"><Button variant="outline" onClick={() => void controlRun('retry')} disabled={busy}>{he ? 'נסה שוב בבטחה' : 'Retry safely'}</Button></div>}
          {latestRun.status === 'failed' && !safeRetry && <p className="director-run-guidance">{he ? 'הבקשה כבר הגיעה לספק, ולכן ניסיון חוזר זהה מוסתר כדי למנוע חיוב כפול. ערוך את הבקשה או הרפרנסים ולחץ „בנה תוכנית”.' : 'The provider received this request, so identical retry is hidden to prevent duplicate cost. Edit the brief or references, then build a new plan.'}</p>}
          {['queued', 'generating', 'awaiting_media', 'awaiting_qc', 'paused'].includes(latestRun.status) && <div className="director-run-controls">
            {latestRun.status === 'paused' ? <Button variant="outline" onClick={() => void controlRun('resume')} disabled={busy}>{he ? 'המשך' : 'Resume'}</Button> : <Button variant="outline" onClick={() => void controlRun('pause')} disabled={busy}>{he ? 'השהה' : 'Pause'}</Button>}
            <Button variant="ghost" onClick={() => void controlRun('cancel')} disabled={busy}>{he ? 'בטל' : 'Cancel'}</Button>
          </div>}
          {latestRun.status === 'needs_attention' && <div className="director-run-controls"><Button variant="outline" onClick={onOpenAdvanced}>{he ? 'בדיקת התוצרים' : 'Review results'}</Button></div>}
        </div>}
      </div>}
    </div>
    <div className="director-chat-compose">
      <label className="sr-only" htmlFor="director-brief">{he ? 'תיאור הסרט' : 'Film brief'}</label>
      <Textarea id="director-brief" aria-describedby="director-brief-help" value={brief} onChange={(e) => { setBrief(e.target.value); setPlan(null); setProposalId(''); setStarted(false); }} onBlur={() => void saveDraft()} placeholder={he ? 'למשל: סרטון אנכי של 20 שניות על תלמידה שפוגשת רובוט בחלל, מצחיק ומרגש…' : 'For example: a 20-second vertical film about a student meeting a robot in space, funny and emotional…'} rows={4} />
      <span id="director-brief-help" className="small">{he ? 'אפשר לכתוב חופשי; האורך והפורמט ייבחרו אוטומטית אם לא ציינת.' : 'Write naturally; duration and format are chosen automatically when omitted.'}</span>
      <label className="director-upload"><input type="file" multiple accept="image/*,video/*,audio/*" onChange={(e) => { const files = [...(e.target.files || [])]; void (async () => { for (const file of files) await attach(file); })(); e.currentTarget.value = ''; }} />{he ? 'הוסף תמונות, וידאו או סאונד כרפרנס' : 'Attach images, video or sound references'}{attachments.length ? ` · ${attachments.length}` : ''}</label>
      {!!attachments.length && <div className="director-attachments" aria-label={he ? 'רפרנסים מצורפים' : 'Attached references'}>{attachments.map((item) => { const version = film.versions.find((candidate: any) => candidate.id === item.id); return <span key={item.id}>{version?.kind === 'image' && version.localPath && <a className="director-reference-preview" href={media(version)} target="_blank" rel="noreferrer" aria-label={he ? `הגדלת ${item.label}` : `Open ${item.label}`}><img src={media(version)} alt={item.label || 'Reference'} /></a>}<b>{item.label || item.kind}</b><select aria-label={he ? `תפקיד רפרנס ${item.kind}` : `${item.kind} reference role`} value={item.role} onChange={(event) => updateAttachments((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, role: event.target.value } : candidate))}>{rolesFor(item.kind).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><select aria-label={he ? `שיוך רפרנס ${item.label || item.kind}` : `${item.label || item.kind} shot scope`} value={item.scope || 'auto'} onChange={(event) => updateAttachments((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, scope: event.target.value } : candidate))}><option value="auto">{he ? 'שיוך אוטומטי' : 'Automatic mapping'}</option><option value="all">{he ? 'כל השוטים' : 'All shots'}</option>{(plan?.shots || []).map((shot: any, index: number) => <option key={shot.id} value={shot.id}>{he ? `שוט ${index + 1}` : `Shot ${index + 1}`}</option>)}{!plan?.shots?.some((shot: any) => shot.id === item.scope) && /^beat-\d+$/.test(item.scope || '') && <option value={item.scope}>{he ? `שוט ${Number(item.scope.split('-')[1])}` : `Shot ${Number(item.scope.split('-')[1])}`}</option>}</select><button aria-label={he ? 'הסרת רפרנס' : 'Remove reference'} onClick={() => updateAttachments((current) => current.filter((candidate) => candidate.id !== item.id))}><Trash2 size={14} /></button></span>; })}</div>}
      {error && <p className="error" role="alert">{error}</p>}
      {runActive ? <div className="director-chat-actions director-active-action" role="status">
        <div><LoaderCircle className={latestRun?.status === 'paused' ? '' : 'spin'} /><span><b>{he ? 'ההפקה כבר פועלת' : 'Production is already running'}</b><small>{he ? 'אין צורך ללחוץ שוב. ההתקדמות והתוצאה מופיעות בכרטיס שמעל.' : 'No second approval is needed. Progress and output appear in the card above.'}</small></span></div>
        <Button variant="outline" onClick={onOpenAdvanced}>{he ? 'פתח מעקב והפקה' : 'Open production tracking'}</Button>
      </div> : <div className="director-chat-actions">
        <Button variant="outline" onClick={() => ask('plan')} disabled={busy || !brief.trim()}>{busy ? <LoaderCircle className="spin" /> : <Sparkles size={16} />}{he ? 'בנה תוכנית' : 'Build plan'}</Button>
        <div className="director-paid-action">
          <Button onClick={() => ask('authorize')} disabled={busy || rehearsalActive || !brief.trim() || !plan || !proposalId || planAuthorized}>{busy ? <LoaderCircle className="spin" /> : <ArrowRight size={16} />}{he ? 'אישור תקציב ויצירה בתשלום' : 'Approve budget & paid generation'}</Button>
          {rehearsalActive && <span>{he ? 'מושהה בזמן בדיקת התהליך ללא חיוב' : 'Disabled while free rehearsal is active'}</span>}
          {planAuthorized && <span>{he ? 'התוכנית הזאת כבר אושרה.' : 'This plan is already approved.'}</span>}
        </div>
      </div>}
      <button className="text-button director-advanced" onClick={onOpenAdvanced}>{he ? 'פתיחת סביבת העריכה המלאה' : 'Open the full production workspace'} <ArrowRight size={14} /></button>
    </div>
  </section>;
}
