'use client';

import { useMemo, useState } from 'react';
import type {
  FilmOSQcCheckKey,
  FilmOSQcChecklist,
  FilmOSReviewItem,
  FilmOSReviewVariant,
  FilmOSReviewWorkbenchProps,
} from './types';

const qcLabels: Array<{ key: FilmOSQcCheckKey; label: string; hint: string }> = [
  { key: 'identity', label: 'זהות דמות', hint: 'פנים, גיל, לבוש והבעה תואמים לרפרנס.' },
  { key: 'props', label: 'אביזרים', hint: 'אביזרים נכונים, באותו מצב ובאותה יד כשנדרש.' },
  { key: 'anatomy', label: 'אנטומיה / גליץ׳ AI', hint: 'ידיים, מסך, טקסט, מגע וחפצים נראים תקינים.' },
  { key: 'action', label: 'פעולה ובימוי', hint: 'הפעולה המבוקשת מסתיימת בלי סטייה סיפורית.' },
  { key: 'continuity', label: 'רציפות לשוטים סמוכים', hint: 'כניסה, יציאה, כיוון, תאורה ומיקום מחוברים.' },
  { key: 'audio', label: 'אודיו / Lip-sync', hint: 'דיבור, שפתיים ואפקטים נבדקו רק אם קיימים בטייק.' },
];

function variantFor(item: FilmOSReviewItem, id?: string) {
  return item.variants.find(variant => variant.id === id) ?? item.variants[0];
}

function statusText(item: FilmOSReviewItem) {
  const status = item.shot.status;
  return { approved: 'מאושר', review: 'ממתין לריוויו', revise: 'נדרש תיקון', blocked: 'חסום', draft: 'טיוטה' }[status];
}

function VideoSurface({ variant, label, active = false }: { variant?: FilmOSReviewVariant; label: string; active?: boolean }) {
  if (!variant?.videoUrl) return <div className="fos-review-no-video" role="status"><span>אין קובץ וידאו אמיתי להצגה</span><small>{variant?.label || 'לא נבחרה גרסה'}</small></div>;
  return <div className={`fos-review-video ${active ? 'is-active' : ''}`}>
    <video controls preload="auto" playsInline aria-label={`${label}: ${variant.label}`} src={variant.videoUrl} />
    <div className="fos-review-video-caption"><b>{label}</b><span>{variant.label}</span></div>
  </div>;
}

function RunRecordDrawer({ item, open, onClose }: { item: FilmOSReviewItem; open: boolean; onClose: () => void }) {
  const record = item.runRecord;
  return <aside className={`fos-run-record ${open ? 'is-open' : ''}`} aria-hidden={!open} aria-label="Run Record לקריאה בלבד">
    <div className="fos-run-record-head"><div><span>RUN RECORD</span><h3>קריאה בלבד</h3></div><button type="button" onClick={onClose} aria-label="סגור Run Record">×</button></div>
    {!record ? <p className="fos-run-record-empty">אין רשומת ריצה שמורה עבור השוט הזה. לא מציגים Prompt או עלות מומצאים.</p> : <div className="fos-run-record-body">
      <RecordPair label="מזהה ריצה" value={record.runId}/>
      <RecordPair label="ספק / מודל" value={[record.provider, record.model].filter(Boolean).join(' · ')}/>
      <RecordPair label="נוצר" value={record.createdAt}/>
      <RecordPair label="נכס פלט" value={record.outputAssetId}/>
      <RecordPair label="SHA-256" value={record.sha256} mono/>
      {record.costUsd !== undefined ? <RecordPair label="עלות מתועדת" value={`$${record.costUsd.toFixed(2)}`}/> : null}
      {record.prompt ? <section><label>Prompt מדויק</label><pre>{record.prompt}</pre></section> : null}
      {record.constraints?.length ? <section><label>הגבלות שנשלחו</label><ul>{record.constraints.map(constraint => <li key={constraint}>{constraint}</li>)}</ul></section> : null}
      {record.referenceAssetIds?.length ? <section><label>רפרנסים שנשלחו</label><div className="fos-run-record-refs">{record.referenceAssetIds.map(reference => <code key={reference}>{reference}</code>)}</div></section> : null}
    </div>}
  </aside>;
}

function RecordPair({ label, value, mono = false }: { label: string; value?: string; mono?: boolean }) {
  if (!value) return null;
  return <div className="fos-run-record-pair"><span>{label}</span><b className={mono ? 'is-mono' : ''}>{value}</b></div>;
}

