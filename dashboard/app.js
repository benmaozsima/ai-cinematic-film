const shots=[
 {id:'S001',time:'0:00–0:03',title:'הטקס',action:'בד עובר על הנעל השחורה המצוחצחת.',dialogue:'אין',sound:'בד, שעון חלש, חדר שקט'},
 {id:'S002',time:'0:03–0:06',title:'יוסי מול המראה',action:'יוסי מסרק פעם אחת את שיערו הכסוף.',dialogue:'אין',sound:'מסרק, המשך השעון'},
 {id:'S003',time:'0:06–0:10',title:'שוקו לא עונה',action:'הטלפון מציג שיחות שלא נענו; יוסי לוקח כובע ומקל.',dialogue:'יוסי: „שוקו לא עונה. אני הולך לבדוק.”',sound:'הרטט נפסק, המקל מורם'},
 {id:'S004',time:'0:10–0:14',title:'המסלול מתחיל',action:'יוסי יוצא לשכונה והולך לעבר הדלת הראשונה.',dialogue:'אין',sound:'צעדים, מקל, תחילת קצב'},
 {id:'S005',time:'0:14–0:18',title:'הדלת הראשונה',action:'החבר הראשון פותח; יוסי שואל על שוקו.',dialogue:'יוסי: „ראית את שוקו?”',sound:'רחוב שקט, נקישת מקל'},
 {id:'S006',time:'0:18–0:22',title:'החבר מצטרף',action:'החבר נועל את הדלת ויוצא עם תיק גדול.',dialogue:'CHAR_003: „לא. אני בא איתך.”',sound:'מנעול, רצועת תיק'},
 {id:'S007',time:'0:22–0:26',title:'מוטי',action:'מוטי יוצא מבית הקפה עם קפה ומאפה ומצטרף.',dialogue:'אין',sound:'קפה, כוס, צעדים'},
 {id:'S008',time:'0:26–0:30',title:'אבי והמפתח',action:'אבי מציג מפתח ספייר גדול ומצטרף.',dialogue:'אין',sound:'צלצול מפתח'},
 {id:'S009',time:'0:30–0:34',title:'המחווה',action:'ארבעת הגברים צועדים בטור מסודר ורציני.',dialogue:'אין',sound:'צעדים, מקל, מוזיקה מקורית'},
 {id:'S010',time:'0:34–0:37',title:'תיאוריית אילת',action:'הגברים ממשיכים ללכת כאילו הם באמצע חקירה.',dialogue:'מוטי: „אולי הוא נסע לאילת.”\nCHAR_003: „שוקו לא אוהב חול.”',sound:'דיאלוג מעל קצב ההליכה'},
 {id:'S011',time:'0:37–0:41',title:'הבניין של שוקו',action:'הקבוצה מגיעה לבניין; באס וצחוק דולפים החוצה.',dialogue:'אין',sound:'באס עמום, צחוק'},
 {id:'S012',time:'0:41–0:44',title:'הדפיקה',action:'כולם מביטים ביוסי. הוא דופק והמוזיקה נפסקת.',dialogue:'אין',sound:'דפיקה, שקט פתאומי'},
 {id:'S013',time:'0:44–0:49',title:'חשיפת האפטר',action:'הדלת נפתחת על שוקו יחף במשקפי שמש ומסיבה חמה.',dialogue:'אין',sound:'המוזיקה חוזרת בעדינות'},
 {id:'S014',time:'0:49–0:54',title:'ההיפוך',action:'יוסי ושוקו עומדים משני צדי הדלת.',dialogue:'יוסי: „חיפשנו אותך בכל השכונה.”\nשוקו: „אותי? אני חיכיתי לכם.”',sound:'דיאלוג, הפסקה קומית'},
 {id:'S015',time:'0:54–0:57',title:'נכנסים',action:'מוטי לוקח כוס ונכנס; האחרים אחריו.',dialogue:'אין',sound:'כוס, צחוק'},
 {id:'S016',time:'0:57–1:00',title:'הפאנץ׳',action:'יוסי מחייך ונכנס. הדלת נסגרת.',dialogue:'קול: „מי הזמין את ועד הבית?”',sound:'הפאנץ׳ מתוך הדירה'}
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
render();
