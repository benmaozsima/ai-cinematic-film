'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Media } from './studio-ui';
import { api, type Film, type Row } from './studio-types';

export function ProductionBoard({film, sceneId, shotId, onOpen, onAssets, hebrew}: {
  film: Film; sceneId?: string; shotId?: string; hebrew: boolean;
  onOpen: (sceneId: string, shotId: string, stage: string) => void; onAssets: () => void;
}) {
  const t = (en: string, he: string) => hebrew ? he : en;
  return <details className="production-board" open>
    <summary>{t('Your film · choose a scene or shot', 'הסרט שלך · בוחרים סצנה או שוט')}</summary>
    <p>{t('Finish one shot or work across the film. You can return to any stage.', 'אפשר לסיים שוט אחד, או לעבוד על כל הסרט לפי שלבים. תמיד אפשר לחזור.')}</p>
    <Button variant="outline" onClick={onAssets}>{t('Characters, locations & props', 'דמויות, מקומות ואביזרים · תמונות ורפרנסים')}</Button>
    <div className="production-scenes">
      {film.scenes.map((scene, index) => <details key={scene.id} open={scene.id === sceneId}>
        <summary>{String(index + 1).padStart(2, '0')} · {scene.title}<small>{scene.summary}</small></summary>
        <div className="production-shots">
          {film.shots.filter(s => s.sceneId === scene.id).sort((a,b)=>a.order-b.order).map(shot => {
            const versions = film.versions.filter(v => v.shotId === shot.id);
            const image = [...versions].reverse().find(v=>v.kind==='image' && v.localPath && v.status!=='rejected');
            const video = [...versions].reverse().find(v=>v.kind==='video' && v.localPath && v.status!=='rejected');
            const waiting = versions.filter(v=>['queued','running','submission_unknown'].includes(v.status));
            const ready = (v?: Row) => v?.status==='approved' && v.reviewBibleRevision===film.bibleRevision;
            const stage = !ready(image) ? 'keyframe' : !ready(video) ? 'video' : 'cut';
            return <article key={shot.id} className={shot.id===shotId ? 'active' : ''}>
              <div className="production-thumb"><Media version={image} /></div>
              <strong>{shot.code} · {shot.title}</strong>
              <small>{shot.duration}s · {waiting.length ? t('Generation in progress', 'יצירה בתהליך') : video ? t('Video available', 'יש סרטון') : image ? t('Image available', 'יש תמונה') : t('Planned', 'מתוכנן')}</small>
              <div className="row-actions">
                <Button size="sm" onClick={()=>onOpen(scene.id,shot.id,stage)}>{t('Continue this shot', 'המשך העבודה על השוט')}</Button>
                {(['keyframe','video','sound'] as const).map((s,i)=><Button key={s} size="sm" variant="outline" onClick={()=>onOpen(scene.id,shot.id,s)}>{t(['Images','Video','Sound'][i],['תמונות','וידאו','סאונד'][i])}</Button>)}
              </div>
            </article>;
          })}
          <Button variant="outline" onClick={()=>onOpen(scene.id,'','shots')}>{t('Plan / edit this scene', 'תכנון / עריכת הסצנה הזאת')}</Button>
        </div>
      </details>)}
    </div>
  </details>;
}

export function ShotConnection({film, shot, onChanged, onReview, hebrew}: {film: Film; shot: Row; hebrew: boolean; onChanged:()=>Promise<unknown>; onReview:(id:string)=>void}) {
  const [busy,setBusy]=useState(false), [error,setError]=useState('');
  const previous = [...film.shots].sort((a,b)=>a.order-b.order);
  const source = previous[previous.findIndex(s=>s.id===shot.id)-1];
  if (!source) return null;
  const video = film.versions.find(v=>v.id===source.selectedVersionId && v.kind==='video' && v.localPath);
  const t=(en:string,he:string)=>hebrew?he:en;
  async function save(mode: string) {
    setBusy(true); setError('');
    try {
      if(mode==='continue' && video) {
        const result = await api(`/films/${film.id}/versions/${video.id}/frame`, {at:'end',targetShotId:shot.id});
        await onChanged();
        const frame = result.versions?.find((v:Row)=>v.id===result.shots.find((s:Row)=>s.id===shot.id)?.connection?.frameVersionId);
        if(frame) onReview(frame.id);
      } else { await api(`/films/${film.id}/shots/${shot.id}`,{connection:{mode:'cut'}},'PATCH'); await onChanged(); }
    } catch(e) {setError((e as Error).message);} finally{setBusy(false);}
  }
  const link=shot.connection;
  const stale=link?.mode==='continue' && (link.sourceVersionId!==video?.id || link.sourceShotId!==source.id || link.sourceTrimIn!==(source.trimIn || 0) || link.sourceDuration!==source.duration);
  return <section className="shot-connection panel">
    <strong>{t('Connection from', 'החיבור מתוך')} {source.code} → {shot.code}</strong>
    <p>{t('Continue from the previous cut’s last frame, or start a new camera angle. Review motion and sound at the seam.', 'המשך מהפריים האחרון בעריכה, או חיתוך לזווית חדשה. יש לבדוק גם את התנועה והסאונד במעבר.')}</p>
    <div className="row-actions">
      <Button variant={link?.mode!=='continue'?'secondary':'outline'} disabled={busy} onClick={()=>save('cut')}>{t('Camera cut', 'חיתוך לזווית חדשה')}</Button>
      <Button variant={link?.mode==='continue'?'secondary':'outline'} disabled={busy||!video} onClick={()=>save('continue')}>{busy?t('Saving…','שומר…'):t('Use previous last frame', 'הכנת פריים פתיחה מסוף השוט הקודם')}</Button>
      {link?.frameVersionId && <Button variant="outline" onClick={()=>onReview(link.frameVersionId)}>{t('Review connection frame', 'בדיקת פריים החיבור')}</Button>}
    </div>
    {!video && <small>{t('Select a video in the previous shot’s cut first.', 'כדי ליצור המשך, בחרו קודם סרטון לעריכה בשוט הקודם.')}</small>}
    {stale && <p role="alert" className="error">{t('Previous video changed. Refresh the connection frame.', 'הסרטון הקודם הוחלף. יש להכין מחדש את פריים החיבור.')}</p>}
    {error && <p role="alert" className="error">{error}</p>}
  </section>;
}
