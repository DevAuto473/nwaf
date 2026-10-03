/**
 * بحث في نص الكتاب (units/index.json) — BM25 مع تطبيع عربي وتجذيع خفيف.
 * الفهرس يُبنى بـ: node scripts/extract-units.mjs
 */
import path from "path";
import fs from "fs/promises";

export interface Chunk {
  id: number;
  unit: number;
  page: number | null;
  heading: string;
  text: string;
}

interface Index {
  chunks: Chunk[];
  tokens: string[][]; // توكنات كل مقطع
  df: Map<string, number>; // عدد المقاطع التي تحوي الكلمة (لكل وحدة)
  avgLen: number;
  mtime: number;
}

// ─────────── تطبيع عربي ───────────
const DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(DIACRITICS, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

const STOP = new Set(
  normalize(
    "في من على الى إلى عن مع هذا هذه ذلك تلك التي الذي الذين هو هي هم ما ماذا لماذا كيف متى أين اين هل او أو ثم كل بعض قد لقد كان كانت يكون تكون ان أن إن لا لم لن بين عند حتى اذا إذا انه أنه ايضا أيضا وهو وهي the a an of to in and or is are what how why اشرح وضح عرف اذكر ماهو ماهي ما هو ما هي"
  ).split(/\s+/)
);

const PREFIXES = ["وال", "بال", "كال", "فال", "لل", "ال", "و", "ب", "ل", "ف", "ك"];
const SUFFIXES = ["ات", "ون", "ين", "ان", "ها", "هم", "هما", "كم", "نا", "ه", "ي"];

export function stem(w: string): string {
  let t = w;
  for (const p of PREFIXES) {
    if (t.startsWith(p) && t.length - p.length >= 3) {
      t = t.slice(p.length);
      break;
    }
  }
  for (const s of SUFFIXES) {
    if (t.endsWith(s) && t.length - s.length >= 3) {
      t = t.slice(0, -s.length);
      break;
    }
  }
  return t;
}

export function tokenize(s: string): string[] {
  const out: string[] = [];
  for (const w of normalize(s).split(/[^ء-يa-z0-9]+/)) {
    if (w.length < 2 || STOP.has(w)) continue;
    out.push(stem(w));
    // نص الـ OCR يقرأ الفاصلة "،" همزةً أحياناً (الخليهء) → أضف الكلمة بدونها
    if (w.length > 3 && w.endsWith("ء")) out.push(stem(w.slice(0, -1)));
  }
  return out.filter((w) => w.length > 1);
}

// ─────────── تحميل الفهرس (مع كاش وإعادة تحميل عند التغيير) ───────────
const INDEX_PATH = path.join(process.cwd(), "units", "index.json");
let cached: Index | null = null;

async function loadIndex(): Promise<Index | null> {
  let stat;
  try {
    stat = await fs.stat(INDEX_PATH);
  } catch {
    return null;
  }
  if (cached && cached.mtime === stat.mtimeMs) return cached;

  const raw = JSON.parse(await fs.readFile(INDEX_PATH, "utf-8")) as { chunks: Chunk[] };
  const tokens = raw.chunks.map((c) => tokenize(`${c.heading} ${c.heading} ${c.text}`));
  const df = new Map<string, number>();
  tokens.forEach((toks, i) => {
    for (const t of new Set(toks)) {
      const key = `${raw.chunks[i].unit}:${t}`;
      df.set(key, (df.get(key) ?? 0) + 1);
    }
  });
  const avgLen = tokens.reduce((a, t) => a + t.length, 0) / Math.max(tokens.length, 1);
  cached = { chunks: raw.chunks, tokens, df, avgLen, mtime: stat.mtimeMs };
  return cached;
}

export async function hasUnit(unit: number): Promise<boolean> {
  const idx = await loadIndex();
  return !!idx?.chunks.some((c) => c.unit === unit);
}

/** النص الكامل للوحدة مرتباً بالصفحات، مع علامات [صفحة N]. */
export async function getUnitText(unit: number): Promise<string> {
  const idx = await loadIndex();
  if (!idx) return "";
  let out = "";
  let lastPage: number | null | undefined;
  for (const c of idx.chunks) {
    if (c.unit !== unit) continue;
    if (c.page !== lastPage) {
      out += c.page != null ? `\n\n[صفحة ${c.page}]\n` : "\n\n";
      lastPage = c.page;
    }
    out += c.text + "\n";
  }
  return out.trim();
}

// ─────────── BM25 ───────────
const K1 = 1.4;
const B = 0.75;

async function scoreUnit(idx: Index, query: string, unit: number) {
  const ids = idx.chunks.map((c, i) => (c.unit === unit ? i : -1)).filter((i) => i >= 0);
  const N = ids.length;
  const qTokens = [...new Set(tokenize(query))];
  if (!N || !qTokens.length) return [];

  const qNorm = normalize(query);
  return ids.map((i) => {
    const toks = idx.tokens[i];
    const tf = new Map<string, number>();
    for (const t of toks) tf.set(t, (tf.get(t) ?? 0) + 1);

    let score = 0;
    let matched = 0;
    for (const q of qTokens) {
      const f = tf.get(q) ?? 0;
      if (!f) continue;
      matched++;
      const n = idx.df.get(`${unit}:${q}`) ?? 0;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      score += idf * ((f * (K1 + 1)) / (f + K1 * (1 - B + (B * toks.length) / idx.avgLen)));
    }
    // مكافأة تغطية كلمات السؤال + تطابق عبارة كاملة
    score *= 1 + matched / qTokens.length;
    if (qNorm.length > 6 && normalize(idx.chunks[i].text).includes(qNorm)) score *= 1.5;
    return { i, score };
  });
}

/** أفضل المقاطع لسؤال. unit = null → كل الكتاب. */
export async function search(query: string, unit: number | null, k = 10): Promise<Chunk[]> {
  const idx = await loadIndex();
  if (!idx) return [];

  const units = unit != null ? [unit] : [...new Set(idx.chunks.map((c) => c.unit))];
  const scored = (await Promise.all(units.map((u) => scoreUnit(idx, query, u)))).flat();
  scored.sort((a, b) => b.score - a.score);
  // إزالة المقاطع المكررة (نفس الصفحة موجودة في ملفين)
  const seen = new Set<string>();
  const top = scored
    .filter((s) => {
      if (s.score <= 0) return false;
      const key = normalize(idx.chunks[s.i].text).replace(/\s+/g, "").slice(0, 80);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, k);

  // أضف المقطع التالي لأفضل 3 نتائج (التعريفات غالباً تمتد)
  const chosen = new Set<number>();
  top.forEach((s, rank) => {
    chosen.add(s.i);
    const next = s.i + 1;
    if (rank < 3 && idx.chunks[next]?.unit === idx.chunks[s.i].unit) chosen.add(next);
  });

  // ترتيب حسب موضعها في الكتاب لسياق متصل
  return [...chosen].sort((a, b) => a - b).map((i) => idx.chunks[i]);
}