export function FilmOSReviewWorkbench({ items, selectedShotId, onSelectItem, onSelectVariant, onChecklistChange, onDecision }: FilmOSReviewWorkbenchProps) {
  const initialId = selectedShotId ?? items.find(item => item.shot.status !== 'approved')?.shot.id ?? items[0]?.shot.id;
  const [localItemId, setLocalItemId] = useState(initialId);
  const selectedId = selectedShotId ?? localItemId;
  const item = useMemo(() => items.find(candidate => candidate.shot.id === selectedId) ?? items[0], [items, selectedId]);

  if (!item) return <section className="fos-review-empty fos-card"><p className="fos-overline">REVIEW QUEUE</p><h2>אין טייקים לריוויו כרגע.</h2><p>כשתירשם גרסת וידאו אמיתית היא תופיע כאן עם מקור, גרסה ורשומת ריצה.</p><ReviewStyles/></section>;

  const selectItem = (next: FilmOSReviewItem) => { setLocalItemId(next.shot.id); onSelectItem?.(next); };
  return <section className="fos-review-workbench">
    <ReviewStyles/>
    <aside className="fos-review-queue fos-card" aria-label="תור ריוויו">
      <div className="fos-review-queue-head"><div><p className="fos-overline">REVIEW QUEUE</p><h2>הטייקים שמחכים לך</h2></div><span>{items.filter(candidate => candidate.shot.status !== 'approved').length}</span></div>
      <div className="fos-review-queue-list">{items.map(candidate => <button key={candidate.shot.id} type="button" onClick={() => selectItem(candidate)} className={`fos-review-queue-item ${candidate.shot.id === item.shot.id ? 'is-selected' : ''}`} aria-current={candidate.shot.id === item.shot.id ? 'true' : undefined}>
        <div className="fos-review-queue-thumb">{candidate.shot.thumbnailUrl ? <img src={candidate.shot.thumbnailUrl} alt=""/> : <span>NO REF</span>}</div>
        <div><b>{candidate.shot.id}</b><span>{candidate.shot.title}</span><small>{statusText(candidate)} · {candidate.variants.length} גרסאות</small></div>
      </button>)}</div>
    </aside>

    <ReviewDetail key={item.shot.id} item={item} onSelectVariant={onSelectVariant} onChecklistChange={onChecklistChange} onDecision={onDecision}/>
  </section>;
}

