'use client';
import { ASSET_VIEWS } from '../shared/asset-views.mjs';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Media, Status } from './studio-ui';
import { api, type Film, type Row } from './studio-types';
export function VersionLibrary({film, entityId, onChanged, onReview, onRevise, hebrew=true, archiveOnly=false}: {film:Film; entityId?:string; onChanged:()=>Promise<unknown>; onReview:(id:string)=>void; onRevise?:(id:string)=>void; hebrew?:boolean; archiveOnly?:boolean}) {
  const [error,setError]=useState(''),[busy,setBusy]=useState('');
  const t=(en:string,he:string)=>hebrew?he:en;
  async function update(id:string, restore=false) {
    setBusy(id);setError('');
    try {await api(`/films/${film.id}/versions/${id}${restore?'/restore':''}`,restore?{}:undefined,restore?'POST':'DELETE');await onChanged();}catch(e){setError((e as Error).message);}finally{setBusy('');}
  }
  const archived=(film.archivedVersions || []).filter((v:Row)=>!entityId||v.entityId===entityId);
  return <section>
    {!archiveOnly && <><h3>{t('Images & generation history', 'תמונות והיסטוריית יצירה')}</h3><div className="asset-version-grid">
      {film.versions.filter(v=>!entityId||v.entityId===entityId).slice().reverse().map(v=><article key={v.id}>
        <div className="asset-thumb"><Media version={v}/></div>
        <strong>{v.assetView && (ASSET_VIEWS as Row)[v.assetView] ? t((ASSET_VIEWS as Row)[v.assetView].en,(ASSET_VIEWS as Row)[v.assetView].he) + ' · ' : ''}{v.label || v.model} · v{v.number}</strong><Status value={v.status}/>
        {v.error && <p className="error">{typeof v.error==='string'?v.error:JSON.stringify(v.error)}</p>}
        <div className="row-actions"><Button type="button" size="sm" disabled={!v.localPath} onClick={()=>onReview(v.id)}>{t('Open / review', 'הגדלה / בדיקה')}</Button>
        {onRevise && <Button type="button" size="sm" variant="outline" onClick={()=>onRevise(v.id)}>{t('Retry / revise', 'ניסיון חוזר / תיקון')}</Button>}
        <Button type="button" size="sm" variant="outline" disabled={busy===v.id} onClick={()=>update(v.id)}>{t('Move to archive', 'העברה לארכיון')}</Button></div>
      </article>)}
    </div></>}
    <details><summary>{t('Archived versions · restore', 'גרסאות בארכיון · שחזור')} ({archived.length})</summary>
      {archived.map((v:Row)=><div key={v.id} className="row-actions"><span>{v.label || v.model} · {v.kind}</span><Button type="button" variant="outline" disabled={busy===v.id} onClick={()=>update(v.id,true)}>{t('Restore', 'שחזור')}</Button></div>)}
    </details>
    {error && <p role="alert" className="error">{error}</p>}
  </section>;
}
