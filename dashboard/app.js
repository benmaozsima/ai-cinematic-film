const shots=[
 {id:'S001',time:'0:00–0:03',title:'הטקס',action:'בד עובר על הנעל השחורה המצוחצחת.',dialogue:'אין',sound:'בד, שעון חלש, חדר שקט',image:'../assets/keyframes/S001_real_v0.1.png'},
 {id:'S002',time:'0:03–0:06',title:'שוקו א׳ מול המראה',action:'שוקו א׳ מסרק פעם אחת את שיערו הכסוף.',dialogue:'אין',sound:'מסרק, המשך השעון',image:'../assets/keyframes/S002_real_v0.2.png'},
 {id:'S003',time:'0:06–0:10',title:'שוקו ה׳ לא עונה',action:'הטלפון מציג שיחות שלא נענו; שוקו א׳ לוקח כובע ומקל.',dialogue:'שוקו א׳: „שוקו לא עונה. אני הולך לבדוק.”',sound:'הרטט נפסק, המקל מורם',image:'../assets/keyframes/S003_real_v0.2.png'},
 {id:'S004',time:'0:10–0:14',title:'המסלול מתחיל',action:'שוקו א׳ יוצא לשכונה והולך לעבר הדלת הראשונה.',dialogue:'אין',sound:'צעדים, מקל, תחילת קצב',image:'../assets/keyframes/S004_real_v0.1.png'},
 {id:'S005',time:'0:14–0:18',title:'הדלת הראשונה',action:'שוקו ב׳ פותח; שוקו א׳ שואל על שוקו ה׳.',dialogue:'שוקו א׳: „ראית את שוקו?”',sound:'רחוב שקט, נקישת מקל'},
 {id:'S006',time:'0:18–0:22',title:'שוקו ב׳ מצטרף',action:'שוקו ב׳ נועל את הדלת ויוצא עם תיק גדול.',dialogue:'שוקו ב׳: „לא. אני בא איתך.”',sound:'מנעול, רצועת תיק'},
 {id:'S007',time:'0:22–0:26',title:'שוקו ג׳',action:'שוקו ג׳ יוצא מבית הקפה עם קפה ומאפה ומצטרף.',dialogue:'אין',sound:'קפה, כוס, צעדים'},
 {id:'S008',time:'0:26–0:30',title:'שוקו ד׳ והמפתח',action:'שוקו ד׳ מציג מפתח ספייר גדול ומצטרף.',dialogue:'אין',sound:'צלצול מפתח'},
 {id:'S009',time:'0:30–0:34',title:'המחווה',action:'ארבעת הגברים צועדים בטור מסודר ורציני.',dialogue:'אין',sound:'צעדים, מקל, מוזיקה מקורית'},
 {id:'S010',time:'0:34–0:37',title:'תיאוריית אילת',action:'הגברים ממשיכים ללכת כאילו הם באמצע חקירה.',dialogue:'שוקו ג׳: „אולי הוא נסע לאילת.”\nשוקו ב׳: „שוקו לא אוהב חול.”',sound:'דיאלוג מעל קצב ההליכה'},
 {id:'S011',time:'0:37–0:41',title:'הבניין של שוקו ה׳',action:'הקבוצה מגיעה לבניין; באס וצחוק דולפים החוצה.',dialogue:'אין',sound:'באס עמום, צחוק'},
 {id:'S012',time:'0:41–0:44',title:'הדפיקה',action:'כולם מביטים בשוקו א׳. הוא דופק והמוזיקה נפסקת.',dialogue:'אין',sound:'דפיקה, שקט פתאומי'},
 {id:'S013',time:'0:44–0:49',title:'חשיפת האפטר',action:'הדלת נפתחת על שוקו ה׳ יחף במשקפי שמש ומסיבה חמה.',dialogue:'אין',sound:'המוזיקה חוזרת בעדינות'},
 {id:'S014',time:'0:49–0:54',title:'ההיפוך',action:'שוקו א׳ ושוקו ה׳ עומדים משני צדי הדלת.',dialogue:'שוקו א׳: „חיפשנו אותך בכל השכונה.”\nשוקו ה׳: „אותי? אני חיכיתי לכם.”',sound:'דיאלוג, הפסקה קומית'},
 {id:'S015',time:'0:54–0:57',title:'נכנסים',action:'שוקו ג׳ לוקח כוס ונכנס; האחרים אחריו.',dialogue:'אין',sound:'כוס, צחוק'},
 {id:'S016',time:'0:57–1:00',title:'הפאנץ׳',action:'שוקו א׳ מחייך ונכנס. הדלת נסגרת.',dialogue:'קול: „מי הזמין את ועד הבית?”',sound:'הפאנץ׳ מתוך הדירה'}
];
const statusByShot={S001:'APPROVED',S002:'REVIEW',S003:'REVIEW',S004:'APPROVED',S005:'REVISE',S006:'MISSING',S007:'MISSING',S008:'MISSING',S009:'MISSING',S010:'MISSING',S011:'MISSING',S012:'MISSING',S013:'MISSING',S014:'MISSING',S015:'MISSING',S016:'MISSING'};
const statusLabel={APPROVED:'מאושר בריוויו',REVIEW:'חדש לבדיקה',REVISE:'לתיקון',MISSING:'חסר — עדיין לא נוצר'};
const grid=document.querySelector('#shotGrid'),dialog=document.querySelector('#shotDialog'),content=document.querySelector('#dialogContent');
const approvals=JSON.parse(localStorage.getItem('shotApprovals')||'{}');
function render(filter='all'){
 grid.innerHTML='';
 shots.filter(s=>filter==='all'||(filter==='dialogue'&&s.dialogue!=='אין')||(filter==='silent'&&s.dialogue==='אין')).forEach(s=>{
  const card=document.createElement('button'); card.className='shot-card'; card.dataset.id=s.id;
  const shotStatus=statusByShot[s.id]||'MISSING';
  card.innerHTML=`<div class="shot-top"><span class="shot-id">${s.id}</span><span class="shot-time">${s.time}</span></div><span class="shot-status ${shotStatus.toLowerCase()}">${statusLabel[shotStatus]}</span>${s.image?`<img class="shot-thumb" src="${s.image}" alt="${s.id} — תמונת סצנה אמיתית">`:''}<h3>${s.title}</h3><p>${s.action}</p>${s.dialogue!=='אין'?'<span class="dialogue-mark">● דיאלוג</span>':''}${approvals[s.id]?'<span class="approved-badge"> · ✓ מאושר מקומית</span>':''}`;
  card.addEventListener('click',()=>openShot(s)); grid.appendChild(card);
 });
}
function openShot(s){
 const shotStatus=statusByShot[s.id]||'MISSING';
 content.innerHTML=`<div class="dialog-body"><span class="shot-number">${s.id} · ${s.time}</span><h2>${s.title}</h2><p class="shot-status ${shotStatus.toLowerCase()}">${statusLabel[shotStatus]}</p>${s.image?`<img class="dialog-shot-image" src="${s.image}" alt="${s.id} — תמונת סצנה אמיתית">`:''}<div class="dialog-section"><strong>מה רואים</strong><p>${s.action}</p></div><div class="dialog-section"><strong>דיאלוג</strong><p>${s.dialogue.replaceAll('\n','<br>')}</p></div><div class="dialog-section"><strong>סאונד</strong><p>${s.sound}</p></div><button class="button ${approvals[s.id]?'ghost':'primary'} approve-shot">${approvals[s.id]?'ביטול אישור מקומי':'רישום ריוויו מקומי'}</button></div>`;
 content.querySelector('.approve-shot').onclick=()=>{approvals[s.id]=!approvals[s.id];if(!approvals[s.id])delete approvals[s.id];localStorage.setItem('shotApprovals',JSON.stringify(approvals));dialog.close();render(document.querySelector('.shot-filters .active').dataset.filter)};
 dialog.showModal();
}
document.querySelector('.dialog-close').onclick=()=>dialog.close();dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});
document.querySelectorAll('.shot-filters button').forEach(b=>b.onclick=()=>{document.querySelector('.shot-filters .active').classList.remove('active');b.classList.add('active');render(b.dataset.filter)});
const note=document.querySelector('#reviewNote'),message=document.querySelector('#reviewMessage');note.value=localStorage.getItem('marchReview')||'';
document.querySelector('#saveReview').onclick=()=>{localStorage.setItem('marchReview',note.value);message.textContent='נשמר בדפדפן הזה.'};
document.querySelector('#copyReview').onclick=async()=>{const text=`משוב וידאו S001 v0.1:\n${note.value}`;try{await navigator.clipboard.writeText(text);message.textContent='המשוב הועתק. אפשר להדביק בצ׳אט.'}catch{message.textContent='לא ניתן להעתיק אוטומטית; סמן והעתק את הטקסט.'}};
const charReviewKey='char001ReferenceV02Review';
const charNote=document.querySelector('#char001Note'),charMessage=document.querySelector('#char001ReviewMessage'),charStatus=document.querySelector('#char001Status');
const savedCharReview=JSON.parse(localStorage.getItem(charReviewKey)||'{}');
charNote.value=savedCharReview.note||'';
function renderCharReview(){
 const decision=savedCharReview.decision;
 charStatus.textContent=decision||'REVIEW';
 charStatus.className=`tag ${decision==='APPROVE'?'designed':'review'}`;
 document.querySelectorAll('[data-char-review]').forEach(button=>button.classList.toggle('selected',button.dataset.charReview===decision));
}
document.querySelectorAll('[data-char-review]').forEach(button=>button.onclick=()=>{
 savedCharReview.decision=button.dataset.charReview;
 savedCharReview.note=charNote.value;
 localStorage.setItem(charReviewKey,JSON.stringify(savedCharReview));
 charMessage.textContent=`${savedCharReview.decision} נשמר בדפדפן בלבד. יש להעביר את ההחלטה לריפו כדי שתהפוך לקאנונית.`;
 renderCharReview();
});
charNote.addEventListener('change',()=>{savedCharReview.note=charNote.value;localStorage.setItem(charReviewKey,JSON.stringify(savedCharReview))});
renderCharReview();
const videoReviewKeys={S001:'s001VideoV01Review',S002:'s002VideoV02Review',S003:'s003VideoV02Review'};
const savedVideoReviews={S001:JSON.parse(localStorage.getItem(videoReviewKeys.S001)||'{}'),S002:JSON.parse(localStorage.getItem(videoReviewKeys.S002)||'{}'),S003:JSON.parse(localStorage.getItem(videoReviewKeys.S003)||'{}')};
Object.keys(videoReviewKeys).forEach(shot=>{const note=document.querySelector(`#${shot.toLowerCase()}VideoNote`);if(note)note.value=savedVideoReviews[shot].note||''});
async function loadReviewMedia(){
 try{
  const response=await fetch('../data/media_registry_v0.1.json',{cache:'no-store'});
  if(!response.ok)throw new Error(`registry ${response.status}`);
  const registry=await response.json();
  document.querySelectorAll('video[data-media-id]').forEach(video=>{
   const media=registry.media.find(item=>item.media_id===video.dataset.mediaId);
   if(!media?.review_url)throw new Error(`review URL missing for ${video.dataset.mediaId}`);
   video.src=media.review_url;
   const message=document.querySelector(`#${video.id.replace('ReviewVideo','MediaMessage')}`);
   if(message)message.textContent='הווידאו נטען מאחסון חיצוני; הקובץ אינו שמור ב־Git.';
  });
 }catch(error){
  document.querySelectorAll('.media-message').forEach(message=>{message.textContent='הווידאו אינו זמין כרגע. המטא־דאטה וה־SHA נשמרו; יש לסנכרן את קובץ ה־outputs לאחסון חיצוני.'});
 }
}
const sequenceOrder=['S001','S002','S003'];
let sequenceItems=[],sequenceIndex=0,sequenceSelections=JSON.parse(localStorage.getItem('sequenceSelections')||'{}');
function renderSequenceList(){
 const list=document.querySelector('#sequenceList'); if(!list)return;
 list.innerHTML='';
 sequenceItems.forEach((item,index)=>{const li=document.createElement('li');const selected=item.variants.find(v=>v.media_id===sequenceSelections[item.shot_id])||item.variants[item.variants.length-1];li.className='sequence-item '+(index===sequenceIndex?'active ':'')+(selected?'available':'missing');let options=item.variants.map(v=>'<option value="'+v.media_id+'" '+(selected&&v.media_id===selected.media_id?'selected':'')+'>'+v.version+' · '+v.review_status+'</option>').join('');li.innerHTML='<div class="sequence-row"><span class="sequence-shot-id">'+item.shot_id+'</span><div><strong>'+item.title+'</strong><small>'+(selected?'גרסה נבחרת: '+selected.version:'חסר — טרם נוצר')+'</small></div><select aria-label="בחירת גרסה עבור '+item.shot_id+'" '+(selected?'':'disabled')+'>'+options+'</select></div>';const select=li.querySelector('select');if(select)select.onchange=()=>{sequenceSelections[item.shot_id]=select.value;localStorage.setItem('sequenceSelections',JSON.stringify(sequenceSelections));if(index===sequenceIndex)setSequenceSource();else renderSequenceList()};li.querySelector('.sequence-row').onclick=e=>{if(e.target===select)return;if(selected){sequenceIndex=index;setSequenceSource()}else{document.querySelector('#sequenceMessage').textContent=item.shot_id+' עדיין חסר; אי אפשר להוסיף אותו לרצף.';renderSequenceList()}};list.appendChild(li)});
}
function setSequenceSource(){
 const item=sequenceItems[sequenceIndex],selected=item&& (item.variants.find(v=>v.media_id===sequenceSelections[item.shot_id])||item.variants[item.variants.length-1]),video=document.querySelector('#sequenceVideo'); if(!item||!video)return;
 document.querySelector('#sequenceCurrentLabel').textContent=item.shot_id+' · '+item.title+' · '+(selected?selected.version:'חסר');
 document.querySelector('#sequenceCurrentStatus').textContent=selected?'זמין לצפייה':'חסר';
 if(selected){sequenceSelections[item.shot_id]=selected.media_id;localStorage.setItem('sequenceSelections',JSON.stringify(sequenceSelections));video.src=selected.review_url;video.load();document.querySelector('#sequenceMessage').textContent='הקליפ נטען מאחסון חיצוני; לחץ Play כדי להתחיל.'}else{video.removeAttribute('src');video.load();document.querySelector('#sequenceMessage').textContent='השוט הזה עדיין לא נוצר.'}
 renderSequenceList();
}
async function loadSequence(){
 try{const response=await fetch('../data/media_registry_v0.1.json',{cache:'no-store'});if(!response.ok)throw new Error('registry');const registry=await response.json();const titles={S001:'הטקס',S002:'שוקו א׳ מול המראה',S003:'שוקו ה׳ לא עונה'};sequenceItems=sequenceOrder.map(shot=>{const variants=registry.media.filter(item=>item.shot_id===shot&&item.kind==='video'&&item.review_url);return{shot_id:shot,title:titles[shot]||shot,variants}});renderSequenceList();setSequenceSource()}catch{document.querySelector('#sequenceMessage').textContent='לא ניתן לטעון את Media Registry כרגע.'}}
