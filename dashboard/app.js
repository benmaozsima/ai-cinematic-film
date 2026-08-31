const shots=[
 {id:'S001',time:'0:00–0:03',title:'הטקס',action:'בד עובר על הנעל השחורה המצוחצחת.',dialogue:'אין',sound:'בד, שעון חלש, חדר שקט'},
 {id:'S002',time:'0:03–0:06',title:'שוקו א׳ מול המראה',action:'שוקו א׳ מסרק פעם אחת את שיערו הכסוף.',dialogue:'אין',sound:'מסרק, המשך השעון'},
 {id:'S003',time:'0:06–0:10',title:'שוקו ה׳ לא עונה',action:'הטלפון מציג שיחות שלא נענו; שוקו א׳ לוקח כובע ומקל.',dialogue:'שוקו א׳: „שוקו לא עונה. אני הולך לבדוק.”',sound:'הרטט נפסק, המקל מורם'},
 {id:'S004',time:'0:10–0:14',title:'המסלול מתחיל',action:'שוקו א׳ יוצא לשכונה והולך לעבר הדלת הראשונה.',dialogue:'אין',sound:'צעדים, מקל, תחילת קצב'},
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
const grid=document.querySelector('#shotGrid'),dialog=document.querySelector('#shotDialog'),content=document.querySelector('#dialogContent');
const approvals=JSON.parse(localStorage.getItem('shotApprovals')||'{}');
function render(filter='all'){
 grid.innerHTML='';
 shots.filter(s=>filter==='all'||(filter==='dialogue'&&s.dialogue!=='אין')||(filter==='silent'&&s.dialogue==='אין')).forEach(s=>{
  const card=document.createElement('button'); card.className='shot-card'; card.dataset.id=s.id;
  card.innerHTML=`<div class="shot-top"><span class="shot-id">${s.id}</span><span class="shot-time">${s.time}</span></div><h3>${s.title}</h3><p>${s.action}</p>${s.dialogue!=='אין'?'<span class="dialogue-mark">● דיאלוג</span>':''}${approvals[s.id]?'<span class="approved-badge"> · ✓ מאושר מקומית</span>':''}`;
  card.addEventListener('click',()=>openShot(s)); grid.appendChild(card);
 });
}
function openShot(s){
 content.innerHTML=`<div class="dialog-body"><span class="shot-number">${s.id} · ${s.time}</span><h2>${s.title}</h2><div class="dialog-section"><strong>מה רואים</strong><p>${s.action}</p></div><div class="dialog-section"><strong>דיאלוג</strong><p>${s.dialogue.replaceAll('\n','<br>')}</p></div><div class="dialog-section"><strong>סאונד</strong><p>${s.sound}</p></div><button class="button ${approvals[s.id]?'ghost':'primary'} approve-shot">${approvals[s.id]?'ביטול אישור מקומי':'אישור מקומי של השוט'}</button></div>`;
 content.querySelector('.approve-shot').onclick=()=>{approvals[s.id]=!approvals[s.id];if(!approvals[s.id])delete approvals[s.id];localStorage.setItem('shotApprovals',JSON.stringify(approvals));dialog.close();render(document.querySelector('.shot-filters .active').dataset.filter)};
 dialog.showModal();
}
document.querySelector('.dialog-close').onclick=()=>dialog.close();dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});
document.querySelectorAll('.shot-filters button').forEach(b=>b.onclick=()=>{document.querySelector('.shot-filters .active').classList.remove('active');b.classList.add('active');render(b.dataset.filter)});
const note=document.querySelector('#reviewNote'),message=document.querySelector('#reviewMessage');note.value=localStorage.getItem('marchReview')||'';
document.querySelector('#saveReview').onclick=()=>{localStorage.setItem('marchReview',note.value);message.textContent='נשמר בדפדפן הזה.'};
document.querySelector('#copyReview').onclick=async()=>{const text=`משוב חבילת צעדה S009–S012:\n${note.value}`;try{await navigator.clipboard.writeText(text);message.textContent='המשוב הועתק. אפשר להדביק בצ׳אט.'}catch{message.textContent='לא ניתן להעתיק אוטומטית; סמן והעתק את הטקסט.'}};
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
render();