function ReviewDetail({ item, onSelectVariant, onChecklistChange, onDecision }: Pick<FilmOSReviewWorkbenchProps, 'onSelectVariant' | 'onChecklistChange' | 'onDecision'> & { item: FilmOSReviewItem }) {
  const firstVariant = item.selectedVariantId ?? item.variants[0]?.id;
  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>(firstVariant);
  const [compareVariantId, setCompareVariantId] = useState<string | undefined>(() => item.variants.find(variant => variant.id !== firstVariant)?.id);
  const [checklist, setChecklist] = useState<FilmOSQcChecklist>(item.checklist ?? {});
  const [revisionNote, setRevisionNote] = useState(item.note ?? '');
  const [runRecordOpen, setRunRecordOpen] = useState(false);
  const primaryVariant = variantFor(item, selectedVariantId);
  const comparisonVariant = variantFor(item, compareVariantId);
  const selectVariant = (id: string) => {
    setSelectedVariantId(id);
    if (compareVariantId === id) setCompareVariantId(item.variants.find(variant => variant.id !== id)?.id);
    const variant = variantFor(item, id);
    if (variant) onSelectVariant?.(item, variant);
  };
  const toggleCheck = (key: FilmOSQcCheckKey) => {
    const next = { ...checklist, [key]: !checklist[key] };
    setChecklist(next);
    onChecklistChange?.(item, next);
  };
  const passCount = qcLabels.filter(check => checklist[check.key]).length;
  return <>
    <main className="fos-review-main">
      <header className="fos-review-header"><div><p className="fos-overline">SHOT REVIEW · {item.shot.id}</p><h1>{item.shot.title}</h1><p>{item.shot.synopsis || 'אין תקציר לשוט זה.'}</p></div><div className="fos-review-header-actions"><span className={`fos-status ${item.shot.status}`}>{statusText(item)}</span><button className="fos-button" type="button" onClick={() => setRunRecordOpen(true)}>Run Record ↗</button></div></header>
      <section className="fos-review-stage fos-card">
        <div className="fos-review-stage-toolbar"><div className="fos-review-variant-select"><label htmlFor="review-variant">גרסה ראשית</label><select id="review-variant" value={primaryVariant?.id ?? ''} onChange={event => selectVariant(event.target.value)}>{item.variants.map(variant => <option key={variant.id} value={variant.id}>{variant.label}{variant.model ? ` · ${variant.model}` : ''}</option>)}</select></div>{item.variants.length > 1 ? <div className="fos-review-compare-select"><label htmlFor="review-compare">השווה מול</label><select id="review-compare" value={comparisonVariant?.id ?? ''} onChange={event => setCompareVariantId(event.target.value)}><option value="">ללא השוואה</option>{item.variants.filter(variant => variant.id !== primaryVariant?.id).map(variant => <option key={variant.id} value={variant.id}>{variant.label}</option>)}</select></div> : null}</div>
        <div className={`fos-review-player-grid ${comparisonVariant && comparisonVariant.id !== primaryVariant?.id ? 'is-comparing' : ''}`}><VideoSurface variant={primaryVariant} label="גרסה נבדקת" active/>{comparisonVariant && comparisonVariant.id !== primaryVariant?.id ? <VideoSurface variant={comparisonVariant} label="גרסת השוואה"/> : null}</div>
      </section>
      <section className="fos-review-checks fos-card"><div className="fos-review-checks-head"><div><p className="fos-overline">APPROVAL CHECKLIST</p><h2>מסמנים רק אם רוצים לאשר גרסה.</h2></div><strong>{passCount}/{qcLabels.length}</strong></div><div className="fos-review-check-grid">{qcLabels.map(check => <label key={check.key} className={checklist[check.key] ? 'is-checked' : ''}><input type="checkbox" checked={Boolean(checklist[check.key])} onChange={() => toggleCheck(check.key)}/><span className="fos-review-check-mark">✓</span><span><b>{check.label}</b><small>{check.hint}</small></span></label>)}</div></section>
      <section className="fos-review-revision fos-card"><div><p className="fos-overline">REPORT ISSUE</p><h2>מצאתי טעות — מה צריך לתקן?</h2><p>לא צריך לסמן קוביות. כתוב מה נראה ומה צריך להיות; זה ייפתח בבנאי כ־prompt לעריכה.</p></div><textarea value={revisionNote} onChange={event => setRevisionNote(event.target.value)} placeholder="לדוגמה: הטלפון הפוך. הוא חייב להיות זקוף, המסך פונה למצלמה והחריץ העליון למעלה. לשמור על היד, הכובע והתאורה." /></section>
      <footer className="fos-review-decisions"><p>לתיקון: כתוב הערה ולחץ ״החזר לתיקון״. לאישור: השלם את שש בדיקות האישור.</p><div><button type="button" className="fos-review-decision reject" onClick={() => onDecision?.(item, 'rejected', primaryVariant, revisionNote)}>דחה</button><button type="button" className="fos-review-decision revise" disabled={!revisionNote.trim()} title={!revisionNote.trim() ? 'יש לתאר מה לתקן לפני החזרה לתיקון.' : undefined} onClick={() => onDecision?.(item, 'revise', primaryVariant, revisionNote)}>החזר לתיקון</button><button type="button" className="fos-review-decision approve" disabled={passCount!==qcLabels.length} title={passCount!==qcLabels.length?'יש להשלים את בדיקות ה־QC לפני אישור.':undefined} onClick={() => onDecision?.(item, 'approved', primaryVariant, revisionNote)}>אשר גרסה</button></div></footer>
    </main>
    <RunRecordDrawer item={item} open={runRecordOpen} onClose={() => setRunRecordOpen(false)}/>
  </>;
}