document.querySelector('#sequenceVideo')?.addEventListener('ended',()=>{let next=sequenceIndex+1;while(next<sequenceItems.length&&!sequenceItems[next].media)next++;if(next<sequenceItems.length){sequenceIndex=next;setSequenceSource();document.querySelector('#sequenceVideo').play().catch(()=>{})}else document.querySelector('#sequenceMessage').textContent='סוף הקליפים הקיימים. השוטים החסרים נשארו מסומנים ברשימה.'});
function renderVideoReview(shot){
 const decision=savedVideoReviews[shot].decision;
 const displayDecision=decision||'REVIEW';
 const status=document.querySelector(`#${shot.toLowerCase()}VideoStatus`);
 if(status){status.textContent=displayDecision;status.className=`tag ${displayDecision==='APPROVE'?'designed':'review'}`}
 document.querySelectorAll(`[data-video-review-shot="${shot}"]`).forEach(button=>button.classList.toggle('selected',button.dataset.videoReview===decision));
}
Object.keys(videoReviewKeys).forEach(shot=>renderVideoReview(shot));
document.querySelectorAll('[data-video-review-shot]').forEach(button=>button.onclick=()=>{
 const shot=button.dataset.videoReviewShot,review=savedVideoReviews[shot];
 review.decision=button.dataset.videoReview;
 review.note=document.querySelector(`#${shot.toLowerCase()}VideoNote`)?.value||'';
 localStorage.setItem(videoReviewKeys[shot],JSON.stringify(review));
 const message=document.querySelector(`#${shot.toLowerCase()}VideoReviewMessage`);
 if(message)message.textContent=`${review.decision} נשמר בדפדפן בלבד. שלח את ההחלטה בצ׳אט כדי שאעדכן את הקאנון.`;
 renderVideoReview(shot);
});
Object.keys(videoReviewKeys).forEach(shot=>{const note=document.querySelector(`#${shot.toLowerCase()}VideoNote`);note?.addEventListener('change',()=>{savedVideoReviews[shot].note=note.value;localStorage.setItem(videoReviewKeys[shot],JSON.stringify(savedVideoReviews[shot]))})});
loadReviewMedia();
loadSequence();
render();
