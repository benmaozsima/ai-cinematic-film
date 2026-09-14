'use client';

import { useMemo, useState } from 'react';
import type { CanonicalStatus } from '../asset-builder/types';
import type { FilmOSShot } from '../types';
import {
  hasUsableMedia,
  libraryKindLabels,
  libraryStatusLabels,
  type FilmLibraryAsset,
  type LibraryAssetKind,
} from './types';

type Props = {
  assets: FilmLibraryAsset[];
  shots?: FilmOSShot[];
  selectedAssetId?: string;
  onSelectAsset?: (asset: FilmLibraryAsset) => void;
  onOpenShot?: (shotId: string) => void;
  onCreateAsset?: () => void;
};

type Filter = 'all' | LibraryAssetKind;
type View = 'grid' | 'list';

const kinds: Filter[] = ['all', 'character', 'prop', 'location', 'keyframe', 'video'];
const statusClass: Record<CanonicalStatus, string> = { approved: 'approved', review: 'review', draft: 'draft', blocked: 'blocked' };

function Media({ asset, compact = false }: { asset: FilmLibraryAsset; compact?: boolean }) {
  const available = hasUsableMedia(asset);
  if (!available) return <div className={`fos-al-media fos-al-media--missing ${compact ? 'is-compact' : ''}`}><span>ללא מדיה</span><small>{asset.mediaAvailability === 'pending' ? 'ממתין לעיבוד' : 'לא זמין לרפרנס'}</small></div>;
  if (asset.mediaType === 'video') return <div className={`fos-al-media ${compact ? 'is-compact' : ''}`}><video className="fos-media" src={asset.mediaUrl} preload="metadata" muted playsInline /><span className="fos-al-play">▶</span></div>;
  return <div className={`fos-al-media ${compact ? 'is-compact' : ''}`}><img className="fos-media" src={asset.mediaUrl} alt={`${asset.id} — ${asset.name}`} /></div>;
}

