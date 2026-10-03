# منصة التعليم (nwaf)

موقع Next.js لعرض وحدات كتاب الأحياء 1، مع مساعد ذكاء اصطناعي يجيب من نص الكتاب ويذكر رقم الصفحة.

## التشغيل

```bash
npm install
cp .env.example .env.local   # ثم ضع مفتاح OpenRouter
npm run dev
```

## مساعد الكتاب

- `public/units/unitN.pdf` — ملفات الوحدات (unit1 = الكتاب كاملاً).
- `units/pages/unitN/page-NNN.md` — نص كل صفحة.
- `units/index.json` — فهرس البحث الذي يقرأه `app/api/ai/route.ts`.
- `units/page-offsets.json` — تحويل رقم صفحة الملف إلى رقم صفحة الكتاب.

إعادة بناء الفهرس بعد تعديل نصوص الصفحات:

```bash
node scripts/extract-units.mjs --index
```

استخراج نص جديد بالذكاء الاصطناعي (احذف `units/pages/unitN` أولاً لإعادة استخراج وحدة):

```bash
npm run extract        # كل الوحدات
npm run extract -- 3   # وحدة محددة
```

## النشر

عيّن متغير البيئة `OPENROUTER_API_KEY` في منصة النشر.
