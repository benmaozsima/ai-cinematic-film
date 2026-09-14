'use client';
import {useState} from 'react';
import {Button} from '@/components/ui/button';
import {Media, Pick} from './studio-ui';
import {api, type Film, type Row} from './studio-types';
export function ShotAssets({film,shot,hebrew,onChanged,onEntity}: {film:Film;shot:Row;hebrew:boolean;onChanged:()=>Promise<unknown>;onEntity:(id:string)=>void}) {
  const t=(en:string,he:string)=>hebrew?he:en;
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[candidate,setCandidate]=useState('');
  const ids=[...new Set<string>([...(shot.entityIds||[]),...(shot.locationEntityIds||[])])];
  const linked=film.entities.filter(e=>ids.includes(e.id));
  async function update(id:string,remove=false) {
    setBusy(true);setError('');
    try {await api(`/films/${film.id}/shots/${shot.id}`,{entityIds:remove?ids.filter(e=>e!==id):[...new Set([...ids,id])]},'PATCH');await onChanged();setCandidate('');}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function location() {
    setBusy(true);setError('');
    try{await api(`/films/${film.id}/shots/${shot.id}/prepare-locations`,{});await onChanged();}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <section className="shot-assets panel">
    <h3>{t('The people, place and props in this shot', 'הדמויות, המקום והאביזרים בשוט הזה')}</h3>
    <p>{t('Open an asset to create or review its references. Approved images are available when generating this shot.', 'פתחו נכס כדי ליצור או לבדוק את הרפרנסים שלו. התמונות המאושרות זמינות ליצירת השוט.')}</p>
    <div className="shot-asset-grid">
      {linked.map(e=>{
        const refs=(e.referenceVersionIds||[]).map((id:string)=>film.versions.find(v=>v.id===id)).filter((v:Row|undefined)=>v?.localPath && v.status==='approved' && v.reviewBibleRevision===film.bibleRevision);
        const versions=film.versions.filter(v=>v.entityId===e.id);
        const preview=refs[0]||versions.slice().reverse().find(v=>v.localPath && v.status!=='rejected');
        const working=versions.some(v=>['queued','running','submission_unknown'].includes(v.status));
        return <article key={e.id}>
          <button className="shot-asset-open" onClick={()=>onEntity(e.id)}><div className="asset-thumb"><Media version={preview}/></div><strong>{e.name}</strong>
          <small>{working?t('Generating…','יצירה בתהליך…'):refs.length?`${refs.length} ${t('approved references','רפרנסים מאושרים')}`:preview?t('Image awaiting review','תמונה ממתינה לבדיקה'):t('Reference image missing','חסרה תמונת רפרנס')}</small></button>
          <div className="row-actions"><Button size="sm" variant="outline" onClick={()=>onEntity(e.id)}>{t('Create / review', 'יצירה / בדיקה')}</Button><Button size="sm" variant="ghost" disabled={busy} onClick={()=>update(e.id,true)}>{t('Unlink from shot','הסרה מהשוט')}</Button></div>
        </article>;
      })}
    </div>
    {!linked.some(e=>e.type==='location') && <Button variant="secondary" disabled={busy} onClick={location}>{t('Prepare the location from this scene', 'הכנת נכס מקום לפי הסצנה הזאת')}</Button>}
    <details><summary>{t('Add more references to this shot','הוספת עוד נכסים לשוט')}</summary>
      <div className="row-actions">
        <Pick value={candidate} onChange={setCandidate} label={t('Asset from this film','נכס מתוך הסרט')} items={film.entities.filter(e=>!ids.includes(e.id)).map(e=>({value:e.id,label:`${e.name} · ${t(e.type,({character:'דמות',location:'מקום',prop:'אביזר',style:'סגנון',voice:'קול'} as Row)[e.type]||e.type)}`}))}/>
        <Button disabled={busy||!candidate} onClick={()=>update(candidate)}>{t('Link to shot','קישור לשוט')}</Button>
        <Button variant="outline" onClick={()=>onEntity('')}>{t('Create a new bible entry','הוספת נכס חדש לספר ההפקה')}</Button>
      </div>
    </details>
    {error && <p className="error" role="alert">{error}</p>}
  </section>;
}