function ReviewStyles() {
  return <style>{`
    .fos-review-workbench{position:relative;display:grid;grid-template-columns:280px minmax(0,1fr);gap:18px;min-height:650px;direction:rtl}.fos-review-queue{align-self:start;overflow:hidden}.fos-review-queue-head{padding:18px;border-bottom:1px solid var(--fos-line);display:flex;justify-content:space-between;gap:10px}.fos-review-queue-head h2{font-size:17px;margin:4px 0 0;letter-spacing:-.04em}.fos-review-queue-head>span{display:grid;place-items:center;width:26px;height:26px;border-radius:8px;background:#7c7cff1c;color:#b7b7ff;font-size:11px;font-weight:900}.fos-review-queue-list{max-height:622px;overflow:auto;padding:7px}.fos-review-queue-item{width:100%;border:1px solid transparent;border-radius:10px;background:transparent;color:#dce4f0;display:grid;grid-template-columns:52px minmax(0,1fr);gap:10px;text-align:right;padding:8px;align-items:center}.fos-review-queue-item:hover{background:#172131}.fos-review-queue-item.is-selected{background:#7c7cff15;border-color:#7c7cff52}.fos-review-queue-thumb{width:52px;height:42px;overflow:hidden;border-radius:6px;background:#0e151f;display:grid;place-items:center;color:#738096;font-size:8px}.fos-review-queue-thumb img{width:100%;height:100%;object-fit:cover}.fos-review-queue-item b,.fos-review-queue-item span,.fos-review-queue-item small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.fos-review-queue-item b{font-size:10px;color:#c6ceff}.fos-review-queue-item span{font-size:12px;font-weight:750;margin:2px 0}.fos-review-queue-item small{font-size:9px;color:var(--fos-muted)}.fos-review-main{min-width:0}.fos-review-header{display:flex;justify-content:space-between;gap:18px;align-items:start;margin:4px 0 17px}.fos-review-header h1{font-size:clamp(27px,3vw,40px);letter-spacing:-.06em;margin:3px 0 7px}.fos-review-header p:not(.fos-overline){margin:0;color:var(--fos-muted);font-size:13px;line-height:1.6}.fos-review-header-actions{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.fos-review-stage{overflow:hidden}.fos-review-stage-toolbar{display:flex;justify-content:space-between;gap:12px;padding:13px 14px;border-bottom:1px solid var(--fos-line);background:#111925}.fos-review-stage-toolbar label{display:block;font-size:9px;color:#8996ab;margin-bottom:4px}.fos-review-stage-toolbar select{border:1px solid var(--fos-line);background:#0d141f;color:#e3e9f4;border-radius:7px;padding:6px 8px;max-width:260px;font:inherit;font-size:11px}.fos-review-player-grid{padding:14px;display:grid;grid-template-columns:minmax(0,1fr)}.fos-review-player-grid.is-comparing{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.fos-review-video{position:relative;border-radius:10px;overflow:hidden;background:#060a0f;min-width:0}.fos-review-video.is-active{outline:2px solid #7c7cff99}.fos-review-video video{width:100%;display:block;aspect-ratio:16/9;background:#060a0f}.fos-review-video-caption{position:absolute;right:9px;bottom:9px;left:9px;display:flex;justify-content:space-between;gap:8px;align-items:center;padding:6px 8px;border-radius:6px;background:#0b1018c7;color:#f5f7fb;font-size:10px;pointer-events:none}.fos-review-video-caption span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#bdc7d7}.fos-review-no-video{aspect-ratio:16/9;display:grid;place-content:center;text-align:center;gap:5px;background:linear-gradient(135deg,#101723,#090e15);color:#9da9ba;border:1px dashed #566176;border-radius:10px;font-size:12px}.fos-review-no-video small{color:#6d7a8f;font-size:10px}.fos-review-checks{margin-top:17px;padding:18px}.fos-review-checks-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}.fos-review-checks-head h2{font-size:19px;margin:3px 0 0;letter-spacing:-.04em}.fos-review-checks-head strong{font-size:16px;color:#c7c7ff}.fos-review-check-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.fos-review-check-grid label{min-height:80px;border:1px solid var(--fos-line);background:#0f1722;border-radius:10px;padding:10px;display:flex;gap:8px;align-items:start;cursor:pointer}.fos-review-check-grid label:hover{border-color:#576783}.fos-review-check-grid label.is-checked{border-color:#62ddb382;background:#62ddb30c}.fos-review-check-grid input{position:absolute;opacity:0}.fos-review-check-mark{flex:0 0 17px;width:17px;height:17px;display:grid;place-items:center;border:1px solid #59667b;border-radius:5px;color:transparent;font-size:11px}.fos-review-check-grid label.is-checked .fos-review-check-mark{background:var(--fos-mint);border-color:var(--fos-mint);color:#102019}.fos-review-check-grid b,.fos-review-check-grid small{display:block}.fos-review-check-grid b{font-size:11px}.fos-review-check-grid small{font-size:9px;line-height:1.45;color:var(--fos-muted);margin-top:4px}.fos-review-decisions{margin:17px 0 0;display:flex;justify-content:space-between;align-items:center;gap:16px}.fos-review-decisions p{font-size:10px;line-height:1.5;color:var(--fos-muted);margin:0;max-width:390px}.fos-review-decisions>div{display:flex;gap:7px;flex-wrap:wrap}.fos-review-decision{border:1px solid var(--fos-line);border-radius:9px;padding:9px 12px;color:#eaf0fa;background:#151e2b;font-size:11px;font-weight:850}.fos-review-decision.approve{color:#08291e;background:var(--fos-mint);border-color:var(--fos-mint)}.fos-review-decision.revise{color:#3d2606;background:var(--fos-warn);border-color:var(--fos-warn)}.fos-review-decision.reject{color:#fff;background:#ff7d8f25;border-color:#ff7d8f59}.fos-run-record{position:absolute;z-index:4;top:0;bottom:0;left:0;width:min(405px,92vw);background:#111925;border:1px solid var(--fos-line);border-radius:14px;box-shadow:-18px 0 48px #0008;transform:translateX(calc(-100% - 22px));transition:transform .22s ease;overflow:auto}.fos-run-record.is-open{transform:none}.fos-run-record-head{display:flex;align-items:start;justify-content:space-between;padding:18px;border-bottom:1px solid var(--fos-line)}.fos-run-record-head span{font-size:9px;color:#aaaaff;letter-spacing:.15em;font-weight:900}.fos-run-record-head h3{margin:3px 0 0;font-size:19px}.fos-run-record-head button{border:1px solid var(--fos-line);border-radius:7px;background:#182231;color:#edf2fb;width:27px;height:27px;font-size:20px;line-height:1}.fos-run-record-body{padding:16px}.fos-run-record-pair{border-bottom:1px solid var(--fos-line);padding:9px 0}.fos-run-record-pair span,.fos-run-record-pair b{display:block}.fos-run-record-pair span,.fos-run-record-body label{font-size:9px;color:#8491a5}.fos-run-record-pair b{font-size:11px;margin-top:4px;word-break:break-word}.fos-run-record-pair .is-mono,.fos-run-record-refs code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:9px}.fos-run-record-body section{margin-top:16px}.fos-run-record-body pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#0b1018;border:1px solid var(--fos-line);border-radius:8px;padding:10px;color:#cbd5e5;line-height:1.55;font:10px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace}.fos-run-record-body ul{margin:7px 0 0;padding:0 17px;color:#cbd5e5;font-size:11px;line-height:1.7}.fos-run-record-refs{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px}.fos-run-record-refs code{padding:4px 5px;background:#0b1018;border-radius:4px;color:#c6ccff}.fos-run-record-empty{padding:18px;color:var(--fos-muted);font-size:12px;line-height:1.7}.fos-review-empty{padding:32px}.fos-review-empty h2{font-size:25px;margin:4px 0}.fos-review-empty p:not(.fos-overline){color:var(--fos-muted);font-size:13px}@media(max-width:1000px){.fos-review-workbench{grid-template-columns:1fr}.fos-review-queue-list{display:flex;max-height:none;overflow:auto}.fos-review-queue-item{min-width:220px}.fos-review-check-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:620px){.fos-review-header,.fos-review-stage-toolbar,.fos-review-decisions{display:block}.fos-review-header-actions{margin-top:11px}.fos-review-compare-select{margin-top:9px}.fos-review-player-grid.is-comparing,.fos-review-check-grid{grid-template-columns:1fr}.fos-review-decisions>div{margin-top:11px}.fos-review-decision{flex:1}.fos-run-record{position:fixed;top:10px;bottom:10px;left:10px}.fos-review-stage-toolbar select{max-width:100%}}
    .fos-review-revision{margin-top:17px;padding:16px;display:grid;grid-template-columns:1fr auto;gap:11px}.fos-review-revision h2{font-size:17px;margin:3px 0}.fos-review-revision p{margin:0;color:var(--fos-muted);font-size:11px}.fos-review-revision textarea{grid-column:1/-1;width:100%;min-height:85px;background:#0d141f;border:1px solid var(--fos-line);border-radius:9px;color:#eaf0fa;padding:10px;font:inherit;font-size:12px;line-height:1.55;resize:vertical}.fos-review-revision button{border:1px solid #f3b96b66;border-radius:9px;background:#f3b96b15;color:#ffd58d;padding:8px 10px;font:inherit;font-size:11px;font-weight:800;align-self:start}
  `}</style>;
}