export function FilmOSAssetLibrary({ assets, shots = [], selectedAssetId, onSelectAsset, onOpenShot, onCreateAsset }: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [show, setShow] = useState<'all' | 'canonical' | 'needs-media'>('all');
  const [view, setView] = useState<View>('grid');
  const [localSelectedId, setLocalSelectedId] = useState(selectedAssetId ?? assets[0]?.id);
  const selectedId = selectedAssetId ?? localSelectedId;
  const selected = assets.find(asset => asset.id === selectedId) ?? assets[0];
  const visible = useMemo(() => assets.filter(asset => {
    const search = `${asset.id} ${asset.name} ${asset.continuityNote}`.toLocaleLowerCase('he');
    return (filter === 'all' || asset.kind === filter)
      && (!query || search.includes(query.toLocaleLowerCase('he')))
      && (show === 'all' || (show === 'canonical' ? asset.canonical : !hasUsableMedia(asset)));
  }), [assets, filter, query, show]);
  const countByKind = (kind: Filter) => kind === 'all' ? assets.length : assets.filter(asset => asset.kind === kind).length;
  const choose = (asset: FilmLibraryAsset) => { setLocalSelectedId(asset.id); onSelectAsset?.(asset); };
  const selectedShots = selected?.usedInShotIds?.map(id => shots.find(shot => shot.id === id)).filter(Boolean) as FilmOSShot[] | undefined;

  return <section className="fos-al" aria-label="ספריית נכסי הפקה">
    <style>{styles}</style>
    <header className="fos-al__header">
      <div><p className="fos-overline">ASSET LIBRARY · CANONICAL PRODUCTION RECORD</p><h1 className="fos-heading">נכסים אמיתיים. קשרים ברורים.</h1><p className="fos-subtitle">רפרנס שלא קיים אינו מוצג כאילו הוא קיים. כל נכס מציג מצב, גרסה, רציפות והשוטים שבהם הוא נמצא.</p></div>
      <button type="button" className="fos-button primary" onClick={onCreateAsset}>+ נכס חדש</button>
    </header>
    <div className="fos-al__toolbar fos-card">
      <label className="fos-al-search"><span>⌕</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="חיפוש ID, שם או הערת רציפות" /></label>
      <div className="fos-al-toggle" aria-label="מצב תצוגה"><button type="button" className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')}>▦</button><button type="button" className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>☷</button></div>
      <div className="fos-al-scopes"><button type="button" className={show === 'all' ? 'active' : ''} onClick={() => setShow('all')}>הכול</button><button type="button" className={show === 'canonical' ? 'active' : ''} onClick={() => setShow('canonical')}>קאנוני בלבד</button><button type="button" className={show === 'needs-media' ? 'active' : ''} onClick={() => setShow('needs-media')}>חסר רפרנס</button></div>
    </div>
    <nav className="fos-al__filters" aria-label="סוג נכס">{kinds.map(kind => <button type="button" key={kind} className={filter === kind ? 'active' : ''} onClick={() => setFilter(kind)}><span>{kind === 'all' ? 'כל הנכסים' : libraryKindLabels[kind]}</span><b>{countByKind(kind)}</b></button>)}</nav>
    <div className="fos-al__layout">
      <div className={`fos-al__collection ${view === 'list' ? 'is-list' : ''}`}>
        {visible.map(asset => <button type="button" className={`fos-al-card ${selected?.id === asset.id ? 'is-selected' : ''}`} key={`${asset.id}:${asset.mediaUrl ?? 'none'}:${asset.mediaAvailability ?? 'unknown'}`} onClick={() => choose(asset)}><Media asset={asset} compact={view === 'list'} /><div className="fos-al-card__body"><div className="fos-al-card__meta"><code>{asset.id}</code><AssetStatus asset={asset}/></div><h2>{asset.name}</h2><p>{asset.continuityNote}</p><div className="fos-al-card__bottom"><span>{asset.version || 'ללא גרסה'}</span><span>{asset.usedInShotIds?.length ?? 0} שוטים</span></div></div></button>)}
        {!visible.length && <div className="fos-al-empty"><b>אין נכסים תואמים.</b><span>נסה להסיר מסנן או לחפש מונח אחר.</span></div>}
      </div>
      {selected && <aside className="fos-al-detail fos-card"><Media asset={selected}/><div className="fos-al-detail__body"><div className="fos-al-detail__eyebrow"><code>{selected.id}</code><AssetStatus asset={selected}/></div><h2>{selected.name}</h2><p>{selected.continuityNote}</p><div className="fos-al-detail__facts"><Fact label="סוג" value={libraryKindLabels[selected.kind]}/><Fact label="גרסה" value={selected.version || 'טרם נרשמה'}/><Fact label="מקור" value={selected.canonical ? 'קאנוני' : 'טיוטה'}/><Fact label="מדיה" value={hasUsableMedia(selected) ? 'רפרנס זמין' : 'לא זמין'}/>{selected.ownerCharacterId && <Fact label="בעלות" value={selected.ownerCharacterId}/>} {selected.model && <Fact label="מודל" value={selected.model}/>} {selected.checksum && <Fact label="SHA-256" value={selected.checksum.slice(0, 12) + '…'}/>}</div>
        {!hasUsableMedia(selected) && <div className="fos-al-alert"><b>לא נשלח למודל</b><span>לנכס זה אין רפרנס מדיה תקין. הוסף קובץ ובדוק אותו לפני יצירה.</span></div>}
        <div className="fos-al-usage"><div><span className="fos-overline">USED IN SHOTS</span><b>{selectedShots?.length ?? 0} שוטים משתמשים בנכס</b></div>{selectedShots?.length ? <div className="fos-al-shotlinks">{selectedShots.map(shot => <button type="button" key={shot.id} onClick={() => onOpenShot?.(shot.id)}><span>{shot.id}</span><small>{shot.title}</small>↗</button>)}</div> : <p>עדיין לא משויך לשוט. שיוך יירשם בבנאי השוט.</p>}</div>
      </div></aside>}
    </div>
  </section>;
}

