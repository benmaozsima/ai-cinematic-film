'use client';
import { AssetViewBuilder } from './asset-view-builder';
import { ASSET_VIEWS } from '../shared/asset-views.mjs';
import { audioTrackSettings } from '../shared/audio-role.mjs';
import { VersionLibrary } from './version-library';
import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type SyntheticEvent,
} from 'react';
import {
  Clapperboard,
  Layers3,
  BookOpen,
  Users,
  Film as FilmIcon,
  AudioLines,
  ShieldCheck,
  Settings2,
  Plus,
  ArrowUpRight,
  Upload,
  Search,
  ArrowDown,
  ArrowUp,
  Check,
  LockKeyhole,
  Unlock,
  History,
  Download,
  RefreshCw,
  ChevronRight,
  Play,
  Grid2X2,
  List,
  LoaderCircle,
  GitBranch,
  Volume2,
  Trash2,
  Link2,
  AlertTriangle,
  WandSparkles,
} from 'lucide-react';
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { api, media, clock, Row, type Film } from './studio-types';
import {
  Pick,
  Field,
  Toggle,
  Status,
  Media,
  Modal,
  TextForm,
  Empty,
  reviewLabel,
} from './studio-ui';
import { CutPlayer } from './cut-player';
import { GuidedWorkflow } from './guided-workflow';
const NAV = [
  {
    id: 'guided',
    title: 'Guided creation',
    titleHe: 'יצירה מודרכת',
    icon: Clapperboard,
  },
  {
    id: 'shots',
    title: 'Shot workspace',
    titleHe: 'מרחב השוטים',
    icon: Layers3,
  },
  {
    id: 'story',
    title: 'Story & screenplay',
    titleHe: 'סיפור ותסריט',
    icon: BookOpen,
  },
  { id: 'bible', title: 'Production bible', titleHe: 'ספר ההפקה', icon: Users },
  {
    id: 'cut',
    title: 'Connected cut',
    titleHe: 'העריכה המחוברת',
    icon: FilmIcon,
  },
  {
    id: 'audio',
    title: 'Sound studio',
    titleHe: 'אולפן סאונד',
    icon: AudioLines,
  },
  {
    id: 'review',
    title: 'Continuity & review',
    titleHe: 'רציפות וביקורת',
    icon: ShieldCheck,
  },
  {
    id: 'history',
    title: 'Production record',
    titleHe: 'תיעוד ההפקה',
    icon: History,
  },
  {
    id: 'settings',
    title: 'Models & settings',
    titleHe: 'מודלים והגדרות',
    icon: Settings2,
  },
];


