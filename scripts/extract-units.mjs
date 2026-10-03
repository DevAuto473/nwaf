/**
 * استخراج نص الكتاب صفحةً صفحة + بناء فهرس البحث.
 *
 * الاستخدام:
 *   node scripts/extract-units.mjs            ← يستخرج كل الوحدات ثم يبني الفهرس
 *   node scripts/extract-units.mjs 3 5        ← وحدات محددة فقط
 *   node scripts/extract-units.mjs --index    ← يبني الفهرس فقط (بدون استخراج)
 *
 * المخرجات:
 *   units/pages/unit{N}/page-{NNN}.md   ← نص كل صفحة (يُستأنف تلقائياً: الصفحات الموجودة تُتخطّى)
 *   units/index.json                    ← فهرس البحث الذي يقرأه /api/ai
 *
 * يحتاج: npm i pdf-lib
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const unitsDir = path.join(root, "units");
const pagesDir = path.join(unitsDir, "pages");
// ملفات PDF: public/units (نفس الملفات التي يعرضها الموقع)، أو units/ احتياطاً
const pdfDir = fs.existsSync(path.join(root, "public", "units"))
  ? path.join(root, "public", "units")
  : unitsDir;

const MODEL = "anthropic/claude-haiku-4.5";
const CONCURRENCY = 4;
const MAX_RETRIES = 3;
const CHUNK_CHARS = 900; // حجم المقطع في الفهرس

const args = process.argv.slice(2);
const indexOnly = args.includes("--index");
const requested = args.filter((a) => /^\d+$/.test(a)).map(Number);

// ── المفتاح ──
function loadKey() {
  const env = fs.readFileSync(path.join(root, ".env.local"), "utf-8");
  const key = env.match(/OPENROUTER_API_KEY=(.+)/)?.[1]?.trim();
  if (!key) {
    console.error("OPENROUTER_API_KEY غير موجود في .env.local");
    process.exit(1);
  }
  return key;
}

function listUnitIds() {
  return fs
    .readdirSync(pdfDir)
    .map((f) => f.match(/^unit(\d+)\.pdf$/)?.[1])
    .filter(Boolean)
    .map(Number)
    .sort((a, b) => a - b);
}

const pad = (n) => String(n).padStart(3, "0");

// كشف التكرار المنحط (مثل "بدائية بدائية بدائية ...")
function isDegenerate(text) {
  const words = text.split(/\s+/).filter(Boolean);
  let run = 1;
  for (let i = 1; i < words.length; i++) {
    run = words[i] === words[i - 1] ? run + 1 : 1;
    if (run >= 12) return true;
  }
  return false;
}

const PROMPT = `هذه صفحة واحدة من كتاب مدرسي. انسخ كل النص الظاهر فيها حرفياً وبالترتيب:
العناوين، الفقرات، التعريفات، المصطلحات الإنجليزية، تعليقات الأشكال، الجداول، الأسئلة.
- اكتب بتنسيق Markdown (عناوين ## للعناوين).
- لا تلخّص ولا تشرح ولا تضف شيئاً من عندك.
- إذا كانت الصفحة صورة بلا نص أو فارغة فاكتب: (صفحة بدون نص)`;

async function extractPage(apiKey, pdfBytes, unitId, pageNo) {
  const b64 = Buffer.from(pdfBytes).toString("base64");
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": "https://nwaf.app",
          "X-Title": "Nwaf Extraction",
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "file",
                  file: {
                    filename: `unit${unitId}-p${pageNo}.pdf`,
                    file_data: `data:application/pdf;base64,${b64}`,
                  },
                },
                { type: "text", text: PROMPT },
              ],
            },
          ],
          temperature: 0,
          max_tokens: 4000,
          frequency_penalty: 0.3,
        }),
      });
      const data = await r.json();
      if (!r.ok || data.error) throw new Error(data.error?.message || r.statusText);
      const text = data?.choices?.[0]?.message?.content?.trim();
      if (!text) throw new Error("رد فارغ");
      if (isDegenerate(text)) throw new Error("تكرار منحط في الرد");
      return text;
    } catch (err) {
      console.warn(`   ⚠️ unit${unitId} ص${pageNo} محاولة ${attempt}: ${err.message}`);
      if (attempt === MAX_RETRIES) return null;
      await new Promise((res) => setTimeout(res, 1500 * attempt));
    }
  }
}

async function extractUnit(apiKey, unitId) {
  const { PDFDocument } = await import("pdf-lib");
  const pdfPath = path.join(pdfDir, `unit${unitId}.pdf`);
  const outDir = path.join(pagesDir, `unit${unitId}`);
  fs.mkdirSync(outDir, { recursive: true });

  const src = await PDFDocument.load(fs.readFileSync(pdfPath), { ignoreEncryption: true });
  const total = src.getPageCount();
  const todo = [];
  for (let i = 0; i < total; i++) {
    if (!fs.existsSync(path.join(outDir, `page-${pad(i + 1)}.md`))) todo.push(i);
  }
  console.log(`📖 unit${unitId}: ${total} صفحة، المتبقي ${todo.length}`);

  let done = 0;
  let failed = 0;
  const worker = async () => {
    while (todo.length) {
      const i = todo.shift();
      const one = await PDFDocument.create();
      const [p] = await one.copyPages(src, [i]);
      one.addPage(p);
      const bytes = await one.save();
      const text = await extractPage(apiKey, bytes, unitId, i + 1);
      if (text) {
        fs.writeFileSync(path.join(outDir, `page-${pad(i + 1)}.md`), text, "utf-8");
        done++;
      } else failed++;
      process.stdout.write(`\r   ✅ ${done}  ❌ ${failed}   `);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(failed ? `\n   أعد التشغيل لإكمال ${failed} صفحة فاشلة.` : "");
}

// ── بناء الفهرس ──
function splitPage(text) {
  // قسّم عند الفقرات، واجمع حتى CHUNK_CHARS، واحتفظ بآخر عنوان
  const out = [];
  let heading = "";
  let buf = "";
  const flush = () => {
    const t = buf.trim();
    if (t.length > 30) out.push({ heading, text: t });
    buf = "";
  };
  for (const para of text.split(/\n\s*\n/)) {
    const h = para.match(/^#{1,6}\s+(.+)$/m);
    if (h && para.trim().startsWith("#")) {
      flush();
      heading = h[1].replace(/\*+/g, "").trim();
    }
    if (buf.length + para.length > CHUNK_CHARS) flush();
    buf += para + "\n\n";
  }
  flush();
  return out;
}

function buildIndex() {
  const chunks = [];
  // رقم صفحة الكتاب المطبوع بدل رقم صفحة الملف (اختياري)
  const offPath = path.join(unitsDir, "page-offsets.json");
  const offsets = fs.existsSync(offPath) ? JSON.parse(fs.readFileSync(offPath, "utf-8")) : {};
  for (const unitId of listUnitIds()) {
    const dir = path.join(pagesDir, `unit${unitId}`);
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir).filter((f) => /^page-\d+\.md$/.test(f)).sort();
      for (const f of files) {
        const page = Number(f.match(/\d+/)[0]) + (offsets[unitId] ?? 0);
        const text = fs.readFileSync(path.join(dir, f), "utf-8");
        if (text.includes("(صفحة بدون نص)")) continue;
        for (const c of splitPage(text)) chunks.push({ unit: unitId, page, ...c });
      }
      continue;
    }
    // احتياط: ملف unitN.md القديم (بدون أرقام صفحات)
    const legacy = path.join(unitsDir, `unit${unitId}.md`);
    if (fs.existsSync(legacy)) {
      const text = fs.readFileSync(legacy, "utf-8");
      for (const c of splitPage(text)) {
        if (!isDegenerate(c.text)) chunks.push({ unit: unitId, page: null, ...c });
      }
    }
  }
  chunks.forEach((c, i) => (c.id = i));
  fs.writeFileSync(
    path.join(unitsDir, "index.json"),
    JSON.stringify({ builtAt: new Date().toISOString(), chunks }),
    "utf-8"
  );
  const units = [...new Set(chunks.map((c) => c.unit))];
  console.log(`\n📚 الفهرس: ${chunks.length} مقطع من الوحدات ${units.join(", ")} → units/index.json`);
}

// ── التشغيل ──
if (!indexOnly) {
  const apiKey = loadKey();
  const ids = requested.length ? requested : listUnitIds();
  for (const id of ids) await extractUnit(apiKey, id);
}
buildIndex();
console.log("✨ تم. أعد تشغيل npm run dev\n");