function AssetStatus({ asset }: { asset: FilmLibraryAsset }) { return <span className={`fos-al-status ${statusClass[asset.status]}`}>{asset.canonical ? libraryStatusLabels[asset.status] : 'טיוטה'}</span>; }
function Fact({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><b>{value}</b></div>; }

const styles = `
.fos-al{min-width:0}.fos-al__header{display:flex;justify-content:space-between;align-items:end;gap:20px;margin-bottom:24px}.fos-al__header .fos-subtitle{max-width:690px}.fos-al__toolbar{display:flex;align-items:center;gap:12px;padding:10px;margin-bottom:13px}.fos-al-search{flex:1;min-width:210px;display:flex;align-items:center;gap:8px;background:#0e151f;border:1px solid var(--fos-line);border-radius:9px;padding:0 11px;color:#8492a7}.fos-al-search input{border:0;outline:0;background:transparent;color:#e9edf5;width:100%;height:36px;font:inherit;font-size:12px}.fos-al-search input::placeholder{color:#718096}.fos-al-toggle,.fos-al-scopes{display:flex;gap:4px}.fos-al-toggle button,.fos-al-scopes button{border:1px solid var(--fos-line);background:#111925;color:#9eabba;border-radius:7px;padding:7px 9px;font:inherit;font-size:11px}.fos-al-toggle button.active,.fos-al-scopes button.active{background:#252b58;border-color:#7c7cff80;color:white}.fos-al__filters{display:flex;gap:8px;overflow:auto;padding-bottom:9px}.fos-al__filters button{display:flex;gap:8px;align-items:center;border:1px solid var(--fos-line);background:#141d2a;color:#aeb9c9;border-radius:10px;padding:9px 11px;font:inherit;font-size:12px;white-space:nowrap}.fos-al__filters button.active{color:#fff;border-color:#777aff;background:#1f2940}.fos-al__filters b{font-size:10px;background:#0e151f;color:#91a1b6;padding:3px 6px;border-radius:999px}.fos-al__layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(305px,.31fr);gap:17px;align-items:start}.fos-al__collection{display:grid;grid-template-columns:repeat(auto-fill,minmax(205px,1fr));gap:11px}.fos-al-card{overflow:hidden;text-align:right;color:inherit;border:1px solid var(--fos-line);background:#141d2a;border-radius:13px;padding:0;transition:.18s}.fos-al-card:hover,.fos-al-card.is-selected{border-color:#777aff;transform:translateY(-2px);box-shadow:0 12px 28px #00000024}.fos-al-card.is-selected{box-shadow:0 0 0 2px #7c7cff33}.fos-al-media{position:relative;aspect-ratio:16/10;overflow:hidden;background:#0c121a}.fos-al-media.is-compact{aspect-ratio:1.4}.fos-al-media--missing{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;background:repeating-linear-gradient(135deg,#131b27 0 11px,#172130 11px 12px);color:#9aa7b9}.fos-al-media--missing span{font-size:12px;font-weight:800}.fos-al-media--missing small{font-size:10px;color:#748399}.fos-al-play{position:absolute;bottom:9px;left:9px;width:28px;height:28px;display:grid;place-items:center;border-radius:50%;background:#0a1019cc;color:white;font-size:10px}.fos-al-card__body{padding:12px}.fos-al-card__meta,.fos-al-detail__eyebrow{display:flex;align-items:center;justify-content:space-between;gap:7px}.fos-al-card code,.fos-al-detail code{color:#98a7bf;font:700 10px ui-monospace,SFMono-Regular,monospace;letter-spacing:.04em}.fos-al-status{border-radius:999px;padding:4px 7px;font-size:9px;font-weight:850}.fos-al-status.approved{color:#78e3bd;background:#62ddb318}.fos-al-status.review{color:#ffd27d;background:#f3b96b18}.fos-al-status.draft{color:#c0c8d6;background:#a9b3c418}.fos-al-status.blocked{color:#ff9aa7;background:#ff7d8f18}.fos-al-card h2{font-size:15px;letter-spacing:-.025em;margin:10px 0 5px}.fos-al-card p{min-height:35px;color:var(--fos-muted);font-size:11px;line-height:1.55;margin:0}.fos-al-card__bottom{display:flex;justify-content:space-between;border-top:1px solid var(--fos-line);margin-top:11px;padding-top:9px;color:#8492a7;font-size:10px}.fos-al__collection.is-list{grid-template-columns:1fr}.fos-al__collection.is-list .fos-al-card{display:grid;grid-template-columns:145px 1fr}.fos-al__collection.is-list .fos-al-card__body{min-height:104px}.fos-al-empty{min-height:210px;border:1px dashed var(--fos-line);border-radius:14px;display:grid;place-content:center;gap:6px;text-align:center;color:#97a4b7;font-size:12px}.fos-al-empty b{color:#e3e8f0;font-size:14px}.fos-al-detail{position:sticky;top:91px;overflow:hidden}.fos-al-detail>.fos-al-media{aspect-ratio:16/9}.fos-al-detail__body{padding:17px}.fos-al-detail h2{font-size:23px;letter-spacing:-.04em;margin:10px 0 6px}.fos-al-detail>div>p{font-size:12px;line-height:1.7;color:var(--fos-muted);margin:0}.fos-al-detail__facts{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin:16px 0}.fos-al-detail__facts div{min-width:0;background:#0d151f;border:1px solid var(--fos-line);border-radius:8px;padding:8px}.fos-al-detail__facts span{display:block;color:#7f8da2;font-size:9px;margin-bottom:3px}.fos-al-detail__facts b{display:block;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.fos-al-alert{border:1px solid #f3b96b4b;background:#f3b96b0d;border-radius:9px;padding:10px;display:grid;gap:3px;margin:13px 0;color:#f8d69c}.fos-al-alert b{font-size:11px}.fos-al-alert span{font-size:10px;line-height:1.5;color:#cbb588}.fos-al-usage{border-top:1px solid var(--fos-line);padding-top:15px;margin-top:17px}.fos-al-usage>div:first-child{display:grid;gap:4px}.fos-al-usage b{font-size:12px}.fos-al-usage>p{font-size:11px!important;margin-top:10px!important}.fos-al-shotlinks{display:grid;gap:5px;margin-top:10px}.fos-al-shotlinks button{display:grid;grid-template-columns:auto 1fr auto;gap:6px;align-items:center;text-align:right;border:1px solid var(--fos-line);background:#101722;color:#dbe2ec;border-radius:8px;padding:7px;font:inherit}.fos-al-shotlinks span{font:800 10px ui-monospace,SFMono-Regular,monospace;color:#b7bbff}.fos-al-shotlinks small{font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#b8c2d0}@media(max-width:940px){.fos-al__layout{grid-template-columns:1fr}.fos-al-detail{position:relative;top:auto;display:grid;grid-template-columns:270px 1fr}.fos-al-detail>.fos-al-media{aspect-ratio:auto}.fos-al-detail__body{min-width:0}}@media(max-width:670px){.fos-al__header{display:grid;align-items:start}.fos-al__toolbar{align-items:stretch;flex-wrap:wrap}.fos-al-search{flex-basis:100%}.fos-al__collection{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.fos-al-card__body{padding:9px}.fos-al-card h2{font-size:13px}.fos-al-card p{font-size:10px}.fos-al-detail{display:block}.fos-al-detail>.fos-al-media{aspect-ratio:16/9}.fos-al__collection.is-list .fos-al-card{grid-template-columns:105px 1fr}.fos-al-scopes{overflow:auto;max-width:100%}}
`;
