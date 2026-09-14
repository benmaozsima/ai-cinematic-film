'use client';

import { useMemo, useState } from 'react';
import type { AssetKind, FilmAsset } from './types';

type Props = {
  assets: FilmAsset[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  kinds?: AssetKind[];
  /** Props selected without their owning character are visibly flagged, never hidden. */
  selectedCharacterIds?: string[];
  title?: string;
  description?: string;
  disabled?: boolean;
  onCreateDraft?: (kind: AssetKind) => void;
};

const statusLabel = { approved: 'מאושר', review: 'בריוויו', draft: 'טיוטה', blocked: 'חסום' } as const;
const kindLabel = { character: 'דמויות', prop: 'אביזרים', location: 'לוקיישנים' } as const;

export function AssetPicker({
  assets, selectedIds, onSelectionChange, kinds = ['character', 'prop', 'location'],
  selectedCharacterIds = [], title = 'נכסים קאנוניים', description,
  disabled, onCreateDraft,
}: Props) {
  const [filter, setFilter] = useState<'all' | AssetKind>('all');
  const visible = useMemo(() => assets.filter((asset) =>
    kinds.includes(asset.kind) && (filter === 'all' || asset.kind === filter)), [assets, filter, kinds]);
  const toggle = (id: string) => onSelectionChange(selectedIds.includes(id)
    ? selectedIds.filter((current) => current !== id)
    : [...selectedIds, id]);

  return <section className="fos-picker" aria-label={title}>
    <style>{styles}</style>
    <header className="fos-picker__header">
      <div>
        <p className="fos-kicker">ASSET PICKER · SOURCE OF TRUTH</p>
        <h3>{title}</h3>
        {description && <p>{description}</p>}
      </div>
      <span className="fos-counter">{selectedIds.length} נבחרו</span>
    </header>
    <div className="fos-filters" role="tablist" aria-label="סוג נכס">
      <button type="button" className={filter === 'all' ? 'is-active' : ''} onClick={() => setFilter('all')}>הכול</button>
      {kinds.map((kind) => <button key={kind} type="button" className={filter === kind ? 'is-active' : ''} onClick={() => setFilter(kind)}>{kindLabel[kind]}</button>)}
    </div>
    <div className="fos-picker__grid">
      {visible.map((asset) => {
        const selected = selectedIds.includes(asset.id);
        const ownerMissing = asset.kind === 'prop' && asset.ownerCharacterId && !selectedCharacterIds.includes(asset.ownerCharacterId);
        const actionable = asset.status !== 'blocked' && !disabled;
        return <button type="button" key={asset.id} disabled={!actionable} onClick={() => toggle(asset.id)}
          className={`fos-asset ${selected ? 'is-selected' : ''} ${asset.status === 'draft' ? 'is-draft' : ''}`}>
          <span className="fos-asset__check">{selected ? '✓' : '+'}</span>
          <div className="fos-asset__image">
            {asset.thumbnailUrl || asset.referenceUrl
              ? <img src={asset.thumbnailUrl ?? asset.referenceUrl} alt="" />
              : <span>{asset.kind === 'character' ? '◉' : asset.kind === 'prop' ? '◇' : '⌖'}</span>}
          </div>
          <div className="fos-asset__copy">
            <div><span className="fos-id">{asset.id}</span><span className={`fos-status fos-status--${asset.status}`}>{statusLabel[asset.status]}</span></div>
            <b>{asset.name}</b>
            <small>{asset.continuityNote}</small>
            {asset.ownerCharacterId && <em className={ownerMissing ? 'fos-warning' : ''}>{ownerMissing ? `דורש גם ${asset.ownerCharacterId}` : `בעלות: ${asset.ownerCharacterId}`}</em>}
            {!asset.referenceUrl && <em className="fos-warning">אין רפרנס מאושר — לא יישלח למודל</em>}
          </div>
        </button>;
      })}
      {!visible.length && <div className="fos-empty">אין נכסים בקטגוריה זו.</div>}
    </div>
    {onCreateDraft && <button type="button" className="fos-draft" onClick={() => onCreateDraft(kinds[0])}>+ צור טיוטת {kindLabel[kinds[0]].slice(0, -1)}</button>}
  </section>;
}

const styles = `
.fos-picker{background:#151817;color:#f3f1eb;border:1px solid #343b39;border-radius:18px;padding:18px;font-family:inherit}.fos-picker *{box-sizing:border-box}.fos-picker__header{display:flex;justify-content:space-between;gap:16px;align-items:start}.fos-picker h3{font-size:18px;margin:3px 0}.fos-picker p{font-size:12px;line-height:1.5;color:#aab3ae;margin:0;max-width:630px}.fos-kicker{font-size:10px!important;letter-spacing:.12em;color:#a8d7b3!important;font-weight:800}.fos-counter{background:#26332d;color:#b8f2c5;padding:7px 10px;border-radius:999px;font-size:12px;font-weight:700;white-space:nowrap}.fos-filters{display:flex;gap:7px;margin:17px 0 12px;overflow:auto}.fos-filters button,.fos-draft{border:1px solid #424b47;background:transparent;color:#cbd1cd;border-radius:999px;padding:7px 11px;font-size:12px;white-space:nowrap}.fos-filters button.is-active{background:#e6efe8;color:#132218;border-color:#e6efe8}.fos-picker__grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(235px,1fr));gap:9px}.fos-asset{position:relative;display:grid;grid-template-columns:55px 1fr;gap:10px;text-align:right;background:#1e2321;color:inherit;border:1px solid #343d39;border-radius:12px;padding:9px;min-height:109px;transition:.15s}.fos-asset:hover{border-color:#7b9c85;transform:translateY(-1px)}.fos-asset.is-selected{background:#213228;border-color:#9bddaa;box-shadow:0 0 0 1px #9bddaa}.fos-asset.is-draft{border-style:dashed}.fos-asset:disabled{opacity:.5;cursor:not-allowed;transform:none}.fos-asset__check{position:absolute;left:8px;top:8px;width:19px;height:19px;border-radius:50%;display:grid;place-items:center;background:#313a35;color:#d5ded8;font-size:12px;font-weight:900}.is-selected .fos-asset__check{background:#a8efb9;color:#14301c}.fos-asset__image{width:55px;height:84px;border-radius:8px;overflow:hidden;background:#303934;display:grid;place-items:center;color:#b5c2b9;font-size:25px}.fos-asset__image img{width:100%;height:100%;object-fit:cover}.fos-asset__copy{min-width:0;display:grid;gap:4px}.fos-asset__copy>div{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.fos-id{font-size:10px;letter-spacing:.07em;color:#a6b1ab;font-family:ui-monospace,SFMono-Regular,monospace}.fos-status{font-size:9px;padding:3px 5px;border-radius:99px;font-weight:800}.fos-status--approved{background:#2f573c;color:#c9f6d4}.fos-status--review{background:#66562c;color:#ffecad}.fos-status--draft{background:#4e4a66;color:#e2dfff}.fos-status--blocked{background:#683f3f;color:#ffd2cf}.fos-asset b{font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.fos-asset small{font-size:10px;line-height:1.35;color:#adb6b1}.fos-asset em{font-size:10px;font-style:normal;color:#94b79e}.fos-warning{color:#ffc985!important}.fos-draft{margin-top:12px;color:#b9d9c0;border-style:dashed}.fos-empty{padding:18px;border:1px dashed #49534d;border-radius:10px;color:#aeb6b1;font-size:13px}@media(max-width:600px){.fos-picker__header{display:block}.fos-counter{display:inline-block;margin-top:10px}.fos-picker__grid{grid-template-columns:1fr}}
`;
