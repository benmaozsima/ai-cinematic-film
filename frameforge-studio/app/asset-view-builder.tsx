'use client';
import {useState} from 'react';
import {Button} from '@/components/ui/button';
import {Pick,Media} from './studio-ui';
import {ASSET_VIEWS} from '../shared/asset-views.mjs';
import {type Film,type Row} from './studio-types';
export function AssetViewBuilder({film,entity,hebrew,onGenerate}:{film:Film;entity:Row;hebrew:boolean;onGenerate:(view:string,base:string)=>void}) {
  const [view,setView]=useState('master'),[base,setBase]=useState('');
  const t=(en:string,he:string)=>hebrew?he:en;
  const approved=film.versions.filter(v=>v.entityId===entity.id&&v.kind==='image'&&v.localPath&&v.status==='approved'&&v.reviewBibleRevision===film.bibleRevision);
  const source=approved.find(v=>v.id===base)||approved.find(v=>v.assetView==='master')||approved[0];
  const choices=Object.entries(ASSET_VIEWS).filter(([,v])=>v.types.includes(entity.type));
  return <section className="asset-view-builder">
    <h3>{t('Build the reference set','בניית חבילת הרפרנסים')}</h3>
    <p>{t('Create and approve a master first. Generate each additional angle separately from an approved image.', 'יוצרים ומאשרים תמונת בסיס. כל זווית נוספת נוצרת בנפרד מתוך תמונה מאושרת ונשמרת לבדיקה.')}</p>
    <div className="row-actions">{choices.map(([id,v])=><Button key={id} type="button" variant={view===id?'secondary':'outline'} size="sm" onClick={()=>setView(id)}>{t(v.en,v.he)}</Button>)}</div>
    {view!=='master' && <>
      {source ? <><Pick value={source.id} onChange={setBase} label={t('Approved source image','תמונת הבסיס המאושרת')} items={approved.map(v=>({value:v.id,label:`${v.label} · v${v.number}`}))}/><div className="asset-view-base"><Media version={source}/></div></> : <p role="status">{t('Approve a reference image in the gallery below first.','יש לאשר קודם תמונת רפרנס בגלריה למטה.')}</p>}
    </>}
    <Button type="button" disabled={view!=='master'&&!source} onClick={()=>onGenerate(view,view==='master'?'':source!.id)}>{t('Prepare this image','הכנת התמונה הזאת')}</Button>
    <small>{t('Choose the model and review cost before submitting. Each result needs review.','בהמשך בוחרים מודל ובודקים עלות לפני השליחה. כל תוצאה דורשת בדיקה.')}</small>
  </section>;
}
