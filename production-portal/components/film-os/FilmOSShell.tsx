'use client';

import { useEffect, useState } from 'react';
import type { FilmOSShellProps, FilmOSStatus } from './types';
import { FilmOSStyles } from './FilmOSStyles';

const statusLabels: Record<FilmOSStatus, string> = { approved: 'מאושר', review: 'לריוויו', revise: 'לתיקון', blocked: 'חסום', draft: 'טיוטה' };

export function FilmOSStatusPill({ status }: { status: FilmOSStatus }) {
  return <span className={`fos-status ${status}`}>{statusLabels[status]}</span>;
}

type TrayRun={shotId:string;status:'submitting'|'queued'|'running'|'completed'|'failed';model:string;modelLabel:string;requestId?:string;version?:string;error?:string;updatedAt:string};
function ImageJobsTray(){
 const[runs,setRuns]=useState<TrayRun[]>([]),[open,setOpen]=useState(false);
 useEffect(()=>{let active=true;const load=async()=>{try{const response=await fetch('/api/image-jobs',{cache:'no-store'});if(!response.ok)return;const value=await response.json() as {runs?:TrayRun[]};const listed=value.runs??[];await Promise.all(listed.filter(run=>run.requestId&&['submitting','queued','running'].includes(run.status)).map(run=>fetch(`/api/image-jobs/${encodeURIComponent(run.requestId!)}?model=${encodeURIComponent(run.model)}`,{cache:'no-store'}).catch(()=>null)));if(active)setRuns(listed)}catch{}};void load();const timer=window.setInterval(()=>void load(),2500);return()=>{active=false;window.clearInterval(timer)}},[]);
 const active=runs.filter(run=>['submitting','queued','running'].includes(run.status)),latest=[...new Map(runs.map(run=>[run.shotId,run])).values()].slice(0,8);
 const text={submitting:'נשלח',queued:'בתור',running:'יוצר כעת',completed:'מוכן לריוויו',failed:'נכשל'} as const;
 return <aside className={`fos-jobs-tray ${open?'open':''}`} dir="rtl"><style>{`.fos-jobs-tray{position:fixed;z-index:60;left:22px;bottom:92px;width:min(390px,calc(100vw - 44px));color:#eef3ff}.fos-jobs-toggle{width:100%;display:flex;justify-content:space-between;align-items:center;padding:13px 16px;border:1px solid #5364a9;border-radius:14px;background:#171d38;color:#fff;font:inherit;font-weight:900;box-shadow:0 14px 40px #0008;cursor:pointer}.fos-jobs-count{background:#8175ff;border-radius:999px;padding:3px 9px}.fos-jobs-panel{display:none;margin-bottom:9px;max-height:370px;overflow:auto;border:1px solid #35435b;border-radius:15px;background:#0e1724;box-shadow:0 18px 50px #000a}.fos-jobs-tray.open .fos-jobs-panel{display:block}.fos-jobs-head{padding:14px 16px;border-bottom:1px solid #35435b}.fos-job{width:100%;display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;padding:12px 15px;border:0;border-bottom:1px solid #273449;background:transparent;color:#fff;text-align:right;font:inherit;cursor:pointer}.fos-job:hover{background:#162235}.fos-job span{width:9px;height:9px;border-radius:50%;background:#7b89a1}.fos-job.running span,.fos-job.queued span,.fos-job.submitting span{background:#a99fff;box-shadow:0 0 0 5px #8175ff22}.fos-job.completed span{background:#61ddb1}.fos-job.failed span{background:#ff847f}.fos-job b{display:block}.fos-job small{color:#aebbd0}.fos-job em{font-style:normal;font-size:12px;color:#cad3e4}.fos-jobs-empty{padding:18px;color:#aebbd0;text-align:center}@media(max-width:700px){.fos-jobs-tray{left:12px;bottom:84px;width:calc(100vw - 24px)}}`}</style><div className="fos-jobs-panel"><header className="fos-jobs-head"><b>ריצות תמונה</b><small> · נשמרות בשרת ומתעדכנות אוטומטית</small></header>{latest.length?latest.map(run=><button key={`${run.shotId}-${run.updatedAt}`} className={`fos-job ${run.status}`} onClick={()=>{window.dispatchEvent(new CustomEvent('film-os-open-image-job',{detail:{shotId:run.shotId}}));setOpen(false)}}><span/><div><b>{run.shotId} · {run.version??run.modelLabel}</b><small>{run.error??text[run.status]}</small></div><em>פתח ←</em></button>):<p className="fos-jobs-empty">אין ריצות עדיין. אחרי אישור יצירה הן יופיעו כאן.</p>}</div><button className="fos-jobs-toggle" onClick={()=>setOpen(value=>!value)}><span>{active.length?`${active.length} ריצות פעילות`:'ריצות תמונה'}</span><span className="fos-jobs-count">{latest.length}</span></button></aside>
}

export function FilmOSShell({ projectName, projectMeta = 'Production workspace', navigation, activeNavigationId, onNavigate, openReviews = 0, budgetLabel = '$0.00 / $50.00', children }: FilmOSShellProps) {
  return <div className="fos"><FilmOSStyles /><div className="fos-shell">
    <aside className="fos-sidebar" aria-label="ניווט ראשי">
      <div className="fos-brand"><div className="fos-brandmark">ש</div><span><strong>{projectName}</strong><small>FILM OS</small></span></div>
      <nav className="fos-nav">{navigation.map(item => <button key={item.id} aria-current={item.id === activeNavigationId ? 'page' : undefined} onClick={() => onNavigate?.(item.id)}><span className="fos-nav-icon" aria-hidden>{item.icon}</span>{item.label}{item.badge ? <span className="fos-nav-badge">{item.badge}</span> : null}</button>)}</nav>
      <div className="fos-side-status"><div><span>מצב הפקה</span><b className="fos-online">● פעיל</b></div><div><span>ריוויו פתוח</span><b>{openReviews}</b></div><div><span>תקציב מאושר</span><b>{budgetLabel}</b></div></div>
    </aside>
    <div className="fos-main"><header className="fos-topbar"><div className="fos-breadcrumb"><span>הפקות</span><span>‹</span><b>{projectMeta}</b></div><div className="fos-top-actions"><span className="fos-top-chip">{openReviews} החלטות פתוחות</span><button className="fos-icon-button" type="button" aria-label="התראות">◌</button><button className="fos-button primary" type="button">+ שוט חדש</button></div></header><main className="fos-workspace">{children}</main><ImageJobsTray/></div>
  </div></div>;
}
