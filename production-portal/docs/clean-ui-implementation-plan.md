# Film OS — תכנית מימוש סופית ל־UI ולזרימות

## מטרת המוצר

פורטל הפקה אחד שבו אפשר לבנות סרטים שונים, לשמור מקור אמת לכל פרויקט, לייצר נכסים דרך ספקים מתחלפים, לבדוק אותם, לבחור גרסאות ולהוציא סרט מחובר — בלי עריכת קוד ובלי אובדן היסטוריה.

## עקרונות שאינם משתנים

- מזהים קנוניים (`CHAR_`, `PROP_`, `LOC_`, `S###`) נשארים יציבים לאורך כל חיי הפרויקט.
- כל תוצר חדש הוא asset revision. אין דריסה של קובץ קודם.
- `active revision` הוא בחירה מפורשת; רק הוא נכנס ל־delivery manifest.
- וידאו לא נשלח אם תמונת המקור הדרושה אינה מאושרת.
- כל run שומר prompt, negative prompt, מודל, ספק, inputs, references, quote ו־approval.
- סודות נשארים ב־Worker/runtime. הדפדפן מקבל מצב חיבור בלבד.
- פעולת חיוב תמיד עוברת dry-run → quote → אישור מפורש → job.

## מבנה הניווט החדש

### 1. Command Center

מסך פתיחה ממוקד עבודה: סטטוס הפרויקט, מה חסום, מה מחכה לריוויו, jobs פעילים, תקציב, ו־Continue next action. אין טקסט הסבר ארוך לפני הפעולה.

### 2. Canvas / Builder

משטח לבניית סצנות ושוטים. כל שוט מציג בחירת דמויות, אביזרים, לוקיישן, start/end frame, פעולה, דיאלוג, סאונד ומודל. בחירות מגיעות מהספריות בלבד; פריט חדש נשמר תחילה כטיוטה קנונית.

### 3. Timeline

רצף אופקי של השוטים. בכל כרטיס: thumbnail של ה־active asset, סטטוס תמונה וסטטוס וידאו בנפרד, מספר גרסאות, continuity flags ופעולת בחירת גרסה. בחירה מעדכנת את manifest ומציגה זאת מיד.

### 4. Review

תבנית אחידה עם וריאציה לפי סוג מדיה:

- תמונה: orientation, זהות דמות, אביזרים, אנטומיה, קומפוזיציה וטקסט לא רצוי.
- וידאו: תנועה, continuity, גליצ׳ים לאורך זמן, דיאלוג/שפתיים, אודיו וסיום/התחלה.

כל סעיף הוא סימון אופציונלי לצורך אישור או הערה; החזרת תיקון אינה נחסמת בגלל checklist חלקי.

### 5. Asset Library

חיפוש וסינון לפי פרויקט, kind, דמות, שוט, גרסה, סטטוס, מודל ותאריך. כל נכס מציג מקור, גרסאות, prompt ו־run record, עם Promote/Restore ברורים.

### 6. Model Lab

קטלוג capabilities במקום רשימת שמות קשיחה: `image`, `i2v`, `reference-to-video`, `native-audio`, `lip-sync`, `upscale`, `first/last-frame`. בחירה ידנית או Auto עם הסבר קצר, אומדן עלות ו־input contract.

### 7. Delivery

בחירת גרסה פעילה לכל שוט, בדיקות מוכנות, preview רציף עם preload, חיבור FFmpeg בצד שרת, checksum והורדת MP4 אמיתי. אם יש חסם — מוצג מה חסר ואיזה שוט אחראי לו.

### 8. Settings

מצב ספקים, שמות מפתחות, בדיקת חיבור, הרשאות ותקציב. אין הצגת סודות. כל שינוי נרשם ב־audit log.

## מודל מצב מרכזי

`planned → quoted → awaiting_approval → queued → running → review → approved | revise | rejected → promoted → deliverable`

המעברים ייבדקו בצד השרת. ה־UI רק מציג פעולות מותרות לפי המצב ולא משנה סטטוס מקומית ללא API.

## ארכיטקטורת ספקים

Adapter אחיד לכל ספק:

```ts
interface ProviderAdapter {
  quote(input: GenerationRequestSnapshot): Promise<PaidApprovalSnapshot>;
  submit(approval: PaidApprovalSnapshot): Promise<{ providerRequestId: string }>;
  status(providerRequestId: string): Promise<RunStatus>;
  normalizeResult(result: unknown): Promise<NormalizedAssetResult>;
}
```

Fal הוא הספק הראשון. הוספת Replicate, Runway או ספק אחר תדרוש adapter וקטלוג capabilities בלבד, לא שינוי מסכי Builder/Review.

## חוזי API נדרשים

- `GET /api/projects/:id/overview`
- `GET /api/shots/:id/versions`
- `POST /api/quotes`
- `POST /api/approvals`
- `POST /api/runs`
- `GET /api/runs/:id`
- `POST /api/reviews`
- `POST /api/assets/:id/promote`
- `POST /api/deliveries`
- `GET /api/deliveries/:id/download`

כל endpoint מקבל ומחזיר IDs קנוניים, ומחזיר שגיאה בטוחה ללא מפתחות או headers.

## תכנית בדיקות

1. בדיקות חוזה למעברי מצב ואיסור דילוג על quote/approval.
2. בדיקות גרסאות: יצירה, קידום, החלפה וחזרה לגרסה קודמת.
3. בדיקות provider adapter עם mock ללא חיוב.
4. בדיקות Review לתמונה ולווידאו, כולל הערה ללא checklist מלא.
5. בדיקות delivery: בחירת active versions, preload, assembly ו־download.
6. בדיקות responsive ו־keyboard לכל מסך.
7. סימולציית משתמש מלאה: יצירת שוט → תמונה → אישור → וידאו → ריוויו → תיקון → קידום → סרט.

## שלב 0 — Production contracts & safety

לפני העברת מסכים יש לסגור את החוזים שמונעים מה־UI להסתיר בעיות תשתית:

- `idempotencyKey` חובה לכל פעולה בתשלום; approval חד־פעמי וקשור ל־quote עם תוקף.
- הרשאות לפי משתמש ופרויקט, הפרדת נתונים, rotation/revocation למפתחות ו־redaction מלא ב־logs.
- מכונת מצבים מלאה: `queued`, `submitted`, `running`, `retrying`, `succeeded`, `failed`, `cancelled`, `expired`, `blocked`, `stale`.
- שינוי תמונת מקור מסמן וידאו תלוי כ־`stale` עד אישור וקידום מחדש.
- Job מרכזי עם progress, polling/webhook, retry, cancel, request ID והתאוששות מרענון.
- QC שומר reviewer, זמן, severity, frame/timecode, evidence והערת תיקון; חובה ומידע מופרדים.
- Delivery מחזיר signed URL זמני או proxy עם הרשאה, `video/mp4`, filename, range requests, checksum ו־atomic finalize.
- optimistic locking, drafts, unsaved changes ו־conflict notice כאשר active revision השתנה במקביל.
- חוזי API ו־schemas מקבלים `schemaVersion` ותלויות קיימות עוברות migration מבוקר.

## סדר ביצוע

1. להוציא את ה־registries והנתונים הקשיחים מה־page ולרכז אותם בשכבת domain.
2. לממש את שלב 0: contracts, הרשאות, idempotency, jobs ו־delivery safety.
3. להוסיף API לקריאת overview, versions ו־promote.
4. לבנות Shell חדש ו־Command Center.
5. להעביר את Builder ו־Timeline למודל ה־active revision.
6. לאחד Review תמונה/וידאו.
7. לחבר Model Lab ל־capabilities ול־quotes.
8. לבנות Delivery אמיתי עם manifest ו־download.
9. להוסיף בדיקות, סימולציה ו־responsive polish.

## תנאי קבלה

משתמש חדש יכול ליצור פרויקט, לבחור דמות ואביזר מהספרייה, להפיק שתי גרסאות, לאשר אחת, להחזיר אחת לתיקון, לראות את ה־prompt וה־run, לבחור active version, ולהוריד סרט מחובר — כשהמערכת מסבירה בכל רגע מה קורה ומה חסר. בנוסף, כשל, retry, רענון או שליחה כפולה אינם יוצרים חיוב כפול או תוצר חלקי.