function assetPreset(e: Row, view = 'master', base = ''): Row {
  const setup = e.type === 'location'
    ? 'One wide establishing photograph of this empty location. Show coherent spatial layout, entrances, materials and distinctive landmarks. Camera at eye level.'
    : e.type === 'prop'
      ? 'One complete object, three-quarter product photograph on a plain neutral background. Show its silhouette, materials, colors and scale clearly.'
      : 'One subject only, full body three-quarter reference photograph on a plain neutral studio background. Natural resting posture and calm, neutral expression, with relaxed closed mouth regardless of temporary story emotions in the description. Entire body visible. Preserve face, proportions, wardrobe or fur markings.';
  return {entityId:e.id, assetView:view, assetBaseVersionId:base || null, references:base?[base]:[], workflowTask:'keyframe',model:base?'fal-ai/flux-2/edit':'fal-ai/qwen-image',
    prompt:`Reusable production asset: ${e.name}. ${e.description || ''}\n${view==='master'?setup:(ASSET_VIEWS as Row)[view].instruction}\n${base?'Use the provided approved image as the identity and visual source. Change only the requested view.':''}\nIdentity details: ${e.continuity || ''}\nSingle continuous image, even readable light. No panels, collage, captions, text, action or story events.`,
    options:{negative_prompt:'collage, multiple panels, duplicate subjects, extra limbs, text, watermark, captions'}};
}
// Display the same branch-scoped numbering used by the server. This also
// repairs the label of older records that were created before branch-scoped
// numbering was introduced, without rewriting their permanent history.
function versionNumber(version: Row, versions: Row[]) {
  const peers = versions
    .filter(
      (candidate) =>
        (version.entityId
          ? candidate.entityId === version.entityId
          : candidate.shotId === version.shotId) &&
        candidate.kind === version.kind &&
        (candidate.workflowTask || null) === (version.workflowTask || null),
    )
    .sort((a, b) => {
      const time =
        new Date(a.createdAt || 0).getTime() -
        new Date(b.createdAt || 0).getTime();
      return time || String(a.id).localeCompare(String(b.id));
    });
  const index = peers.findIndex((candidate) => candidate.id === version.id);
  return index >= 0 ? index + 1 : version.number || 1;
}
function explainGenerationError(error: string, isHebrew: boolean) {
  if (/likenesses of real people|private information/i.test(error))
    return isHebrew
      ? `${error} הספק חסם את הרפרנס בגלל זיהוי אפשרי של אדם אמיתי או מידע פרטי. נסו רפרנס של דמות סינתטית שנוצרה אצלנו, או הסירו את רפרנס התמונה וצרו את הווידאו מחדש.`
      : `${error} The provider blocked this reference because it may contain a real person or private information. Try a synthetic character reference created in the bible, or remove the image reference and regenerate.`;
  return error;
}
export default function Home() {
  const [films, setFilms] = useState<Row[]>([]),
    [film, setFilm] = useState<Film | null>(null),
    [status, setStatus] = useState<Row>({ models: [], checks: {} }),
    [falCatalog, setFalCatalog] = useState<Row[]>([]),
    [view, setView] = useState('guided'),
    [advancedTools, setAdvancedTools] = useState(false),
    [modal, setModal] = useState(''),
    [shotId, setShotId] = useState(''),
    [versionId, setVersionId] = useState(''),
    [entity, setEntity] = useState<Row | null>(null),
    [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    [query, setQuery] = useState(''),
    [sceneFilter, setSceneFilter] = useState('all'),
    [statusFilter, setStatusFilter] = useState('all'),
    [list, setList] = useState(false),
    [shotTab, setShotTab] = useState('direction'),
    [revision, setRevision] = useState<Row | null>(null),
    [generationPreset, setGenerationPreset] = useState<Row | null>(null),
    [exports, setExports] = useState<Row[]>([]),
    [exportPending, setExportPending] = useState(false),
    [exportError, setExportError] = useState(''),
    [requestedExport, setRequestedExport] = useState(''),
    [issues, setIssues] = useState<Row[]>([]),
    [history, setHistory] = useState<Row[]>([]),
    [locale, setLocale] = useState<'he' | 'en'>('he');
  const isHebrew = locale === 'he';
  const t = (english: string, hebrew: string) => (isHebrew ? hebrew : english);
  const currentId = useRef('');
  const reviewReturn = useRef('');
  function openReview(id: string) {
    reviewReturn.current = modal === 'review' ? reviewReturn.current : modal;
    setVersionId(id); setModal('review');
  }
  const uploadRef = useRef<HTMLInputElement>(null);
  const [uploadShot, setUploadShot] = useState('');
  useEffect(() => {
    const saved = window.localStorage.getItem('frameforge-locale');
    if (saved === 'en' || saved === 'he') setLocale(saved);
  }, []);
  useEffect(() => {
    document.documentElement.lang = isHebrew ? 'he' : 'en';
    document.documentElement.dir = isHebrew ? 'rtl' : 'ltr';
    window.localStorage.setItem('frameforge-locale', locale);
  }, [isHebrew, locale]);
  const loadFilm = useCallback(async (id: string) => {
    currentId.current = id;
    localStorage.setItem('frameforge-current-film', id);
    const [f, i, e] = await Promise.all([
      api(`/films/${id}`),
      api(`/films/${id}/issues`),
      api(`/films/${id}/exports`),
    ]);
    if (currentId.current !== id) return;
    setFilm(f);
    setIssues(i);
    setExports(e);
  }, []);
  const refresh = useCallback(async () => {
    const list = await api('/films');
    setFilms(list);
    if (currentId.current) await loadFilm(currentId.current);
  }, [loadFilm]);
  useEffect(() => {
    Promise.all([api('/films'), api('/status')])
      .then(([f, s]) => {
        setFilms(f);
        setStatus(s);
        const saved = localStorage.getItem('frameforge-current-film');
        const selected = f.find((film: Row) => film.id === saved) || f[0];
        if (selected) return loadFilm(selected.id);
      })
      .catch((e) => setError(e.message));
  }, [loadFilm]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (currentId.current) loadFilm(currentId.current).catch(() => {});
    }, 5000);
    return () => clearInterval(timer);
  }, [loadFilm]);
  useEffect(() => {
    if (view === 'history' && film)
      api(`/films/${film.id}/events`)
        .then(setHistory)
        .catch((e) => setError(e.message));
  }, [view, film]);
  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(''), 4500);
      return () => clearTimeout(t);
    }
  }, [message]);
  async function action(
    path: string,
    b?: unknown,
    method?: string,
    notice = t('Saved to production record', 'נשמר בתיעוד ההפקה'),
  ) {
    try {
      const result = await api(path, b, method);
      await refresh();
      setMessage(notice);
      return result;
    } catch (e) {
      setError((e as Error).message);
      throw e;
    }
  }
  async function loadFalCatalog() {
    try {
      const result = await api('/models/catalog');
      setFalCatalog(result.models || []);
      setMessage(t('FAL catalog loaded', 'קטלוג FAL נטען'));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const downloadedExport = useRef('');
  useEffect(() => {
    const result = exports.find((e) => e.id === requestedExport);
    if (
      !result ||
      result.status !== 'complete' ||
      downloadedExport.current === result.id
    )
      return;
    downloadedExport.current = result.id;
    const link = document.createElement('a');
    link.href = `/api/exports/${result.id}/film.mp4`;
    link.download = 'film.mp4';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }, [exports, requestedExport]);
  useEffect(() => {
    setExportError('');
    setRequestedExport('');
  }, [film?.id]);
  async function exportAndDownload(final: boolean) {
    if (!film || exportPending) return;
    setExportPending(true);
    setExportError('');
    try {
      const result = await api(`/films/${film.id}/exports`, { final }, 'POST');
      setRequestedExport(result.id);
      await refresh();
    } catch (e) {
      setExportError((e as Error).message);
    } finally {
      setExportPending(false);
    }
  }
  const act = (path: string, b?: unknown, method?: string, notice?: string) => {
    void action(path, b, method, notice).catch(() => {});
  };
  useEffect(() => {
    const context = (document as Document & { modelContext?: Row })
      .modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    Promise.resolve(
      context.registerTool(
        {
          name: 'read_current_film',
          title: 'Read current film',
          description:
            'Read scenes, shots, selected versions, and production state of the currently open film.',
          inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true, untrustedContentHint: true },
          execute: async (input: Row) => {
            if (Object.keys(input || {}).length)
              throw Error('No arguments expected');
            return api(`/films/${currentId.current}`);
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => {});
    return () => lifecycle.abort();
  }, []);
  const shot = film?.shots.find((s) => s.id === shotId),
    version = film?.versions.find((v) => v.id === versionId);
  function openShot(s: Row) {
    setShotId(s.id);
    setShotTab('direction');
    setRevision(null);
    setModal('shot');
  }
  async function importFile(file: File) {
    if (!film) return;
    setMessage('Archiving original media…');
    try {
      const res = await fetch(
        `/api/films/${film.id}/import?name=${encodeURIComponent(file.name)}&shotId=${encodeURIComponent(uploadShot)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: file,
        },
      );
      const result = (await res.json()) as Row;
      if (!res.ok) throw Error(result.error);
      await refresh();
      setMessage('Original archived. Ready for review.');
    } catch (e) {
      setError((e as Error).message);
    }
    if (uploadRef.current) uploadRef.current.value = '';
  }
  function importFor(id = '') {
    setUploadShot(id);
    setTimeout(() => uploadRef.current?.click(), 0);
  }
  const selected = film?.shots.filter((s) => s.selectedVersionId).length || 0,
    approved =
      film?.shots.filter(
        (s) =>
          film.versions.find((v) => v.id === s.selectedVersionId)?.status ===
          'approved',
      ).length || 0,
    duration = film?.shots.reduce((n, s) => n + s.duration, 0) || 0;
  const spent =
    (film?.versions.reduce(
      (n, v) => n + (v.actualCost ?? v.estimatedCost ?? 0),
      0,
    ) || 0) +
    (film?.workflow?.drafts || [])
      .filter((d: Row) => d.source !== 'manual-revision')
      .reduce((n: number, d: Row) => n + (d.actualCost || 0), 0);
  if (!film)
    return (
      <div className="boot">
        <Clapperboard size={40} />
        <h1>FRAMEFORGE</h1>
        {error ? (
          <div>
            <p role="alert">
              {error}{' '}
              {t(
                'Start the local production server and reload.',
                'הפעילו את שרת ההפקה המקומי ורעננו את העמוד.',
              )}
            </p>
            <Button onClick={() => location.reload()}>
              {t('Reconnect', 'התחברות מחדש')}
            </Button>
          </div>
        ) : (
          <p>
            {t('Opening your production workspace…', 'פותחים את סביבת ההפקה…')}
          </p>
        )}
      </div>
    );
  const base = `/films/${film.id}`;
  return (
    <SidebarProvider>
      <Sidebar side={isHebrew ? 'right' : 'left'} className="studio-sidebar">
        <SidebarHeader>
          <div className="brand">
            <Clapperboard />
            <strong>
              FRAMEFORGE<span>FILM PRODUCTION STUDIO</span>
            </strong>
          </div>
          <div className="film-picker">
            <span className="eyebrow">
              {t('CURRENT PRODUCTION', 'הפקה נוכחית')}
            </span>
            <Pick
              label={t('Choose film', 'בחירת סרט')}
              value={film.id}
              items={films.map((f) => ({ value: f.id, label: f.title }))}
              onChange={(id) => {
                setModal('');
                setShotId('');
                setSceneFilter('all');
                void loadFilm(id).catch((e) => setError(e.message));
              }}
            />
            <button onClick={() => setModal('film')} className="text-button">
              <Plus size={13} /> {t('New production', 'הפקה חדשה')}
            </button>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {NAV.filter(
              (n) =>
                advancedTools ||
                ['guided', 'cut', 'settings', view].includes(n.id),
            ).map((n) => (
              <SidebarMenuItem key={n.id}>
                <SidebarMenuButton
                  isActive={view === n.id}
                  onClick={() => setView(n.id)}
                >
                  <n.icon />
                  {isHebrew ? n.titleHe : n.title}
                  {n.id === 'review' &&
                    issues.filter((i) => i.severity === 'warning').length >
                      0 && (
                      <span className="nav-count">
                        {issues.filter((i) => i.severity === 'warning').length}
                      </span>
                    )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
          <button
            className="text-button"
            aria-expanded={advancedTools}
            onClick={() => setAdvancedTools(!advancedTools)}
          >
            <Settings2 size={16} />
            {advancedTools
              ? t('Hide professional tools', 'הסתרת כלים מקצועיים')
              : t('Professional tools', 'כלים מקצועיים')}
          </button>
        </SidebarContent>
        <SidebarFooter>
          <div className="sidebar-bottom">
            <div>
              <span className="local-indicator">
                {t('LOCAL WORKSPACE', 'סביבת עבודה מקומית')}
              </span>
              <small>
                {t('Every decision has a history.', 'לכל החלטה יש היסטוריה.')}
              </small>
            </div>
            <button
              aria-label={t('Open model settings', 'פתיחת הגדרות מודלים')}
              onClick={() => setView('settings')}
            >
              <Settings2 size={18} />
            </button>
          </div>
        </SidebarFooter>
      </Sidebar>
      <main className="studio-main">
        <header className="topbar">
          <div className="crumb">
            <SidebarTrigger />
            <span>
              {t('PRODUCTIONS', 'הפקות')} <span className="slash">/</span>
              <strong>{film.title}</strong>
            </span>
          </div>
          <div className="top-actions">
            <button
              type="button"
              className="language-toggle"
              onClick={() => setLocale(isHebrew ? 'en' : 'he')}
              aria-label={t(
                'Switch interface language to Hebrew',
                'החלפת שפת הממשק לאנגלית',
              )}
              title={t('עברית', 'English')}
            >
              <span aria-hidden="true">א</span>
              {isHebrew ? 'עברית' : 'English'}
            </button>
            <span className="saved">
              <Check size={13} /> {t('Local archive', 'ארכיון מקומי')}
            </span>
            <Button variant="outline" size="sm" onClick={() => setView('cut')}>
              <Play size={14} /> {t('Open cut', 'פתיחת העריכה')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setView('cut');
                requestAnimationFrame(() =>
                  document
                    .getElementById('film-downloads')
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
                );
              }}
            >
              <Download size={14} /> {t('Film downloads', 'הורדות הסרטים')}
            </Button>
          </div>
        </header>
        <div className="page">
          <div className="eyebrow">
            {view === 'shots'
              ? t('PRODUCTION / SHOT WORKSPACE', 'הפקה / מרחב השוטים')
              : `${t('PRODUCTION', 'הפקה')} / ${isHebrew ? NAV.find((n) => n.id === view)?.titleHe : NAV.find((n) => n.id === view)?.title.toUpperCase()}`}
          </div>
          <div className="page-heading">
            <div>
              <h1>
                {view === 'shots'
                  ? film.title
                  : isHebrew
                    ? NAV.find((n) => n.id === view)?.titleHe
                    : NAV.find((n) => n.id === view)?.title}
              </h1>
              <p>
                {
                  (
                    {
                      guided: t(
                        'Develop your film together with AI, one reviewed step at a time.',
                        'מפתחים את הסרט יחד עם AI, שלב אחד בכל פעם, עם מקום לבדיקה ולתיקון.',
                      ),
                      shots:
                        film.logline ||
                        t(
                          'Shape each frame. Keep the whole film in view.',
                          'עצבו כל פריים ושמרו על הסרט כולו בתמונה.',
                        ),
                      story: t(
                        'From the first idea to the final line.',
                        'מהרעיון הראשון ועד השורה האחרונה.',
                      ),
                      bible: t(
                        'The people, places, and rules that make this film yours.',
                        'הדמויות, המקומות והכללים שהופכים את הסרט לשלכם.',
                      ),
                      cut: t(
                        'One sequence. Every selected shot. Always replaceable.',
                        'רצף אחד. כל שוט נבחר. תמיד ניתן להחלפה.',
                      ),
                      audio: t(
                        'Build the voice, atmosphere, and emotional rhythm of your film.',
                        'בנו את הקול, האווירה והקצב הרגשי של הסרט.',
                      ),
                      review: t(
                        'Review the details. Protect the intent.',
                        'בדקו את הפרטים. שמרו על הכוונה.',
                      ),
                      history: t(
                        'An unbroken record of how your film came together.',
                        'תיעוד רציף של הדרך שבה הסרט נוצר.',
                      ),
                      settings: t(
                        'Choose the right tool for each creative decision.',
                        'בחרו את הכלי הנכון לכל החלטה יצירתית.',
                      ),
                    } as Row
                  )[view]
                }
              </p>
            </div>
            <div className="heading-actions">
              {view === 'shots' && (
                <>
                  <Button variant="outline" onClick={() => setModal('scene')}>
                    <Plus /> {t('Scene', 'סצנה')}
                  </Button>
                  <Button onClick={() => setModal('newshot')}>
                    <Plus /> {t('New shot', 'שוט חדש')}
                  </Button>
                </>
              )}
              {view === 'bible' && (
                <Button
                  onClick={() => {
                    setEntity(null);
                    setModal('entity');
                  }}
                >
                  <Plus /> {t('Add to bible', 'הוספה לספר ההפקה')}
                </Button>
              )}
              {view === 'audio' && (
                <Button onClick={() => importFor()}>
                  <Upload /> {t('Import audio', 'ייבוא אודיו')}
                </Button>
              )}
              {view === 'history' && <VersionLibrary film={film} archiveOnly onChanged={refresh} onReview={(id)=>{openReview(id);}} hebrew={isHebrew} />}
          {view === 'history' && (
                <a className="button-link" href={`/api${base}/archive`}>
                  <Download size={16} /> {t('Export record', 'ייצוא תיעוד')}
                </a>
              )}
            </div>
          </div>
          {view === 'guided' && (
            <GuidedWorkflow
              key={film.id}
              film={film}
              configured={status.falConfigured}
              isHebrew={isHebrew}
              onChanged={refresh}
              onGenerate={(id, preset) => {
                setShotId(id);
                setRevision(null);
                setGenerationPreset({ ...preset, shotId: id });
                setShotTab('generate');
                setModal('shot');
              }}
              onReview={(id) => {
                openReview(id);
              }}
              onEntity={(id) => {
                setEntity(film.entities.find(e=>e.id===id) || null);
                setModal('entity');
              }}
              onNavigate={setView}
            />
          )}
          {view === 'shots' && (
            <>
              <div className="overview-strip">
                <div>
                  <span>{t('PRODUCTION STAGE', 'שלב ההפקה')}</span>
                  <strong className="stage-label">
                    <span className="live-dot" />
                    {approved && approved === film.shots.length
                      ? t('Ready for delivery', 'מוכן למסירה')
                      : selected
                        ? t('In production', 'בהפקה')
                        : t('Pre-production', 'קדם־הפקה')}
                  </strong>
                </div>
                <div>
                  <span>{t('SHOT LIST', 'רשימת שוטים')}</span>
                  <strong>
                    {String(film.shots.length).padStart(2, '0')}{' '}
                    <small>{t('shots', 'שוטים')}</small>
                  </strong>
                </div>
                <div>
                  <span>{t('APPROVED PICTURE', 'תמונה מאושרת')}</span>
                  <strong>
                    {String(approved).padStart(2, '0')}{' '}
                    <small>/ {film.shots.length}</small>
                  </strong>
                </div>
                <div>
                  <span>{t('PLANNED RUNTIME', 'משך מתוכנן')}</span>
                  <strong className="mono">{clock(duration)}</strong>
                </div>
              </div>
              <div className="board-toolbar">
                <div className="search">
                  <Search size={16} />
                  <Input
                    aria-label={t('Search shots', 'חיפוש שוטים')}
                    placeholder={t('Find a shot…', 'חיפוש שוט…')}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <Pick
                  value={sceneFilter}
                  onChange={setSceneFilter}
                  label={t('Scene filter', 'סינון לפי סצנה')}
                  items={[
                    { value: 'all', label: t('All scenes', 'כל הסצנות') },
                    ...film.scenes.map((s) => ({
                      value: s.id,
                      label: s.title,
                    })),
                  ]}
                />
                <Pick
                  value={statusFilter}
                  onChange={setStatusFilter}
                  label={t('Review filter', 'סינון לפי ביקורת')}
                  items={[
                    'all',
                    'planned',
                    'review',
                    'approved',
                    'rejected',
                  ].map((x) => ({
                    value: x,
                    label:
                      x === 'all'
                        ? t('All statuses', 'כל המצבים')
                        : isHebrew
                          ? (
                              {
                                planned: 'מתוכנן',
                                review: 'בביקורת',
                                approved: 'מאושר',
                                rejected: 'נדחה',
                              } as Row
                            )[x]
                          : x[0].toUpperCase() + x.slice(1),
                  }))}
                />
                <div className="view-toggle">
                  <Button
                    variant={!list ? 'secondary' : 'ghost'}
                    size="icon"
                    aria-label={t('Grid view', 'תצוגת רשת')}
                    onClick={() => setList(false)}
                  >
                    <Grid2X2 />
                  </Button>
                  <Button
                    variant={list ? 'secondary' : 'ghost'}
                    size="icon"
                    aria-label={t('List view', 'תצוגת רשימה')}
                    onClick={() => setList(true)}
                  >
                    <List />
                  </Button>
                </div>
              </div>
              {!film.shots.length ? (
                <section className="first-frame">
                  <div className="frame-corner tl" />
                  <div className="frame-corner br" />
                  <Clapperboard size={42} />
                  <div className="eyebrow">
                    {t('THE FIRST FRAME', 'הפריים הראשון')}
                  </div>
                  <h2>
                    {t('A blank slate. A whole world.', 'דף חלק. עולם שלם.')}
                  </h2>
                  <p>
                    {t(
                      'Start with a scene and a shot. Every version, reference, and creative decision stays with your film.',
                      'התחילו בסצנה ובשוט. כל גרסה, רפרנס והחלטה יצירתית נשמרים עם הסרט.',
                    )}
                  </p>
                  <Button onClick={() => setModal('newshot')}>
                    {t('Create the first shot', 'יצירת השוט הראשון')}{' '}
                    <ArrowUpRight />
                  </Button>
                  <button
                    className="text-button"
                    onClick={() => setView('story')}
                  >
                    {t('Begin with the screenplay', 'התחלה מהתסריט')}{' '}
                    <ChevronRight size={14} />
                  </button>
                </section>
              ) : (
                <div className={list ? 'shot-list' : 'shot-grid'}>
                  {[...film.shots]
                    .sort((a, b) => a.order - b.order)
                    .filter((s) => {
                      const v = film.versions.find(
                        (v) => v.id === s.selectedVersionId,
                      );
                      return (
                        (sceneFilter === 'all' || s.sceneId === sceneFilter) &&
                        (statusFilter === 'all' ||
                          (v?.status || 'planned') === statusFilter) &&
                        `${s.title} ${s.code} ${s.prompt}`
                          .toLowerCase()
                          .includes(query.toLowerCase())
                      );
                    })
                    .map((s) => {
                      const versions = film.versions.filter(
                          (v) => v.shotId === s.id,
                        ),
                        v =
                          versions.find((v) => v.id === s.selectedVersionId) ||
                          versions.filter((v) => v.kind !== 'audio').at(-1);
                      return (
                        <button
                          className="shot-card"
                          key={s.id}
                          onClick={() => openShot(s)}
                        >
                          <div className="shot-image">
                            <Media version={v} />
                            <span className="shot-code">{s.code}</span>
                            <span className="shot-time">{s.duration}s</span>
                            {s.selectedVersionId && (
                              <span className="selected-marker">
                                <Check size={12} /> {t('IN CUT', 'בעריכה')}
                              </span>
                            )}
                          </div>
                          <div className="shot-card-body">
                            <div className="shot-title">
                              <h3>{s.title}</h3>
                              <Status value={v?.status || 'planned'} />
                            </div>
                            <p>
                              {film.scenes.find((sc) => sc.id === s.sceneId)
                                ?.title ||
                                t('Unassigned scene', 'סצנה לא משויכת')}
                            </p>
                            <div className="shot-footer">
                              <span>{s.camera}</span>
                              <span>
                                <GitBranch size={12} />
                                {versions.length} {t('versions', 'גרסאות')}
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  <button
                    className="add-shot-card"
                    onClick={() => setModal('newshot')}
                  >
                    <Plus />
                    <span>{t('Add a shot', 'הוספת שוט')}</span>
                  </button>
                </div>
              )}
              <div className="board-foot">
                <span>
                  <Link2 size={14} /> {selected}{' '}
                  {t('shots connected to your cut', 'שוטים מחוברים לעריכה')}
                </span>
                <button onClick={() => setView('cut')} className="text-button">
                  {t('Open connected cut', 'פתיחת העריכה המחוברת')}{' '}
                  <ArrowUpRight size={15} />
                </button>
              </div>
            </>
          )}
          {view === 'story' && (
            <div className="two-column story-layout">
              <section className="panel">
                <div className="panel-heading">
                  <BookOpen size={18} />
                  <h2>{t('Story document', 'מסמך הסיפור')}</h2>
                  <span className="status">
                    {t('Revision', 'גרסה')} {film.revision}
                  </span>
                </div>
                <TextForm
                  key={film.id}
                  initial={film}
                  fields={[
                    { key: 'title', label: t('Film title', 'שם הסרט') },
                    {
                      key: 'logline',
                      label: t('Logline', 'לוגליין'),
                      area: true,
                    },
                    {
                      key: 'screenplay',
                      label: t('Screenplay', 'תסריט'),
                      area: true,
                      hint: t(
                        'Write or paste your screenplay. Every save keeps the previous text in the production record.',
                        'כתבו או הדביקו את התסריט. כל שמירה מתועדת ברשומת ההפקה.',
                      ),
                    },
                  ]}
                  onSave={(b) => action(base, b, 'PATCH')}
                />
              </section>
              <aside className="panel">
                <div className="panel-heading">
                  <h2>{t('Scenes', 'סצנות')}</h2>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setModal('scene')}
                    aria-label={t('Add scene', 'הוספת סצנה')}
                  >
                    <Plus />
                  </Button>
                </div>
                {film.scenes.map((s, i) => (
                  <div className="scene-row" key={s.id}>
                    <span className="mono">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div>
                      <h3>{s.title}</h3>
                      <p>
                        {s.summary ||
                          t('No scene summary yet.', 'טרם נכתב תקציר סצנה.')}
                      </p>
                      <small>
                        {film.shots.filter((sh) => sh.sceneId === s.id).length}{' '}
                        {t('shots', 'שוטים')}
                      </small>
                      <button
                        className="text-button"
                        onClick={() => setModal('editscene:' + s.id)}
                      >
                        {t('Edit scene', 'עריכת סצנה')}
                      </button>
                    </div>
                  </div>
                ))}
                {!film.scenes.length && (
                  <p>
                    {t(
                      'Add scene headings to turn your screenplay into a shot plan.',
                      'הוסיפו כותרות סצנה כדי להפוך את התסריט לתוכנית שוטים.',
                    )}
                  </p>
                )}
              </aside>
            </div>
          )}
          {view === 'bible' && (
            <>
              <div className="bible-banner">
                <LockKeyhole />
                <div>
                  <strong>
                    {t(
                      'Lock the world before you generate.',
                      'נעלו את עולם הסרט לפני היצירה.',
                    )}
                  </strong>
                  <p>
                    {t(
                      'Attach bible entries to shots. Their identity and continuity notes are included in every visual prompt and archived with each version.',
                      'שייכו רשומות מספר ההפקה לשוטים. הזהות וכללי הרציפות נכללים בכל פרומפט חזותי ונשמרים עם כל גרסה.',
                    )}
                  </p>
                </div>
                <span className="mono">BIBLE REV. {film.bibleRevision}</span>
              </div>
              <div className="bible-grid">
                {film.entities.map((e) => (
                  <button
                    className="bible-card"
                    key={e.id}
                    onClick={() => {
                      setEntity(e);
                      setModal('entity');
                    }}
                  >
                    <div className="bible-card-top">
                      <span className="eyebrow">{e.type}</span>
                      {e.locked ? (
                        <LockKeyhole size={16} />
                      ) : (
                        <Unlock size={16} />
                      )}
                    </div>
                    {(e.referenceVersionIds?.[0] ||
                      film.versions.find(
                        (v) =>
                          v.entityId === e.id &&
                          v.localPath &&
                          v.status !== 'rejected',
                      )?.id) && (
                      <div className="bible-image">
                        <Media
                          version={
                            film.versions.find(
                              (v) => v.id === e.referenceVersionIds?.[0],
                            ) ||
                            film.versions.find(
                              (v) =>
                                v.entityId === e.id &&
                                v.localPath &&
                                v.status !== 'rejected',
                            )
                          }
                        />
                      </div>
                    )}
                    <h2>{e.name}</h2>
                    <p>
                      {e.description ||
                        t(
                          'Add identity and visual details.',
                          'הוסיפו פרטי זהות ומראה.',
                        )}
                    </p>
                    <div className="bible-card-foot">
                      <Status value={e.locked ? 'locked' : 'draft'} />
                      {film.versions.some(
                        (v) => v.entityId === e.id && v.status === 'review',
                      ) && (
                        <span className="status-muted">
                          {t('Pending review', 'ממתין לבדיקה')}
                        </span>
                      )}
                      <span>
                        {film.versions.filter(
                          (v) =>
                            v.entityId === e.id &&
                            v.localPath &&
                            v.status !== 'rejected',
                        ).length || e.referenceVersionIds?.length || 0}{' '}
                        {t('references', 'רפרנסים')}
                      </span>
                    </div>
                    <span
                      className="button-link bible-generate"
                      onClick={(event) => {
                        event.stopPropagation();
                        setEntity(e);
                        setGenerationPreset(assetPreset(e));
                        setModal('entity-generator');
                      }}
                    >
                      <WandSparkles size={15} />{' '}
                      {t('Create identity image', 'יצירת תמונת זהות')}
                    </span>
                  </button>
                ))}
              </div>
              {!film.entities.length && (
                <Empty
                  title={t(
                    'Define the world of your film',
                    'הגדירו את עולם הסרט',
                  )}
                  text={t(
                    'Create character identities, locations, props, a visual style, and voice profiles. Lock approved descriptions and attach source references.',
                    'צרו זהויות לדמויות, לוקיישנים, אביזרים, סגנון חזותי ופרופילי קול. נעלו תיאורים מאושרים וצרפו רפרנסים מקוריים.',
                  )}
                  action={
                    <Button
                      onClick={() => {
                        setEntity(null);
                        setModal('entity');
                      }}
                    >
                      <Plus />{' '}
                      {t('Add the first bible entry', 'הוספת הרשומה הראשונה')}
                    </Button>
                  }
                />
              )}
              <section className="panel mt">
                <h2>{t('Visual language', 'שפה חזותית')}</h2>
                <TextForm
                  key={film.id}
                  initial={{ style: film.style }}
                  fields={[
                    {
                      key: 'style',
                      label: t(
                        'Film-wide style, color, lens, and lighting rules',
                        'כללי סגנון, צבע, עדשה ותאורה לכל הסרט',
                      ),
                      area: true,
                    },
                  ]}
                  onSave={(b) => action(base, b, 'PATCH')}
                />
              </section>
              <section className="panel mt">
                <h2>{t('Source library', 'ספריית מקורות')}</h2>
                <p>
                  {t(
                    'Import identity sheets, location photographs, wardrobe references, props, and voice samples.',
                    'ייבאו דפי זהות, צילומי לוקיישן, רפרנסים לבגדים, אביזרים ודגימות קול.',
                  )}
                </p>
                <Button variant="outline" onClick={() => importFor()}>
                  <Upload /> {t('Import reference', 'ייבוא רפרנס')}
                </Button>
                <div className="source-grid">
                  {film.versions
                    .filter((v) => !v.shotId)
                    .map((v) => (
                      <button
                        key={v.id}
                        onClick={() => {
                          openReview(v.id);
                        }}
                      >
                        <div className="source-thumb">
                          <Media version={v} />
                        </div>
                        <span>{v.label}</span>
                        <Status value={v.status} />
                      </button>
                    ))}
                </div>
              </section>
            </>
          )}
          {view === 'cut' && (
            <>
              <div className="row-actions" aria-label={t('Cut history', 'ביטול והחזרה בעריכה')}>
                <Button variant="outline" disabled={!film.cutHistory?.past?.length} onClick={()=>act(`${base}/cut-history`,{direction:'undo'})}>{t('Undo edit', 'ביטול פעולת העריכה')}</Button>
                <Button variant="outline" disabled={!film.cutHistory?.future?.length} onClick={()=>act(`${base}/cut-history`,{direction:'redo'})}>{t('Redo edit', 'החזרת פעולת העריכה')}</Button>
                <small>{t('Shot selection, order and timing. Generated media stays saved.', 'בחירת גרסה, סדר ותזמון השוטים. המדיה שנוצרה נשארת שמורה.')}</small>
              </div>
              <CutPlayer film={film} />
              <div className="two-column mt">
                <section className="panel">
                  <h2>{t('Edit sequence', 'עריכת הרצף')}</h2>
                  <p>
                    {t(
                      'Adjust source in-points, duration, and original video audio. Replacing a selected version keeps this edit intact.',
                      'התאימו נקודת כניסה, משך וסאונד וידאו מקורי. החלפת גרסה נבחרת שומרת על העריכה הזאת.',
                    )}
                  </p>
                  {[...film.shots]
                    .sort((a, b) => a.order - b.order)
                    .map((s, i) => (
                      <div className="edit-row" key={s.id}>
                        <button
                          className="edit-shot"
                          onClick={() => openShot(s)}
                          onKeyDown={(e) => e.key === 'Enter' && openShot(s)}
                        >
                          <span className="mono">{s.code}</span>
                          <strong>{s.title}</strong>
                        </button>
                        <Field label={t('In (s)', 'כניסה (שנ׳)')}>
                          <Input
                            aria-label={`${s.code} trim in`}
                            type="number"
                            step=".1"
                            min="0"
                            defaultValue={s.trimIn}
                            key={`in-${s.id}-${s.trimIn}`}
                            onBlur={(e) =>
                              Number(e.target.value) !== s.trimIn &&
                              act(
                                `${base}/shots/${s.id}`,
                                { trimIn: Number(e.target.value) },
                                'PATCH',
                              )
                            }
                          />
                        </Field>
                        <Field label={t('Length (s)', 'משך (שנ׳)')}>
                          <Input
                            aria-label={`${s.code} duration`}
                            type="number"
                            step=".1"
                            min=".1"
                            defaultValue={s.duration}
                            key={`len-${s.id}-${s.duration}`}
                            onBlur={(e) =>
                              Number(e.target.value) !== s.duration &&
                              act(
                                `${base}/shots/${s.id}`,
                                { duration: Number(e.target.value) },
                                'PATCH',
                              )
                            }
                          />
                        </Field>
                        <Toggle
                          checked={Boolean(s.originalAudioMuted)}
                          onChange={(originalAudioMuted) =>
                            act(
                              `${base}/shots/${s.id}`,
                              { originalAudioMuted },
                              'PATCH',
                            )
                          }
                        >
                          {t('Mute original audio', 'השתקת הסאונד המקורי')}
                        </Toggle>
                        <div>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Move ${s.code} earlier`}
                            disabled={i === 0}
                            onClick={() => {
                              const order = [...film.shots]
                                .sort((a, b) => a.order - b.order)
                                .map((s) => s.id);
                              [order[i - 1], order[i]] = [
                                order[i],
                                order[i - 1],
                              ];
                              act(`${base}/cut`, { order });
                            }}
                          >
                            <ArrowUp />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Move ${s.code} later`}
                            disabled={i === film.shots.length - 1}
                            onClick={() => {
                              const order = [...film.shots]
                                .sort((a, b) => a.order - b.order)
                                .map((s) => s.id);
                              [order[i], order[i + 1]] = [
                                order[i + 1],
                                order[i],
                              ];
                              act(`${base}/cut`, { order });
                            }}
                          >
                            <ArrowDown />
                          </Button>
                        </div>
                      </div>
                    ))}
                </section>
                <section
                  className="panel"
                  id="film-downloads"
                  style={{ scrollMarginTop: 24 }}
                >
                  <h2>
                    {t('Film downloads & delivery', 'הורדות הסרטים ומסירה')}
                  </h2>
                  <p>
                    H.264 picture, stereo AAC, {film.aspectRatio}, {film.fps}{' '}
                    fps.{' '}
                    {t(
                      'Active audio tracks are mixed into the export.',
                      'ערוצי האודיו הפעילים מעורבבים לייצוא.',
                    )}
                  </p>
                  <div className="delivery-actions">
                    <Button
                      variant="outline"
                      disabled={
                        !film.shots.length ||
                        exportPending ||
                        exports.some((e) => e.status === 'rendering')
                      }
                      onClick={() => void exportAndDownload(false)}
                    >
                      <Download />{' '}
                      {t(
                        'Export & download working cut',
                        'ייצוא והורדת עריכת עבודה',
                      )}
                    </Button>
                    <Button
                      disabled={
                        !film.shots.length ||
                        exportPending ||
                        exports.some((e) => e.status === 'rendering')
                      }
                      onClick={() => void exportAndDownload(true)}
                    >
                      <ShieldCheck />{' '}
                      {t(
                        'Export & download approved film',
                        'ייצוא והורדת סרט מאושר',
                      )}
                    </Button>
                  </div>
                  {exportError && (
                    <div role="alert" className="error">
                      <strong>
                        {t('Export could not start', 'לא ניתן להתחיל בייצוא')}
                      </strong>
                      <p>{exportError}</p>
                      <p>
                        {t(
                          'Review the selected shots and continuity warnings, or export a working cut.',
                          'בדקו את אישורי השוטים ואזהרות הרציפות, או ייצאו עריכת עבודה לצפייה.',
                        )}{' '}
                      </p>
                    </div>
                  )}
                  {(exportPending ||
                    exports.some((e) => e.status === 'rendering')) && (
                    <p role="status">
                      {t(
                        'Preparing the video. Download starts when rendering finishes; you can also use the MP4 download link below.',
                        'מכין את הסרטון. ההורדה תתחיל בסיום הרינדור; אפשר גם להוריד דרך כפתור MP4 שיופיע כאן.',
                      )}
                    </p>
                  )}
                  {requestedExport &&
                    exports.some(
                      (e) =>
                        e.id === requestedExport && e.status === 'complete',
                    ) && (
                      <p role="status">
                        {t(
                          'Your video is ready. If the download did not start, click Download MP4 below.',
                          'הסרטון מוכן. אם ההורדה לא התחילה, לחצו על ״הורדת MP4״ למטה.',
                        )}
                      </p>
                    )}
                  <p className="small">
                    {t(
                      'Working cuts can include unapproved frames and stills. Final delivery requires reviewed video and audio, with continuity warnings resolved.',
                      'עריכות עבודה יכולות לכלול פריימים וסטילס שלא אושרו. מסירה סופית מחייבת וידאו ואודיו שנבדקו וכל אזהרות הרציפות נפתרו.',
                    )}
                  </p>
                  {exports.map((e) => (
                    <div className="export-row" key={e.id}>
                      <div>
                        <strong>
                          {e.final
                            ? t('Final delivery', 'מסירה סופית')
                            : t('Working cut', 'עריכת עבודה')}
                        </strong>
                        <small>
                          {new Date(e.createdAt).toLocaleString(
                            isHebrew ? 'he-IL' : undefined,
                          )}{' '}
                          · {t('revision', 'גרסה')} {e.revision}
                        </small>
                        <p>{e.error || e.progress}</p>
                      </div>
                      {e.status === 'complete' ? (
                        <div className="export-actions">
                          <a
                            className="button-link"
                            href={`/api/exports/${e.id}/film.mp4`}
                            download="film.mp4"
                          >
                            <Download size={15} />{' '}
                            {t('Download MP4', 'הורדת MP4')}
                          </a>
                          <a
                            className="text-button"
                            href={`/api/exports/${e.id}/film.mp4`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {t('Open video', 'פתיחת וידאו')}
                          </a>
                        </div>
                      ) : (
                        <Status value={e.status} />
                      )}
                      <a
                        className="text-button"
                        href={`/api/exports/${e.id}/production.json`}
                      >
                        {t('Record', 'תיעוד')}
                      </a>
                      <a
                        className="text-button"
                        href={`/api/exports/${e.id}/cut.csv`}
                      >
                        {t('Edit list', 'רשימת עריכה')}
                      </a>
                      {e.hasSubtitles && (
                        <a
                          className="text-button"
                          href={`/api/exports/${e.id}/subtitles.srt`}
                        >
                          {t('Captions', 'כתוביות')} SRT
                        </a>
                      )}
                    </div>
                  ))}
                </section>
              </div>
            </>
          )}
          {view === 'audio' && (
            <>
              <div className="audio-paths">
                <div>
                  <Volume2 />
                  <strong>{t('Native sound', 'סאונד מובנה')}</strong>
                  <p>
                    {t(
                      'Generate picture and sound together with Kling. Review dialogue, audio, and lip-sync on the video version.',
                      'צרו תמונה וסאונד יחד עם Kling. בדקו דיאלוג, אודיו וסנכרון שפתיים בגרסת הווידאו.',
                    )}
                  </p>
                </div>
                <div>
                  <AudioLines />
                  <strong>{t('Separate sound', 'סאונד נפרד')}</strong>
                  <p>
                    {t(
                      'Generate or import dialogue, music, and effects. Attach audio to the cut, or combine it with picture using Sync Lip-sync.',
                      'צרו או ייבאו דיאלוג, מוזיקה ואפקטים. חברו אודיו לעריכה או שלבו אותו עם תמונה בעזרת Sync Lip-sync.',
                    )}
                  </p>
                </div>
              </div>
              <section className="panel">
                <div className="panel-heading">
                  <h2>{t('Audio assets', 'נכסי אודיו')}</h2>
                  <Button
                    variant="outline"
                    onClick={() =>
                      film.shots[0]
                        ? (openShot(film.shots[0]), setShotTab('generate'))
                        : setModal('newshot')
                    }
                  >
                    <Plus /> {t('Generate audio', 'יצירת אודיו')}
                  </Button>
                </div>
                <div className="audio-assets">
                  {film.versions
                    .filter((v) => v.kind === 'audio')
                    .map((v) => (
                      <div className="audio-asset" key={v.id}>
                        <div>
                          <strong>
                            {v.label} · {`v${versionNumber(v, [...film.versions, ...(film.archivedVersions || [])])}`}
                          </strong>
                          <Status value={v.status} />
                          <p>
                            {film.shots.find((s) => s.id === v.shotId)?.title ||
                              t('Source library', 'ספריית מקורות')}
                          </p>
                        </div>
                        <Media version={v} controls />
                        <div className="row-actions">
                          <Button
                            variant="outline"
                            onClick={() => {
                              openReview(v.id);
                            }}
                          >
                            {t('Review', 'ביקורת')}
                          </Button>
                          <Button
                            disabled={!v.localPath || v.status === 'rejected'}
                            onClick={() => {
                              const settings = audioTrackSettings(v);
                              return act(`${base}/tracks`, {
                                versionId: v.id,
                                label: v.label,
                                start: 0,
                                ...settings,
                              });
                            }}
                          >
                            <Plus /> {t('Add to cut', 'הוספה לעריכה')}
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>
                {!film.versions.some((v) => v.kind === 'audio') && (
                  <p>
                    {t(
                      'No audio yet. Import a recording or generate a voice, score, or sound effect from a shot.',
                      'אין אודיו עדיין. ייבאו הקלטה או צרו קול, מוזיקה או אפקט קול מתוך שוט.',
                    )}
                  </p>
                )}
              </section>
              <section className="panel mt">
                <h2>{t('Cut audio tracks', 'ערוצי אודיו בעריכה')}</h2>
                <p>
                  Set placement in seconds and gain. Preview plays gains up to
                  1×; export applies the full gain up to 3× with a peak limiter.
                </p>
                {film.tracks.map((track) => (
                  <div className="track-row" key={track.id}>
                    <AudioLines />
                    <strong>{track.label}</strong>
                    <Field label="Start (s)">
                      <Input
                        aria-label={`${track.label} start`}
                        type="number"
                        min="0"
                        step=".1"
                        defaultValue={track.start}
                        key={track.id + track.start}
                        onBlur={(e) =>
                          act(
                            `${base}/tracks/${track.id}`,
                            { start: e.target.value },
                            'PATCH',
                          )
                        }
                      />
                    </Field>
                    <Field label="Gain">
                      <Input
                        aria-label={`${track.label} gain`}
                        type="number"
                        min="0"
                        max="3"
                        step=".1"
                        defaultValue={track.gain}
                        key={track.id + track.gain}
                        onBlur={(e) =>
                          act(
                            `${base}/tracks/${track.id}`,
                            { gain: e.target.value },
                            'PATCH',
                          )
                        }
                      />
                    </Field>
                    <Toggle
                      checked={track.muted}
                      onChange={(muted) =>
                        act(`${base}/tracks/${track.id}`, { muted }, 'PATCH')
                      }
                    >
                      {t('Mute', 'השתקה')}
                    </Toggle>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`${t('Remove', 'הסרת')} ${track.label} ${t('from cut', 'מהעריכה')}`}
                      onClick={() =>
                        act(
                          `${base}/tracks/${track.id}`,
                          { remove: true },
                          'PATCH',
                        )
                      }
                    >
                      <Trash2 />
                    </Button>
                  </div>
                ))}
              </section>
            </>
          )}
          {view === 'review' && (
            <div className="two-column">
              <section className="panel">
                <h2>{t('Continuity readiness', 'מוכנות לרציפות')}</h2>
                <p>
                  {t(
                    'Rule-based production checks. Visual, motion, and audio quality require your review.',
                    'בדיקות הפקה המבוססות על כללים. איכות חזותית, תנועה וסאונד דורשות את הביקורת שלכם.',
                  )}
                </p>
                {issues.map((i, n) => (
                  <button
                    className="issue"
                    key={n}
                    onClick={() => {
                      const s = film.shots.find((s) => s.id === i.shotId);
                      if (s) openShot(s);
                    }}
                  >
                    <AlertTriangle size={16} />
                    <span>{i.text}</span>
                    <ChevronRight size={14} />
                  </button>
                ))}
                {!issues.length && (
                  <p>
                    {film.shots.length
                      ? t(
                          'No production readiness warnings.',
                          'אין אזהרות מוכנות להפקה.',
                        )
                      : t(
                          'Add shots to begin continuity checks.',
                          'הוסיפו שוטים כדי להתחיל בבדיקות רציפות.',
                        )}
                  </p>
                )}
              </section>
              <section className="panel">
                <h2>{t('Review queue', 'תור ביקורת')}</h2>
                <p>
                  {t(
                    'Approve intentionally. Nothing is automatically marked as good.',
                    'אשרו במכוון. שום דבר אינו מסומן כאיכותי אוטומטית.',
                  )}
                </p>
                {film.versions
                  .filter((v) => v.localPath && v.status !== 'rejected')
                  .map((v) => (
                    <button
                      className="review-row"
                      key={v.id}
                      onClick={() => {
                        openReview(v.id);
                      }}
                    >
                      <div>
                        <strong>
                          {film.shots.find((s) => s.id === v.shotId)?.code ||
                            'SOURCE'}{' '}
                          · {v.label} · {`v${versionNumber(v, [...film.versions, ...(film.archivedVersions || [])])}`}
                        </strong>
                        <small>
                          {
                            Object.values(v.checks || {}).filter(
                              (x) => x === 'pass' || x === 'na',
                            ).length
                          }{' '}
                          {t('checks completed', 'בדיקות הושלמו')} ·{' '}
                          {v.reviewBibleRevision !== film.bibleRevision
                            ? t('Review needed', 'נדרשת ביקורת')
                            : t('Current bible', 'ספר הפקה עדכני')}
                        </small>
                      </div>
                      <Status value={v.status} />
                    </button>
                  ))}
              </section>
            </div>
          )}
          {view === 'history' && (
            <section className="panel">
              <div className="panel-heading">
                <h2>
                  {history.length} {t('production decisions', 'החלטות הפקה')}
                </h2>
                <span className="mono">
                  {t('APPEND-ONLY RECORD', 'תיעוד מצטבר בלבד')}
                </span>
              </div>
              {history.map((e) => (
                <details className="event" key={e.id}>
                  <summary>
                    <span className="event-dot" />
                    <strong>
                      {e.action.replaceAll('.', ' / ').replaceAll('_', ' ')}
                    </strong>
                    <time>{new Date(e.at).toLocaleString()}</time>
                    <ChevronRight size={14} />
                  </summary>
                  <pre>{JSON.stringify(e.data, null, 2)}</pre>
                </details>
              ))}
            </section>
          )}
          {view === 'settings' && (
            <>
              <div className="two-column">
                <section className="panel">
                  <div className="panel-heading">
                    <h2>{t('Provider credentials', 'מפתחות לספקים')}</h2>
                    <Status
                      value={
                        status.falConfigured ? 'configured' : 'not_configured'
                      }
                    />
                  </div>
                  <p>
                    {t(
                      'Keys are available only to the production server. They are never added to films, exports, or browser data.',
                      'המפתחות זמינים רק לשרת ההפקה. הם לעולם לא נכללים בסרטים, בייצואים או בנתוני הדפדפן.',
                    )}
                  </p>
                  <CredentialManager
                    credentials={status.credentials || []}
                    mode={status.credentialMode || 'local'}
                    isHebrew={isHebrew}
                    t={t}
                    onChanged={async () => setStatus(await api('/status'))}
                  />
                  <a
                    className="text-button"
                    href="https://fal.ai/dashboard/keys"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t('Get a FAL key', 'קבלת מפתח FAL')}{' '}
                    <ArrowUpRight size={14} />
                  </a>
                  <div className="system-status">
                    <span>{t('Media renderer', 'מעבד מדיה')}</span>
                    <Status value={status.ffmpeg ? 'ready' : 'missing'} />
                  </div>
                </section>
                <section className="panel">
                  <h2>{t('Film settings', 'הגדרות הסרט')}</h2>
                  <TextForm
                    key={film.id}
                    initial={film}
                    fields={[
                      {
                        key: 'budget',
                        label: t(
                          'Generation budget (USD)',
                          'תקציב יצירה (USD)',
                        ),
                        type: 'number',
                      },
                      {
                        key: 'fps',
                        label: t('Export frame rate', 'קצב פריימים לייצוא'),
                        type: 'number',
                      },
                    ]}
                    onSave={(b) =>
                      action(base, { budget: b.budget, fps: b.fps }, 'PATCH')
                    }
                  >
                    <Field label={t('Frame aspect ratio', 'יחס מסך לפריים')}>
                      <Pick
                        label={t('Aspect ratio', 'יחס מסך')}
                        value={film.aspectRatio}
                        items={['16:9', '9:16', '1:1', '2.39:1'].map((v) => ({
                          value: v,
                          label: v,
                        }))}
                        onChange={(aspectRatio) =>
                          act(base, { aspectRatio }, 'PATCH')
                        }
                      />
                    </Field>
                  </TextForm>
                  <p className="small">
                    {t('Recorded estimates:', 'הערכות מתועדות:')} $
                    {spent.toFixed(2)}.{' '}
                    {
                      film.versions.filter(
                        (v) =>
                          v.source === 'generation' && v.estimatedCost == null,
                      ).length
                    }{' '}
                    {t(
                      'requests have unverified pricing. FAL billing remains the source of truth.',
                      'בקשות הן ללא תמחור מאומת. החיוב ב־FAL הוא מקור האמת.',
                    )}
                  </p>
                </section>
              </div>
              <h2 className="section-title">
                {t('Model library', 'ספריית מודלים')}{' '}
                <span>
                  FAL / {status.models.length} {t('adapters', 'מתאמים')}
                </span>
              </h2>
              <div className="model-grid">
                {status.models.map((m: Row) => (
                  <div className="model-card" key={m.id}>
                    <span className="eyebrow">{m.task}</span>
                    <h2>{m.name}</h2>
                    <p>{m.description}</p>
                    <div>
                      <span>
                        {m.pricing
                          ? m.pricing.unit === 'resolution-second'
                            ? Object.entries(m.pricing.rates)
                                .map(
                                  ([resolution, rate]) =>
                                    resolution + ': $' + rate + '/s',
                                )
                                .join(' · ')
                            : m.pricing.unit === 'second'
                              ? `$${m.pricing.silent}–$${m.pricing.audio} / second`
                              : m.pricing.unit === 'character'
                                ? '$0.10 / 1k characters'
                                : `$${m.pricing.rate} / generation`
                          : t('Check live pricing', 'בדיקת מחיר עדכני')}
                      </span>
                      <a
                        href={m.docs}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`${m.name} documentation`}
                      >
                        <ArrowUpRight size={16} />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
              {Array.isArray(status.providers) && status.providers.length > 0 && (
                <div className="panel catalog-panel provider-catalog-panel">
                  <div className="panel-heading">
                    <div>
                      <h3>{t('Additional providers', 'ספקים נוספים')}</h3>
                      <p className="small">
                        {t(
                          'Browse models from other providers. They are clearly marked until an adapter and API key are configured, so they cannot be submitted accidentally.',
                          'עיינו במודלים מספקים נוספים. הם מסומנים בבירור עד שמוגדרים מתאם ומפתח API, ולכן אי אפשר לשלוח אותם בטעות.',
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="catalog-grid">
                    {status.providers.flatMap((provider: Row) =>
                      (provider.models || []).map((m: Row) => (
                        <div className="model-card" key={`${provider.id}:${m.id}`}>
                          <span className="eyebrow">{provider.name} · {m.kind}</span>
                          <h4>{m.name}</h4>
                          <p>{(m.tasks || []).join(' · ')}{m.references?.length ? ` · ${t('references', 'רפרנסים')}: ${m.references.join(', ')}` : ''}</p>
                          <p className="small">{m.note || t('Adapter pending', 'מתאם בהמתנה')}</p>
                          <span className="status-muted">{t('Catalog only · not yet selectable', 'קטלוג בלבד · עדיין לא ניתן לבחירה')}</span>
                          <a href={provider.docs} target="_blank" rel="noreferrer">{t('Provider docs', 'תיעוד הספק')} <ArrowUpRight size={14} /></a>
                        </div>
                      )),
                    )}
                  </div>
                </div>
              )}
              <p className="small">
                {t(
                  'Published estimates verified September 6, 2026; actual billing can change. Provider adapters are isolated from the film record so more vendors can be added.',
                  'הערכות המחיר אומתו ב־6 בספטמבר 2026; החיוב בפועל עשוי להשתנות. מתאמי הספקים מופרדים מתיעוד הסרט ולכן אפשר להוסיף ספקים נוספים.',
                )}
              </p>
              <div className="panel catalog-panel">
                <div className="panel-heading">
                  <div>
                    <h3>{t('All active FAL endpoints', 'כל נקודות הקצה הפעילות של FAL')}</h3>
                    <p className="small">
                      {t(
                        'Browse the live FAL catalog. Endpoints with a verified adapter are selectable for generation; the rest are shown for discovery until their input schema is mapped.',
                        'עיינו בקטלוג החי של FAL. מודלים עם מתאם מאומת ניתנים לבחירה ליצירה; האחרים מוצגים לגילוי עד שממפים את סכמת הקלט שלהם.',
                      )}
                    </p>
                  </div>
                  <Button variant="outline" onClick={() => void loadFalCatalog()}>
                    <RefreshCw size={15} />{' '}
                    {falCatalog.length
                      ? t('Refresh catalog', 'רענון קטלוג')
                      : t('Load FAL catalog', 'טעינת קטלוג FAL')}
                  </Button>
                </div>
                {falCatalog.length > 0 && (
                  <div className="catalog-grid">
                    {falCatalog.map((m) => {
                      const adapter = status.models.find((a: Row) => a.id === m.id);
                      return (
                        <div className="model-card" key={m.id}>
                          <span className="eyebrow">{m.category}</span>
                          <h4>{m.name}</h4>
                          <p>{m.description || m.id}</p>
                          <span className={adapter ? 'status-ready' : 'status-muted'}>
                            {adapter
                              ? t('Ready in workflow', 'זמין בתהליך')
                              : t('Catalog only · adapter needed', 'קטלוג בלבד · נדרש מתאם')}
                          </span>
                          <a href={m.docs} target="_blank" rel="noreferrer">
                            {t('API details', 'פרטי API')} <ArrowUpRight size={14} />
                          </a>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>
      <input
        className="sr-only"
        type="file"
        ref={uploadRef}
        accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime,video/webm,audio/*"
        onChange={(e) =>
          e.target.files?.[0] && void importFile(e.target.files[0])
        }
      />
      {message && (
        <output className="toast">
          <Check size={16} />
          {message}
        </output>
      )}
      {error && (
        <div className="toast error" role="alert">
          <AlertTriangle size={16} />
          {error}
          <button aria-label="Dismiss error" onClick={() => setError('')}>
            ×
          </button>
        </div>
      )}
      {modal === 'film' && (
        <Modal
          title={t('New production', 'הפקה חדשה')}
          onClose={() => setModal('')}
          description={t(
            'A separate film with its own story, bible, media, and decisions.',
            'סרט נפרד עם סיפור, ספר הפקה, מדיה והחלטות משלו.',
          )}
        >
          <TextForm
            initial={{ title: '', logline: '' }}
            fields={[
              { key: 'title', label: t('Film title', 'שם הסרט') },
              {
                key: 'logline',
                label: t('What is your film about?', 'על מה הסרט?'),
                area: true,
              },
            ]}
            submit={t('Create film', 'יצירת סרט')}
            onSave={async (b) => {
              const f = await action('/films', b);
              await loadFilm(f.id);
              setModal('');
              setView('guided');
            }}
          />
        </Modal>
      )}
      {modal === 'scene' && (
        <Modal title={t('New scene', 'סצנה חדשה')} onClose={() => setModal('')}>
          <TextForm
            initial={{ title: '', summary: '' }}
            fields={[
              {
                key: 'title',
                label: t('Scene heading', 'כותרת סצנה'),
                hint: t(
                  'For example: EXT. COASTAL ROAD — DUSK',
                  'לדוגמה: חוץ. כביש החוף — דמדומים',
                ),
              },
              {
                key: 'summary',
                label: t('Story beat', 'מהלך סיפורי'),
                area: true,
              },
            ]}
            submit={t('Add scene', 'הוספת סצנה')}
            onSave={async (b) => {
              await action(`${base}/scenes`, b);
              setModal('');
            }}
          />
        </Modal>
      )}
      {modal.startsWith('editscene:') && (
        <Modal
          title={t('Edit scene', 'עריכת סצנה')}
          onClose={() => setModal('')}
        >
          <TextForm
            initial={
              film.scenes.find((s) => s.id === modal.split(':')[1]) || {}
            }
            fields={[
              { key: 'title', label: t('Scene heading', 'כותרת סצנה') },
              {
                key: 'summary',
                label: t('Story beat', 'מהלך סיפורי'),
                area: true,
              },
            ]}
            onSave={async (b) => {
              await action(`${base}/scenes/${modal.split(':')[1]}`, b, 'PATCH');
              setModal('');
            }}
          />
        </Modal>
      )}
      {modal === 'newshot' && (
        <Modal title={t('New shot', 'שוט חדש')} onClose={() => setModal('')}>
          <NewShot
            film={film}
            onSave={async (b) => {
              const f = await action(`${base}/shots`, b);
              setShotId(f.shots.at(-1).id);
              setShotTab('direction');
              setModal('shot');
            }}
          />
        </Modal>
      )}
      {modal === 'entity' && (
        <Modal
          title={
            entity
              ? t('Edit bible entry', 'עריכת רשומה בספר ההפקה')
              : t('Add to production bible', 'הוספה לספר ההפקה')
          }
          onClose={() => setModal('')}
          wide
        >
          <EntityEditor
            film={film}
            isHebrew={isHebrew}
            entity={entity ? film.entities.find(e => e.id === entity.id) || entity : null}
            onChanged={refresh}
            onReview={(id) => {openReview(id);}}
            onRevise={(id) => {
              const version = film.versions.find((v: Row) => v.id === id);
              const current = version?.entityId ? film.entities.find((e: Row) => e.id === version.entityId) : null;
              if (!version || !current) return;
              const usableReferences = (version.references || []).filter((rid: string) => {
                const ref = film.versions.find((candidate: Row) => candidate.id === rid);
                return !!ref?.localPath && !['failed', 'rejected'].includes(ref.status);
              });
              const base = version.assetBaseVersionId;
              const baseVersion = base ? film.versions.find((candidate: Row) => candidate.id === base) : null;
              setEntity(current);
              setRevision(version);
              setGenerationPreset({
                ...assetPreset(current, version.assetView || 'master', baseVersion?.localPath ? base : ''),
                revisionId: version.id,
                model: version.model,
                prompt: version.prompt || '',
                references: usableReferences,
                assetView: version.assetView || 'master',
                assetBaseVersionId: baseVersion?.localPath ? base : null,
              });
              setModal('entity-generator');
            }}
            onGenerate={
              entity
                ? (view, base) => {
                    setModal('entity-generator');
                    setGenerationPreset(assetPreset(entity, view, base));
                  }
                : undefined
            }
            onSave={async (b) => {
              await action(
                `${base}/entities${entity ? '/' + entity.id : ''}`,
                b,
                entity ? 'PATCH' : 'POST',
              );
              setModal('');
            }}
          />
        </Modal>
      )}
      {modal === 'entity-generator' && generationPreset?.entityId && (
        <Modal
          title={t('Identity image', 'תמונת זהות')}
          description={t(
            'Create a reusable reference image for this production-bible entry. Every version is saved and reviewable.',
            'צרו תמונת רפרנס לשימוש חוזר עבור הרשומה בספר ההפקה. כל גרסה נשמרת וניתנת לבדיקה.',
          )}
          wide
          onClose={() => {
            setEntity(film.entities.find(e => e.id === generationPreset.entityId) || null);
            setModal('entity');
          }}
        >
          <Generator
            key={`entity-${generationPreset.entityId}`}
            film={film}
            shot={{
              id: '',
              code: 'REF',
              title: film.entities.find((e) => e.id === generationPreset.entityId)?.name || 'Identity',
              prompt: generationPreset.prompt || '',
              camera: 'neutral identity sheet, front three-quarter view',
              lighting: 'soft even studio light',
              continuity: '',
              duration: 5,
              dialogue: '',
              entityIds: [generationPreset.entityId],
            }}
            models={status.models}
            revision={generationPreset?.revisionId ? revision : null}
            preset={generationPreset}
            assetEntityId={generationPreset.entityId}
            isHebrew={isHebrew}
            configured={status.falConfigured}
            onSubmit={async (b) => {
              await action(
                `${base}/generate`,
                b,
                'POST',
                t('Generation started. Progress appears in the asset gallery.', 'היצירה התחילה. ההתקדמות והתמונה יופיעו בגלריית הנכס.'),
              );
              setEntity(film.entities.find(e => e.id === generationPreset.entityId) || null);
              setModal('entity');
              setGenerationPreset(null);
            }}
          />
        </Modal>
      )}
      {modal === 'shot' && shot && (
        <Modal
          title={`${shot.code} / ${shot.title}`}
          description={t(
            'Direction, references, and every version of this shot.',
            'הכוונה, רפרנסים וכל גרסה של השוט הזה.',
          )}
          wide
          onClose={() => setModal('')}
        >
          <Tabs value={shotTab} onValueChange={(v) => setShotTab(String(v))}>
            <TabsList>
              <TabsTrigger value="direction">
                {t('Direction', 'הכוונה')}
              </TabsTrigger>
              <TabsTrigger value="generate">
                {t('Generate / revise', 'יצירה / תיקון')}
              </TabsTrigger>
              <TabsTrigger value="versions">
                {t('Versions', 'גרסאות')} (
                {film.versions.filter((v) => v.shotId === shot.id).length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="direction">
              <ShotEditor
                key={shot.id}
                shot={shot}
                film={film}
                onSave={(b) => action(`${base}/shots/${shot.id}`, b, 'PATCH')}
              />
            </TabsContent>
            <TabsContent value="generate">
              <Generator
                key={
                  shot.id +
                  (revision?.id || '') +
                  (generationPreset?.workflowTask || '') +
                  (generationPreset?.dialogueLineId || '')
                }
                film={film}
                shot={shot}
                models={status.models}
                revision={revision}
                preset={
                  view === 'guided' &&
                  !revision &&
                  generationPreset?.shotId === shot.id
                    ? generationPreset
                    : null
                }
                isHebrew={isHebrew}
                configured={status.falConfigured}
                onSubmit={async (b) => {
                  await action(
                    `${base}/generate`,
                    b,
                    'POST',
                    'Generation queued. This version will appear in the review queue.',
                  );
                  setShotTab('versions');
                }}
              />
            </TabsContent>
            <TabsContent value="versions">
              <div className="panel-heading">
                <p>
                  {t(
                    'Originals and generations are never overwritten.',
                    'מקור וגרסאות שנוצרו אינם נדרסים לעולם.',
                  )}
                </p>
                <Button variant="outline" onClick={() => importFor(shot.id)}>
                  <Upload /> {t('Import version', 'ייבוא גרסה')}
                </Button>
              </div>
              <div className="versions-grid">
                {film.versions
                  .filter((v) => v.shotId === shot.id)
                  .slice()
                  .reverse()
                  .map((v) => (
                    <div className="version-card" key={v.id}>
                      <div className="version-preview">
                        <Media version={v} controls />
                      </div>
                      <div className="version-info">
                        <div>
                          <strong>
                            {`v${versionNumber(v, [...film.versions, ...(film.archivedVersions || [])])}`}{' '}
                            <small>
                              {v.kind === 'video'
                                ? t('video', 'וידאו')
                                : v.kind === 'image'
                                  ? t('image', 'תמונה')
                                  : v.kind}{' '}
                              · {v.source}
                            </small>
                          </strong>
                          <Status value={v.status} />
                        </div>
                        <p>{v.label}</p>
                        {v.error && (
                          <p className="error">
                            {explainGenerationError(v.error, isHebrew)}
                          </p>
                        )}
                        <small>
                          {v.estimatedCost != null
                            ? `Est. $${v.estimatedCost.toFixed(2)}`
                            : ''}{' '}
                          · {new Date(v.createdAt).toLocaleString()}
                        </small>
                        <div className="row-actions">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!v.localPath}
                            onClick={() => {
                              openReview(v.id);
                            }}
                          >
                            Review
                          </Button>
                          <Button
                            variant={
                              shot.selectedVersionId === v.id
                                ? 'secondary'
                                : 'outline'
                            }
                            size="sm"
                            disabled={
                              !v.localPath ||
                              v.kind === 'audio' ||
                              v.status === 'rejected'
                            }
                            onClick={() =>
                              act(`${base}/shots/${shot.id}/select`, {
                                versionId: v.id,
                              })
                            }
                          >
                            {shot.selectedVersionId === v.id ? (
                              <Check size={14} />
                            ) : (
                              <FilmIcon size={14} />
                            )}{' '}
                            {shot.selectedVersionId === v.id
                              ? 'In cut'
                              : 'Use in cut'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setRevision(v);
                              setShotTab('generate');
                            }}
                          >
                            <RefreshCw size={14} /> Revise
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (
                                !window.confirm(
                                  t(
                                    'Move this version to the archive? You can restore it from Production history.',
                                    'להעביר לארכיון? אפשר לשחזר מתיעוד ההפקה.',
                                  ),
                                )
                              )
                                return;
                              void action(
                                `${base}/versions/${v.id}`,
                                undefined,
                                'DELETE',
                                t('Version archived', 'הגרסה הועברה לארכיון'),
                              );
                            }}
                          >
                            <Trash2 size={14} />{' '}
                            {t('Archive', 'ארכיון')}
                          </Button>
                        </div>
                        {v.status === 'submission_unknown' && (
                          <TextForm
                            initial={{ requestId: '' }}
                            fields={[
                              {
                                key: 'requestId',
                                label: 'FAL dashboard request ID',
                              },
                            ]}
                            submit="Recover request"
                            onSave={(b) =>
                              action(`${base}/versions/${v.id}/reconcile`, b)
                            }
                          />
                        )}
                      </div>
                    </div>
                  ))}
              </div>
              {!film.versions.some((v) => v.shotId === shot.id) && (
                <Empty
                  title={t('The first take is waiting', 'הטייק הראשון מחכה')}
                  text={t(
                    'Generate a storyboard, keyframe, video, or audio version. You can also import existing media.',
                    'צרו סטוריבורד, פריים מפתח, וידאו או אודיו. אפשר גם לייבא מדיה קיימת.',
                  )}
                />
              )}
            </TabsContent>
          </Tabs>
        </Modal>
      )}
      {modal === 'review' && version && (
        <Modal
          title={`${t('Review', 'ביקורת')} / ${version.label} · v${version.number}`}
          description={t(
            'Judge this specific version. Add a timecode or click the frame to locate a correction.',
            'בדקו את הגרסה הזאת. הוסיפו טיים־קוד או לחצו על הפריים כדי למקם תיקון.',
          )}
          wide
          onClose={() => setModal(reviewReturn.current)}
        >
          <Review
            film={film}
            isHebrew={isHebrew}
            version={version}
            checks={status.checks[version.kind] || []}
            onExtract={(b) => action(`${base}/versions/${version.id}/frame`, b)}
            onSave={(b) =>
              b.actualCost !== undefined
                ? action(`${base}/versions/${version.id}/cost`, b)
                : action(`${base}/versions/${version.id}`, b, 'PATCH')
            }
            onRevise={() => {
              void api(base)
                .then((latest) => {
                  if (version.entityId) {
                    setEntity(latest.entities.find((e: Row)=>e.id===version.entityId));
                    setRevision(latest.versions.find((v: Row)=>v.id===version.id));
                    setGenerationPreset({...assetPreset(latest.entities.find((e: Row)=>e.id===version.entityId)), revisionId:version.id});
                    setModal('entity-generator');
                    return;
                  }
                  setShotId(version.shotId);
                  setRevision(
                    latest.versions.find((v: Row) => v.id === version.id),
                  );
                  setGenerationPreset(null);
                  setShotTab('generate');
                  setModal('shot');
                })
                .catch((e) => setError(e.message));
            }}
          />
        </Modal>
      )}
    </SidebarProvider>
  );
}
function CredentialManager({
  credentials,
  mode,
  isHebrew,
  t,
  onChanged,
}: {
  credentials: Row[];
  mode: string;
  isHebrew: boolean;
  t: (english: string, hebrew: string) => string;
  onChanged: () => Promise<void>;
}) {
  const [label, setLabel] = useState('FAL'),
    [envName, setEnvName] = useState('FAL_KEY'),
    [secretValue, setSecretValue] = useState(''),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const sourceLabel: Record<string, string> = isHebrew
    ? {
        'macos-keychain': 'צרור המפתחות של macOS',
        environment: 'משתנה סביבה מקומי',
        'remote-environment': 'משתנה סביבה מרוחק',
        'not-configured': 'לא מוגדר',
      }
    : {
        'macos-keychain': 'macOS Keychain',
        environment: 'Local environment',
        'remote-environment': 'Remote environment',
        'not-configured': 'Not configured',
      };
  async function save(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await api('/credentials', { label, envName, secret: secretValue });
      setSecretValue('');
      await onChanged();
      setNotice(
        t(
          'Credential saved to macOS Keychain.',
          'המפתח נשמר בצרור המפתחות של macOS.',
        ),
      );
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function remove(envName: string) {
    if (
      !confirm(
        t(
          `Remove ${envName} from Frameforge Keychain?`,
          `להסיר את ${envName} מצרור המפתחות של Frameforge?`,
        ),
      )
    )
      return;
    setError('');
    try {
      await api(`/credentials/${envName}`, undefined, 'DELETE');
      await onChanged();
      setNotice(
        t('Credential removed from Keychain.', 'המפתח הוסר מצרור המפתחות.'),
      );
    } catch (error) {
      setError((error as Error).message);
    }
  }
  return (
    <div className="credential-manager">
      <div className="credential-list">
        {credentials.map((credential) => (
          <div className="credential-row" key={credential.envName}>
            <div>
              <strong>{credential.label}</strong>
              <small>{credential.envName}</small>
            </div>
            <span>{sourceLabel[credential.source] || credential.source}</span>
            <Status
              value={credential.configured ? 'configured' : 'not_configured'}
            />
            {mode === 'local' && credential.source === 'macos-keychain' && (
              <Button
                variant="ghost"
                size="icon"
                aria-label={t(
                  `Remove ${credential.label}`,
                  `הסרת ${credential.label}`,
                )}
                onClick={() => void remove(credential.envName)}
              >
                <Trash2 />
              </Button>
            )}
          </div>
        ))}
      </div>
      {mode === 'local' ? (
        <form
          className="credential-form"
          onSubmit={(event) => void save(event)}
        >
          <h3>
            {t('Add or replace a provider key', 'הוספה או החלפה של מפתח ספק')}
          </h3>
          <Field label={t('Provider name', 'שם הספק')}>
            <Input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="FAL, OpenAI, Runway…"
            />
          </Field>
          <Field
            label={t('Environment variable', 'שם משתנה הסביבה')}
            hint={t(
              'Use uppercase letters, numbers, and underscores. For example: OPENAI_API_KEY.',
              'השתמשו באותיות גדולות באנגלית, ספרות וקווים תחתיים. לדוגמה: OPENAI_API_KEY.',
            )}
          >
            <Input
              value={envName}
              onChange={(event) => setEnvName(event.target.value.toUpperCase())}
              spellCheck={false}
            />
          </Field>
          <Field label={t('Secret key', 'מפתח סודי')}>
            <Input
              type="password"
              autoComplete="new-password"
              value={secretValue}
              onChange={(event) => setSecretValue(event.target.value)}
            />
          </Field>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {notice && <p className="credential-notice">{notice}</p>}
          <Button disabled={saving || !secretValue} type="submit">
            {saving ? <LoaderCircle className="spin" /> : <LockKeyhole />}
            {t('Save securely', 'שמירה מאובטחת')}
          </Button>
        </form>
      ) : (
        <div className="credential-remote-note">
          <LockKeyhole />
          <p>
            {t(
              'This is a remote server. Set secrets in the host environment, then restart the service. Add comma-separated variable names to FRAMEFORGE_CREDENTIALS so they appear here.',
              'זהו שרת מרוחק. הגדירו את המפתחות בהגדרות הסודות של השרת, ואז הפעילו את השירות מחדש. הוסיפו שמות משתנים מופרדים בפסיקים ל־FRAMEFORGE_CREDENTIALS כדי שיופיעו כאן.',
            )}
          </p>
        </div>
      )}
    </div>
  );
}

function NewShot({
  film,
  onSave,
}: {
  film: Film;
  onSave: (b: Row) => Promise<unknown>;
}) {
  const [scene, setScene] = useState(film.scenes[0]?.id || '');
  return (
    <TextForm
      initial={{ title: '', prompt: '', duration: 5 }}
      fields={[
        { key: 'title', label: 'Shot title' },
        { key: 'prompt', label: 'What happens in the frame?', area: true },
        {
          key: 'duration',
          label: 'Planned duration (seconds)',
          type: 'number',
        },
      ]}
      submit="Create shot"
      onSave={(b) => onSave({ ...b, sceneId: scene })}
    >
      <Field label="Scene">
        <Pick
          value={scene}
          onChange={setScene}
          label="Scene"
          items={[
            { value: '', label: 'Unassigned' },
            ...film.scenes.map((s) => ({ value: s.id, label: s.title })),
          ]}
        />
      </Field>
    </TextForm>
  );
}
function ShotEditor({
  shot,
  film,
  onSave,
}: {
  shot: Row;
  film: Film;
  onSave: (b: Row) => Promise<unknown>;
}) {
  const [refs, setRefs] = useState<string[]>(shot.entityIds || []),
    [assetRefs, setAssetRefs] = useState<string[]>(
      shot.referenceVersionIds || [],
    ),
    [scene, setScene] = useState(shot.sceneId);
  return (
    <TextForm
      initial={shot}
      fields={[
        { key: 'title', label: 'Shot title' },
        { key: 'prompt', label: 'Action & creative direction', area: true },
        { key: 'camera', label: 'Camera & lens' },
        { key: 'lighting', label: 'Lighting & time of day' },
        { key: 'continuity', label: 'Continuity requirements', area: true },
        { key: 'dialogue', label: 'Dialogue & performance', area: true },
        {
          key: 'duration',
          label: 'Planned duration (seconds)',
          type: 'number',
        },
      ]}
      onSave={(b) =>
        onSave({
          ...b,
          sceneId: scene,
          entityIds: refs,
          referenceVersionIds: assetRefs,
        })
      }
    >
      <Field label="Scene">
        <Pick
          value={scene}
          onChange={setScene}
          label="Scene"
          items={[
            { value: '', label: 'Unassigned' },
            ...film.scenes.map((s) => ({ value: s.id, label: s.title })),
          ]}
        />
      </Field>
      <div>
        <div className="field-label">Linked production bible</div>
        <div className="reference-picks">
          {film.entities.map((e) => (
            <Toggle
              key={e.id}
              checked={refs.includes(e.id)}
              onChange={(c) =>
                setRefs(c ? [...refs, e.id] : refs.filter((id) => id !== e.id))
              }
            >
              {e.name} {e.locked ? '· locked' : '· draft'}
            </Toggle>
          ))}
        </div>
        {!film.entities.length && (
          <p>
            Create characters, locations, and props in the production bible to
            attach them here.
          </p>
        )}
      </div>
      <div>
        <div className="field-label">
          רפרנסים לשוט <small>({assetRefs.length})</small>
        </div>
        <p className="small">
          בחרו תמונות לוקיישן, אביזרים, פריימים וסגנון. אפשר לבחור כמה שרוצים;
          הם יועברו אוטומטית לכל יצירת תמונה או וידאו של השוט.
        </p>
        <div className="reference-picks">
          {film.versions
            .filter((v) => v.localPath && v.status !== 'rejected')
            .map((v) => (
              <Toggle
                key={v.id}
                checked={assetRefs.includes(v.id)}
                onChange={(checked) =>
                  setAssetRefs(
                    checked
                      ? [...assetRefs, v.id]
                      : assetRefs.filter((id) => id !== v.id),
                  )
                }
              >
                {film.entities.find((e) => e.id === v.entityId)?.name ||
                  film.shots.find((s) => s.id === v.shotId)?.code ||
                  'Film'}{' '}
                · {v.label} · {v.kind}
              </Toggle>
            ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            onSave({
              title: shot.title,
              prompt: shot.prompt,
              sceneId: scene,
              entityIds: refs,
              referenceVersionIds: assetRefs,
            })
          }
        >
          + שמירת רפרנסים לשוט
        </Button>
      </div>
    </TextForm>
  );
}
function EntityEditor({
  film,
  entity,
  onGenerate,
  isHebrew,
  onSave,
  onChanged,
  onReview,
  onRevise,
}: {
  onChanged: () => Promise<unknown>;
  onReview: (id: string) => void;
  onRevise?: (id: string) => void;
  isHebrew: boolean;
  film: Film;
  entity: Row | null;
  onGenerate?: (view: string, base: string) => void;
  onSave: (b: Row) => Promise<unknown>;
}) {
  const t = (en: string, he: string) => isHebrew ? he : en;
  const [type, setType] = useState(entity?.type || 'character'),
    [locked, setLocked] = useState(!!entity?.locked),
    [refs, setRefs] = useState<string[]>(entity?.referenceVersionIds || []);
  return (<>
    {entity && onGenerate && <AssetViewBuilder film={film} entity={entity} hebrew={isHebrew} onGenerate={onGenerate} />}
    {entity && <VersionLibrary film={film} entityId={entity.id} onChanged={onChanged} onReview={onReview} onRevise={onRevise} hebrew={isHebrew} />}
    <details open={!entity}><summary>{t('Edit asset definition & linked references', 'עריכת פרטי הנכס והרפרנסים המקושרים')}</summary>
    <TextForm
      initial={entity || { name: '', description: '', continuity: '' }}
      fields={[
        { key: 'name', label: t('Name', 'שם') },
        {
          key: 'description',
          label: t('Canonical description', 'תיאור קבוע של הנכס'),
          area: true,
          hint: 'Identity, age, facial features, proportions, wardrobe, voice, or the defining features of a location / prop.',
        },
        {
          key: 'continuity',
          label: t('Continuity rules', 'כללי רציפות'),
          area: true,
          hint: 'What must remain identical? Note handedness, object orientation, color, lighting, and camera rules.',
        },
      ]}
      onSave={(b) => onSave({ ...b, type, locked, referenceVersionIds: refs })}
    >
      <Field label={t('Category', 'סוג נכס')}>
        <Pick
          value={type}
          onChange={setType}
          label={t('Category', 'סוג נכס')}
          items={['character', 'location', 'prop', 'style', 'voice'].map(
            (value) => ({ value, label: value }),
          )}
        />
      </Field>
      <Toggle checked={locked} onChange={setLocked}>
        {t('Lock as the approved canonical definition', 'נעילת ההגדרה המאושרת של הנכס')}
      </Toggle>
      <div>
        <div className="field-label">{t('Linked references', 'רפרנסים מקושרים')}</div>
        {film.versions
          .filter((v) => v.localPath && v.status !== 'rejected')
          .map((v) => (
            <Toggle
              key={v.id}
              checked={refs.includes(v.id)}
              onChange={(c) =>
                setRefs(c ? [...refs, v.id] : refs.filter((id) => id !== v.id))
              }
            >
              {film.shots.find((s) => s.id === v.shotId)?.code ||
                film.entities.find((e) => e.id === v.entityId)?.name ||
                'Film'} ·{' '}
              {v.label} · {`v${versionNumber(v, [...film.versions, ...(film.archivedVersions || [])])}`} · {v.kind}
            </Toggle>
          ))}
      </div>
    </TextForm></details></>
  );
}
function Generator({
  film,
  shot,
  models,
  revision,
  preset,
  assetEntityId,
  isHebrew,
  configured,
  onSubmit,
}: {
  film: Film;
  shot: Row;
  models: Row[];
  revision: Row | null;
  preset?: Row | null;
  assetEntityId?: string | null;
  isHebrew: boolean;
  configured: boolean;
  onSubmit: (b: Row) => Promise<unknown>;
}) {
  const assetBase = revision?.assetBaseVersionId || preset?.assetBaseVersionId;
  const revisionModelTask = models.find((candidate) => candidate.id === revision?.model)?.task;
  const initialWorkflowTask =
    preset?.workflowTask ||
    revision?.workflowTask ||
    (revisionModelTask === 'Lip-sync'
      ? 'lipsync'
      : revisionModelTask === 'Dialogue / voice'
        ? 'dialogue'
        : revision?.kind === 'video'
      ? 'video'
      : revision?.kind === 'audio'
        ? 'sfx'
          : revision?.kind === 'image'
            ? 'keyframe'
            : undefined);
  const initialReferences = [
    ...new Set<string>([
      ...(revision
        ? revision.model?.includes('flux') && revision.localPath && !['failed', 'rejected'].includes(revision.status)
          ? [revision.id]
          : (revision.references || []).filter((rid: string) => {
              const ref = film.versions.find((candidate: Row) => candidate.id === rid);
              return !!ref?.localPath && !['failed', 'rejected'].includes(ref.status);
            })
        : [...(preset?.references || []), ...(shot.referenceVersionIds || [])]),
      ...(assetBase ? [assetBase] : []),
      ...(!preset && !revision ? shot.entityIds : []).flatMap(
        (id: string) =>
          film.entities.find((e) => e.id === id)?.referenceVersionIds || [],
      ),
    ]),
  ];
  const modelAcceptsInitialReferences = (candidate: Row) =>
    initialReferences.every((id) => {
      const ref = film.versions.find((v) => v.id === id);
      if (!ref) return true;
      const fields = ref.kind === 'image'
        ? ['image_urls', 'image_url', 'start_image_url']
        : ref.kind === 'video'
          ? ['video_urls', 'video_url']
          : ref.kind === 'audio'
            ? ['audio_urls', 'audio_url'] : [];
      return !fields.length || candidate.fields?.some((field: string) => fields.includes(field));
    });
  const modelMatchesWorkflow = (candidate: Row) =>
    (!assetBase || candidate.fields?.some((field: string)=>['image_urls','image_url'].includes(field))) &&
    (!initialWorkflowTask ||
    (initialWorkflowTask === 'keyframe'
      ? candidate.kind === 'image'
      : candidate.task ===
        (
          {
            dialogue: 'Dialogue / voice',
            video: 'Video',
            lipsync: 'Lip-sync',
            sfx: 'Music / sound effects',
            music: 'Music / sound effects',
          } as Row
        )[initialWorkflowTask]));
  const [modelId, setModelId] = useState(
      models.find(
        (m) =>
          modelMatchesWorkflow(m) && modelAcceptsInitialReferences(m) &&
          m.id ===
          (revision?.kind === 'image' && revision?.model === 'fal-ai/flux-2'
            ? 'fal-ai/flux-2/edit'
            : revision?.model || preset?.model),
      )?.id ||
        models.find((m) => modelMatchesWorkflow(m) && modelAcceptsInitialReferences(m))?.id ||
        models.find(modelMatchesWorkflow)?.id ||
        models[0]?.id ||
        '',
    ),
    [prompt, setPrompt] = useState(
      revision?.prompt ?? preset?.prompt ?? shot.prompt ?? '',
    ),
    [correction, setCorrection] = useState(
      revision?.notes
        ?.filter((n: Row) => !n.resolved)
        .map((n: Row) => `${n.time != null ? `At ${n.time}s: ` : ''}${n.text}`)
        .join('\n') || '',
    ),
    [refs, setRefs] = useState<string[]>(initialReferences),
    [options, setOptions] = useState<Row>({
      duration: '5',
      generate_audio: false,
      seconds_total: 30,
      voice: 'Rachel',
      language_code: isHebrew ? 'he' : 'en',
      ...revision?.input,
      ...preset?.options,
    }),
    [staged, setStaged] = useState<Row | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [unknown, setUnknown] = useState(false),
    [modelSearch, setModelSearch] = useState(''),
    [referencePreview, setReferencePreview] = useState<Row | null>(null);
  const model = models.find((m) => m.id === modelId);
  const t = (en: string, he: string) => (isHebrew ? he : en);
  const workflowTask = initialWorkflowTask;
  const supportsReference = (v: Row) =>
    Boolean(
      model &&
        ((v.kind === 'image' &&
          (model.fields.includes('image_urls') ||
            model.fields.includes('image_url') ||
            model.fields.includes('start_image_url'))) ||
          (v.kind === 'video' &&
            (model.fields.includes('video_urls') ||
              model.fields.includes('video_url'))) ||
          (v.kind === 'audio' &&
            (model.fields.includes('audio_urls') ||
              model.fields.includes('audio_url')))),
    );
  const incompatibleReferences = refs.some(
    (id) => !supportsReference(film.versions.find((v) => v.id === id) || {}),
  );
  const availableModels = models.filter(modelMatchesWorkflow);
  const recommended = [...availableModels].sort((a, b) => {
    const score = (m: Row) => {
      let n = 0;
      if (
        workflowTask === 'video' &&
        refs.length &&
        m.recommendation === 'fast-consistent'
      )
        n += 5;
      if (
        workflowTask === 'video' &&
        options.generate_audio &&
        m.capabilities?.nativeAudio
      )
        n += 2;
      if (
        workflowTask === 'video' &&
        !refs.length &&
        m.recommendation === 'fast-exploration'
      )
        n += 3;
      if (workflowTask === 'keyframe' && refs.length && m.id.includes('/edit'))
        n += 5;
      return n;
    };
    return score(b) - score(a);
  });
  const recommendedModel = recommended[0];
  const body = {
    shotId: assetEntityId ? '' : shot.id,
    entityId: assetEntityId || null,
    assetView: revision?.assetView || preset?.assetView || null,
    assetBaseVersionId: assetBase || null,
    model: modelId,
    prompt,
    correction,
    references: refs,
    options,
    parentVersionId: revision?.id || null,
    workflowTask: initialWorkflowTask || null,
    dialogueLineId: preset?.dialogueLineId || revision?.dialogueLineId || null,
    audioRole: preset?.audioRole || revision?.audioRole || null,
  };
  useEffect(() => {
    setStaged(null);
    setUnknown(false);
  }, [modelId, prompt, correction, refs, options]);
  async function stage() {
    setBusy(true);
    setError('');
    try {
      const result = await api(`/films/${film.id}/preview`, body);
      setStaged({
        ...result,
        body: structuredClone(body),
        idempotencyKey: crypto.randomUUID(),
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="generator">
      <div className="generation-intro">
        <GitBranch />
        <p>
          {revision
            ? t(
                `Revision of v${revision.number}. The original stays in history.`,
                `תיקון לגרסה ${revision.number}. המקור נשמר בהיסטוריה.`,
              )
            : t(
                'Create one take. Direction and references are recorded with the result.',
                'יוצרים גרסה אחת. ההנחיות והרפרנסים נשמרים יחד עם התוצאה.',
              )}
        </p>
      </div>
      <Field label={t('Search models / tasks', 'חיפוש מודלים / משימות')}>
        <Input
          value={modelSearch}
          onChange={(e) => setModelSearch(e.target.value)}
          placeholder={t(
            'Video, image, voice, Seedance…',
            'וידאו, תמונה, דיבור, Seedance…',
          )}
        />
      </Field>
      <Field label={t('Model / task', 'מודל / משימה')}>
        <Pick
          value={modelId}
          onChange={(v) => {
            setModelId(v);
            setRefs([]);
            setOptions({
              ...models.find((m) => m.id === v)?.defaults,
              language_code: isHebrew ? 'he' : 'en',
            });
            if (
              models.find((m) => m.id === v)?.task === 'Dialogue / voice' &&
              shot.dialogue
            )
              setPrompt(shot.dialogueLines?.[0]?.text || shot.dialogue);
          }}
          label="Generation model"
          items={recommended
            .filter(
              (m) =>
                !modelSearch ||
                [
                  m.name,
                  m.task,
                  m.provider,
                  (
                    {
                      image: 'תמונה',
                      video: 'וידאו',
                      audio: 'סאונד דיבור מוזיקה',
                    } as Row
                  )[m.kind],
                ]
                  .join(' ')
                  .toLowerCase()
                  .includes(modelSearch.toLowerCase()),
            )
            .map((m) => ({
              value: m.id,
              label: `${m.id === recommendedModel?.id ? '★ ' + t('Recommended · ', 'מומלץ · ') : ''}${m.name} — ${m.task}`,
            }))}
        />
      </Field>
      <p className="small">{model?.description}</p>
      {recommendedModel && recommendedModel.id === model?.id && (
        <p className="model-recommendation" role="status">
          ★{' '}
          {t(
            'Recommended for this task and current references. You can still choose any compatible model.',
            'מומלץ למשימה הזו ולרפרנסים הנוכחיים. עדיין אפשר לבחור כל מודל תואם.',
          )}
        </p>
      )}
      <Field
        label={
          model?.kind === 'audio'
            ? t(
                'Exact spoken words / sound direction',
                'מילים מדויקות לדיבור / הנחיות סאונד',
              )
            : t('Creative prompt', 'הנחיות יצירה')
        }
      >
        <Textarea
          rows={5}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
      </Field>
      <Field
        label={t('Correction notes for this version', 'הערות תיקון לגרסה הזו')}
      >
        <Textarea
          rows={3}
          value={correction}
          onChange={(e) => setCorrection(e.target.value)}
          placeholder={t(
            'Describe exactly what needs changing…',
            'תארו בדיוק מה צריך לשנות…',
          )}
        />
      </Field>
      <div className="generation-options">
        {model?.task === 'Video' && (
          <>
            <Field label="Generated duration">
              <Pick
                value={String(options.duration)}
                onChange={(duration) => setOptions({ ...options, duration })}
                label="Duration"
                items={(model.capabilities?.durations || ['5', '10']).map(
                  (value: string) => ({
                    value,
                    label: value + t(' seconds', ' שניות'),
                  }),
                )}
              />
            </Field>
            {model.capabilities?.resolutions && (
              <Field label={t('Resolution', 'רזולוציה')}>
                <Pick
                  label="Resolution"
                  value={options.resolution || model.defaults.resolution}
                  onChange={(resolution) =>
                    setOptions({ ...options, resolution })
                  }
                  items={model.capabilities.resolutions.map(
                    (value: string) => ({ value, label: value }),
                  )}
                />
              </Field>
            )}
            {model.capabilities?.bitrateModes && (
              <Field label={t('Encoding quality', 'איכות קידוד')}>
                <Pick
                  label="Encoding quality"
                  value={options.bitrate_mode || 'standard'}
                  onChange={(bitrate_mode) =>
                    setOptions({ ...options, bitrate_mode })
                  }
                  items={[
                    { value: 'standard', label: t('Standard', 'רגילה') },
                    { value: 'high', label: t('High', 'גבוהה') },
                  ]}
                />
              </Field>
            )}
            <Toggle
              checked={options.generate_audio}
              onChange={(generate_audio) =>
                setOptions({ ...options, generate_audio })
              }
            >
              {t('Generate native sound', 'יצירת סאונד מובנה בווידאו')}
            </Toggle>
          </>
        )}
        {model?.task === 'Dialogue / voice' && (
          <>
            <Field label={t('Voice name / ID', 'שם קול / מזהה')}>
              <Input
                value={options.voice}
                onChange={(e) =>
                  setOptions({ ...options, voice: e.target.value })
                }
              />
            </Field>
            <Field label={t('Speech language', 'שפת הדיבור')}>
              <Pick
                value={options.language_code || 'he'}
                onChange={(language_code) =>
                  setOptions({ ...options, language_code })
                }
                label={t('Speech language', 'שפת הדיבור')}
                items={[
                  { value: 'he', label: 'עברית' },
                  { value: 'en', label: 'English' },
                  { value: 'ar', label: 'العربية' },
                ]}
              />
            </Field>
            <p className="small">
              {t(
                'The text field is spoken exactly as written. Keep only one speaker and remove names / directions. For pronunciation corrections, edit the spoken text; notes are archived separately.',
                'שדה הטקסט מוקרא כפי שנכתב. השאירו דובר אחד והסירו שמות והוראות במה. לתיקון הגייה, ערכו את הטקסט המוקרא; הערות התיקון נשמרות בנפרד.',
              )}
            </p>
          </>
        )}
        {model?.task === 'Music / sound effects' && (
          <Field label="Audio duration (1–190s)">
            <Input
              type="number"
              min="1"
              max="190"
              value={options.seconds_total}
              onChange={(e) =>
                setOptions({
                  ...options,
                  seconds_total: Number(e.target.value),
                })
              }
            />
          </Field>
        )}
        {model?.kind === 'image' && (
          <>
            <Field label={t('Seed (optional)', 'Seed (אופציונלי)')}>
              <Input
                type="number"
                value={options.seed ?? ''}
                onChange={(e) =>
                  setOptions({ ...options, seed: e.target.value })
                }
              />
            </Field>
            {model.id.includes('qwen') && (
              <Field
                label={t(
                  'Negative prompt · what to exclude',
                  'Negative prompt · מה לא לכלול',
                )}
              >
                <Textarea
                  rows={3}
                  value={options.negative_prompt || ''}
                  onChange={(e) =>
                    setOptions({ ...options, negative_prompt: e.target.value })
                  }
                  placeholder={t(
                    'text, logos, extra subjects, duplicate limbs…',
                    'טקסט, לוגו, נושאים נוספים, איברים כפולים…',
                  )}
                />
              </Field>
            )}
          </>
        )}
      </div>
      <div>
        <div className="field-label">{t('Generation references', 'רפרנסים ליצירה')}</div>
        <p className="small">
          {assetEntityId ? t('Choose reference images of this asset. The approved source is selected for additional views.', 'בחרו תמונות רפרנס של הנכס הזה. בזוויות נוספות תמונת המקור המאושרת כבר מסומנת.') : t(
            'Choose start then optional end image for image-to-video; up to four images for FLUX Edit; video and audio for lip-sync. Seedance 2.0 Mini Reference accepts up to 9 images, 3 videos and 3 audio references. Text-to-video accepts no references.',
            'בחרו תמונת התחלה ואז תמונת סיום לווידאו מתמונה; עד ארבע תמונות ל־FLUX Edit; וידאו ואודיו לסנכרון שפתיים. Seedance 2.0 Mini Reference מקבל עד 9 תמונות, 3 סרטונים ו־3 קבצי אודיו. וידאו מטקסט אינו מקבל רפרנסים.',
          )}
        </p>
        <div className="reference-picks">
          {film.versions
            .filter((v) => v.localPath && v.status !== 'rejected' &&
              (!assetEntityId || (v.kind === 'image' && (v.entityId === assetEntityId || (!v.entityId && v.source === 'import')))))
            .map((v) => (
              <div className="reference-option" key={v.id}>
                <button
                  type="button"
                  className="reference-thumb"
                  onClick={() => setReferencePreview(v)}
                  aria-label={t('Enlarge reference', 'הגדלת רפרנס')}
                >
                  <Media version={v} />
                </button>
                <Toggle
                  checked={refs.includes(v.id)}
                  onChange={(c) =>
                    setRefs(
                      c ? [...refs, v.id] : refs.filter((id) => id !== v.id),
                    )
                  }
                >
                  {film.shots.find((s) => s.id === v.shotId)?.code ||
                    film.entities.find((e) => e.id === v.entityId)?.name ||
                    'Film'}{' '}
                  · {v.label} · {`v${versionNumber(v, [...film.versions, ...(film.archivedVersions || [])])}`} · {v.kind}
                </Toggle>
              </div>
            ))}
        </div>
      </div>
      {referencePreview && (
        <div
          className="reference-lightbox"
          role="dialog"
          aria-label={t('Reference preview', 'תצוגת רפרנס')}
          onClick={() => setReferencePreview(null)}
        >
          <div onClick={(event) => event.stopPropagation()}>
            <Button
              variant="outline"
              onClick={() => setReferencePreview(null)}
            >
              {t('Close', 'סגירה')}
            </Button>
            <Media version={referencePreview} controls />
            <p>{referencePreview.label} · v{referencePreview.number}</p>
          </div>
        </div>
      )}
      {model?.id === 'fal-ai/flux-2' && refs.length > 0 && (
        <p className="notice">
          FLUX.2 text-to-image does not consume reference images. Choose FLUX.2
          Edit to use visual references.
        </p>
      )}
      {incompatibleReferences && (
        <p className="error" role="alert">
          {t(
            'The selected model cannot use all selected references. Choose a reference-to-video model or remove the incompatible references.',
            'המודל שנבחר אינו מקבל את כל הרפרנסים שסומנו. בחרו reference-to-video או הסירו את הרפרנסים שאינם תואמים.',
          )}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <Button
        variant="outline"
        onClick={() => void stage()}
        disabled={busy || !prompt.trim() || incompatibleReferences}
      >
        {busy ? <LoaderCircle className="spin" /> : <Settings2 />}{' '}
        {t('Preview request & cost', 'בדיקת הבקשה והעלות')}
      </Button>
      {staged && (
        <div className="request-preview">
          <div className="panel-heading">
            <strong>
              {t('Ready for one new version', 'מוכן ליצירת גרסה אחת')}
            </strong>
            <span>
              {staged.estimate == null
                ? t('Cost unverified', 'המחיר אינו מאומת')
                : `Estimated $${staged.estimate.toFixed(3)}`}
            </span>
          </div>
          <details>
            <summary>Prompt, model input & reference snapshot</summary>
            <pre>
              {JSON.stringify(
                { input: staged.input, context: staged.context },
                null,
                2,
              )}
            </pre>
          </details>
          {staged.estimate == null && (
            <Toggle checked={unknown} onChange={setUnknown}>
              {t(
                'I checked FAL pricing and accept the model’s current charge.',
                'בדקתי את המחיר ב־Fal ואני מאשר/ת את החיוב הנוכחי של המודל.',
              )}
            </Toggle>
          )}
          <Button
            disabled={
              busy || !configured || (staged.estimate == null && !unknown)
            }
            onClick={async () => {
              setBusy(true);
              setError('');
              try {
                await onSubmit({
                  ...staged.body,
                  idempotencyKey: staged.idempotencyKey,
                  confirmCost: true,
                  expectedRevision: staged.filmRevision,
                  acceptUnknownCost: unknown,
                });
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Plus /> {t('Generate this version', 'יצירת הגרסה הזו')}
          </Button>
          {!configured && (
            <p className="notice">
              Add a FAL key in Models & settings to generate.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
function Review({
  onExtract,
  film,
  isHebrew,
  version,
  checks,
  onSave,
  onRevise,
}: {
  film: Film;
  isHebrew: boolean;
  version: Row;
  checks: string[];
  onExtract: (b: Row) => Promise<unknown>;
  onSave: (b: Row) => Promise<unknown>;
  onRevise: () => void;
}) {
  const t = (en: string, he: string) => (isHebrew ? he : en);
  const shot = film.shots.find((candidate) => candidate.id === version.shotId);
  const [note, setNote] = useState(''),
    [time, setTime] = useState(''),
    [point, setPoint] = useState<Row | null>(null),
    [compare, setCompare] = useState(''),
    [extracting, setExtracting] = useState(false),
    [frameNotice, setFrameNotice] = useState(''),
    [error, setError] = useState('');
  const video = useRef<HTMLVideoElement>(null);
  const save = async (b: Row) => {
    try {
      await onSave(b);
      setError('');
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  };
  return (
    <div className="review-layout">
      <div>
        <div className="review-media">
          {version.kind === 'video' ? (
            <video ref={video} src={media(version)} controls />
          ) : (
            <Media version={version} controls />
          )}
          {version.kind !== 'audio' && (
            <button
              className="annotation-target"
              aria-label="Place a correction marker on the frame (Enter places it in the center)"
              onClick={(e) => {
                const r =
                  e.currentTarget.parentElement!.getBoundingClientRect();
                setPoint({
                  x: e.detail ? (e.clientX - r.left) / r.width : 0.5,
                  y: e.detail ? (e.clientY - r.top) / r.height : 0.5,
                });
                if (video.current)
                  setTime(video.current.currentTime.toFixed(2));
              }}
            />
          )}
          {point && (
            <span
              className="annotation-pin"
              style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
            >
              +
            </span>
          )}
        </div>
        {shot && (version.kind === 'video' || version.kind === 'audio') && (
          <div className="notice" aria-label={t('Approved script target', 'יעד התסריט המאושר')}>
            <strong>{t('Compare against the approved script', 'השוואה לתסריט המאושר')}</strong>
            <p>
              <b>{t('Required action:', 'הפעולה שחייבת להופיע:')}</b>{' '}
              {shot.prompt || shot.action || t('No action recorded', 'לא הוגדרה פעולה')}
            </p>
            <p>
              <b>{t('Exact spoken words:', 'המילים המדויקות שחייבות להישמע:')}</b>{' '}
              {shot.dialogue || t('No dialogue', 'ללא דיאלוג')}
            </p>
          </div>
        )}
        <div className="review-meta">
          <Status value={version.status} />
          <span>
            {version.width
              ? `${version.width} × ${version.height}`
              : version.kind}{' '}
            · {version.duration ? `${version.duration.toFixed(1)}s` : ''}
          </span>
          <a
            href={media(version)}
            target="_blank"
            rel="noreferrer"
            className="text-button"
          >
            Open original <ArrowUpRight size={14} />
          </a>
        </div>

        {version.kind === 'video' && (
          <div>
            <Button
              disabled={extracting}
              onClick={async () => {
                setExtracting(true);
                setFrameNotice('');
                try {
                  await onExtract({ at: 'end' });
                  setFrameNotice(
                    t(
                      'End frame saved in shot versions for continuity references.',
                      'פריים הסיום נשמר בגרסאות השוט כרפרנס להמשך.',
                    ),
                  );
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setExtracting(false);
                }
              }}
            >
              {t('Save end frame for next shot', 'שמירת פריים סיום לשוט הבא')}
            </Button>
            <Button
              variant="outline"
              disabled={extracting}
              onClick={async () => {
                const frameTime = video.current?.currentTime;
                if (frameTime === undefined) return;
                setExtracting(true);
                setFrameNotice('');
                try {
                  await onExtract({ time: frameTime });
                  setFrameNotice(
                    t(
                      'Current frame saved in shot versions.',
                      'הפריים הנוכחי נשמר בגרסאות השוט.',
                    ),
                  );
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setExtracting(false);
                }
              }}
            >
              {t('Save current frame', 'שמירת הפריים הנוכחי')}
            </Button>
            {frameNotice && <p role="status">{frameNotice}</p>}
          </div>
        )}
        <Field label={t('Compare with another version', 'השוואה לגרסה אחרת')}>
          <Pick
            value={compare}
            onChange={setCompare}
            label="Comparison version"
            items={[
              { value: '', label: 'No comparison' },
              ...film.versions
                .filter(
                  (v) =>
                    v.shotId === version.shotId &&
                    v.id !== version.id &&
                    v.localPath,
                )
                .map((v) => ({
                  value: v.id,
                  label: `v${versionNumber(v, [...film.versions, ...(film.archivedVersions || [])])} · ${v.label}`,
                })),
            ]}
          />
        </Field>
        {compare && (
          <div className="review-media compare">
            <Media
              version={film.versions.find((v) => v.id === compare)}
              controls
            />
          </div>
        )}
        <div className="correction-form">
          <h3>{t('Correction notes', 'הערות לתיקון')}</h3>
          <div className="feedback-chips">
            {[
              t(
                'Character identity changed; preserve the approved face and wardrobe.',
                'זהות הדמות השתנתה; יש לשמור על הפנים והלבוש המאושרים.',
              ),
              t(
                'The pronunciation / lip-sync is wrong at this moment.',
                'ההגייה / סנכרון השפתיים לא נכונים ברגע הזה.',
              ),
              t(
                'Correct the motion or object orientation at this moment.',
                'יש לתקן את התנועה או כיוון העצם ברגע הזה.',
              ),
              t(
                'The text on screen is not readable.',
                'המלל על המסך אינו קריא.',
              ),
            ].map((text) => (
              <button
                key={text}
                onClick={() => {
                  setNote((n) => `${n}${n ? '\n' : ''}${text}`);
                  if (video.current)
                    setTime(video.current.currentTime.toFixed(2));
                }}
              >
                {text}
              </button>
            ))}
          </div>
          <Textarea
            aria-label="Correction note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t(
              'What needs to change? Be specific.',
              'מה צריך להשתנות? ציינו בדיוק את התיקון הרצוי.',
            )}
          />
          <div className="row-actions">
            <Input
              type="number"
              min="0"
              step=".01"
              aria-label="Correction timecode in seconds"
              placeholder="Time (seconds)"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
            {point && (
              <small>
                Frame {Math.round(point.x * 100)}%, {Math.round(point.y * 100)}%
              </small>
            )}
            <Button
              disabled={!note.trim()}
              onClick={async () => {
                if (
                  await save({
                    note,
                    ...(time !== '' ? { time: Number(time) } : {}),
                    ...point,
                  })
                ) {
                  setNote('');
                  setPoint(null);
                }
              }}
            >
              <Plus /> {t('Save note', 'שמירת הערה')}
            </Button>
            <Button
              variant="secondary"
              disabled={!note.trim() || !version.shotId}
              onClick={async () => {
                if (
                  await save({
                    note,
                    ...(time !== '' ? { time: Number(time) } : {}),
                    ...point,
                  })
                ) {
                  onRevise();
                }
              }}
            >
              <RefreshCw />
              {t('Save & correct this take', 'שמירה ותיקון הגרסה הזו')}
            </Button>
          </div>
          {version.notes.map((n: Row) => (
            <div className={`note ${n.resolved ? 'resolved' : ''}`} key={n.id}>
              <Toggle
                checked={n.resolved}
                onChange={() => void save({ resolveNote: n.id })}
              >
                <span>
                  {n.time != null ? `${n.time}s · ` : ''}
                  {n.text}
                </span>
              </Toggle>
              {n.x != null && (
                <small>
                  Frame {Math.round(n.x * 100)}%, {Math.round(n.y * 100)}%
                </small>
              )}
            </div>
          ))}
        </div>
        <details className="provenance">
          <summary>Record actual FAL cost</summary>
          <TextForm
            initial={{ actualCost: version.actualCost ?? '' }}
            fields={[
              {
                key: 'actualCost',
                label: 'Actual billed amount (USD)',
                type: 'number',
              },
            ]}
            onSave={(b) => onSave(b)}
          />
        </details>
        <details className="provenance">
          <summary>Full provenance & original request</summary>
          <pre>
            {JSON.stringify(
              {
                id: version.id,
                parent: version.parentVersionId,
                model: version.model,
                requestId: version.requestId,
                prompt: version.prompt,
                correction: version.correction,
                input: version.providerInput || version.input,
                context: version.context,
                sha256: version.sha256,
                estimatedCost: version.estimatedCost,
                actualCost: version.actualCost,
              },
              null,
              2,
            )}
          </pre>
        </details>
      </div>
      <aside className="review-checks">
        <h2>{t('Quality review', 'בדיקת איכות')}</h2>
        <p className="small">
          {t(
            'Inspect every category. Use N/A only when it does not apply to this asset.',
            'בדקו כל סעיף. בחרו ״לא רלוונטי״ רק כשהוא אינו חל על הנכס הזה.',
          )}
        </p>
        {(version.reviewBibleRevision !== film.bibleRevision ||
          (version.reviewShotRevision || 0) !==
            (film.shots.find((s) => s.id === version.shotId)
              ?.continuityRevision || 0)) && (
          <p className="notice">
            Review against production bible revision {film.bibleRevision}.
            Previous checks must be repeated after a bible or shot-direction
            change.
          </p>
        )}
        <Progress
          value={
            checks.length
              ? (checks.filter((k) =>
                  ['pass', 'na'].includes(version.checks?.[k]),
                ).length /
                  checks.length) *
                100
              : 0
          }
        />
        <Button
          variant="outline"
          onClick={() =>
            void save({
              checks: Object.fromEntries(checks.map((k) => [k, 'pass'])),
            })
          }
        >
          <ShieldCheck /> {t('Mark all as passed', 'סמן הכול כתקין')}
        </Button>
        <p className="small">
          {t(
            'Marks the checklist; approval remains a separate action. You can change individual results afterwards.',
            'מסמן את הבדיקות; אישור הגרסה נשאר פעולה נפרדת. אפשר לשנות כל סעיף לאחר הסימון.',
          )}
        </p>
        {checks.map((k) => (
          <div className="qc-row" key={k}>
            <span>{reviewLabel(k, isHebrew)}</span>
            <Pick
              label={k}
              value={version.checks?.[k] || 'pending'}
              onChange={(v) => void save({ checks: { [k]: v } })}
              items={[
                { value: 'pending', label: t('Unchecked', 'טרם נבדק') },
                { value: 'pass', label: t('Pass', 'תקין') },
                { value: 'fail', label: t('Fail', 'דורש תיקון') },
                { value: 'na', label: t('N/A', 'לא רלוונטי') },
              ]}
            />
          </div>
        ))}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="approval-actions">
          <Button onClick={() => void save({ status: 'approved' })}>
            <ShieldCheck /> {t('Approve version', 'אישור הגרסה')}
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              void save({
                status: version.status === 'rejected' ? 'review' : 'rejected',
              })
            }
          >
            {version.status === 'rejected'
              ? t('Return to review', 'החזרה לבדיקה')
              : t('Reject version', 'דחיית הגרסה')}
          </Button>
          {version.shotId && (
            <Button variant="secondary" onClick={onRevise}>
              <RefreshCw /> {t('Revise this version', 'תיקון הגרסה הזו')}
            </Button>
          )}
        </div>
      </aside>
    </div>
  );
}
