# Prompt מימוש — Film OS החדש

## תפקיד

את/ה בונה מערכת הפקת סרטי AI אמיתית, לא דף דמו ולא dashboard סטטי. המערכת צריכה לאפשר ליוצר לעבוד מהרעיון ועד קובץ MP4, כאשר כל החלטה, גרסה ופרומפט ניתנים לשחזור.

## גבולות עבודה

- העבודה מתבצעת רק בפרויקט `production-portal`.
- `dashboard/` ב־root הוא הממשק הישן ואינו מקור למימוש החדש.
- אין למחוק או לדרוס נכסים, גרסאות, מזהים קנוניים או רשומות קיימות.
- אין להכניס מפתחות API לקוד, ל־Git או לדפדפן.
- אין להציג mock או placeholder כאילו הוא תוצר אמיתי.

## מקור אמת

החוזים ב־`db/domain.ts`, הסכמות ב־`db/schema.ts`, הרשומות ב־D1 והמדיה ב־R2 הם שכבת האמת. ה־UI חייב לצרוך אותם דרך API. כל תוצר חדש הוא revision בלתי־הרסני; רק Promote מפורש קובע מה נכנס ל־cut.

## חוויית משתמש

בנה ממשק עבודה מודרני, לא תצוגת עיתון:

1. Command Center — מה מוכן, מה חסום ומה הפעולה הבאה.
2. Builder — intent, דמויות, אביזרים, לוקיישן, frames, אודיו ומודל.
3. Timeline — כל שוט, כל גרסה, active version אחת ובחירה ברורה.
4. Review — תמונה ווידאו באותה שפה, עם checklist מתאים, הערות ו־evidence.
5. Asset Library — דמויות/אביזרים/לוקיישנים וכל ה־lineage.
6. Model Lab — קטלוג capabilities, עלות, קלטים ומסלולי Fal/ספקים נוספים.
7. Delivery — preview רציף, preload, manifest, assembly והורדת MP4 אמיתי.
8. Settings — מצב חיבורים והרשאות; סודות נשארים ב־Worker.

## חוזה פעולות בתשלום

כל פעולה בתשלום עוברת `dry-run → quote → approval → idempotent submit → job → result validation → review`. Retry או refresh לעולם לא יוצרים חיוב כפול. Quote פג תוקף, approval חד־פעמי, וכל סוד עובר redaction בלוגים.

## מודלים וספקים

אל תקבע את הממשק לשם של מודל. השתמש ב־`domain/model-registry.ts` וב־`/api/models`, וסנן לפי capabilities כמו `image-to-video`, `reference-to-video`, `native-audio`, `lip-sync`, `start-frame` ו־`end-frame`. Fal הוא adapter ראשון; הוספת ספק אינה משנה את המסכים.

## אודיו ודיאלוג

הפרד תמיד בין silent, ambience, native audio ו־lip-sync. דיאלוג בטקסט אינו הוכחה שהדמות מדברת. מסלול lip-sync דורש voice asset, speaker identity ובדיקת שפתיים בריוויו.

## QC חובה

בדוק orientation, identity, wardrobe, props, hands, phone/device orientation, extra people, morphing, blocking, continuity, first/last frame, audio sync ו־glitches לאורך זמן. בעיה נשמרת עם severity, frame/timecode, evidence והערת תיקון.

## תנאי קבלה

משתמש יכול ליצור שוט, לבחור נכסים מהספרייה, להפיק שתי גרסאות, לראות את ה־prompt שנשלח, להחזיר גרסה לתיקון, לקדם גרסה אחת, להרכיב cut ולהוריד MP4. כל זאת ללא קוד, ללא אובדן היסטוריה וללא עצירות בלתי מוסברות.

## כלל עבודה

לפני כל מסירה: הרץ build, lint, בדיקות חוזה ו־QA אינטראקטיבי. אם סוכן QA מוצא כשל, מתקנים ומריצים את הסבב מחדש עד `PASS מלא`; אין לדווח “מוכן” על סמך בדיקת DOM בלבד.
