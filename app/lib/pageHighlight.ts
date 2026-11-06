/** مطابقة نص الإجابة مع مقاطع نص صفحة الـ PDF لتحديد مكان التظليل. */

// الفصول وصفحاتها في الكتاب كاملاً — نفس تقسيم public/units
export const CHAPTER_RANGES: { file: string; chapter: number; from: number; to: number }[] = [
  { file: "/units/unit2.pdf", chapter: 1, from: 10, to: 35 },
  { file: "/units/unit3.pdf", chapter: 2, from: 36, to: 59 },
  { file: "/units/unit4.pdf", chapter: 3, from: 60, to: 87 },
  { file: "/units/unit5.pdf", chapter: 4, from: 88, to: 119 },
  { file: "/units/unit6.pdf", chapter: 5, from: 120, to: 145 },
  { file: "/units/unit7.pdf", chapter: 6, from: 146, to: 179 },
  { file: "/units/unit8.pdf", chapter: 7, from: 180, to: 213 },
  { file: "/units/unit9.pdf", chapter: 8, from: 214, to: 244 },
];
export const BOOK_PAGES = 277;

/** أي ملف يحوي الصفحة، ورقمها داخله (ملفات الفصول أخف من الكتاب كاملاً) */
export function locatePage(page: number) {
  const r = CHAPTER_RANGES.find((c) => page >= c.from && page <= c.to);
  if (r) return { file: r.file, filePage: page - r.from + 1, chapter: r.chapter };
  return { file: "/units/unit1.pdf", filePage: page, chapter: null as number | null };
}

const STOP = new Set(
  "في من على الى إلى عن مع هذا هذه ذلك تلك التي الذي الذين هو هي هم ما ماذا كيف هل او أو ثم كل بعض قد كان كانت يكون تكون ان أن إن لا لم لن بين عند حتى اذا إذا انه أنه ايضا أيضا وهو وهي لأن لان حيث مثل عندما الكتاب"
    .split(" ")
    .map((w) => norm(w))
);

export function norm(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[^ء-يa-z0-9\s]/gi, " ")
    .toLowerCase();
}

const PREFIXES = ["وال", "بال", "فال", "كال", "لل", "ال", "و", "ب"];

/** كلمات مفتاحية من نصوص الإجابة (بدون أداة التعريف والحروف الزائدة) */
export function keyTerms(texts: string[]): string[] {
  const out = new Set<string>();
  for (const t of texts) {
    for (let w of norm(t).split(/\s+/)) {
      if (!w || STOP.has(w)) continue;
      for (const p of PREFIXES) {
        if (w.startsWith(p) && w.length - p.length >= 3) {
          w = w.slice(p.length);
          break;
        }
      }
      if (w.length >= 3 && !STOP.has(w)) out.add(w);
    }
  }
  return [...out];
}

/**
 * يرجع فهارس المقاطع التي تُظلَّل.
 * نقيس عدد الكلمات المفتاحية في كل مقطع (سطر نص)، ونأخذ المقاطع القريبة من الأفضل.
 */
export function pickHighlights(items: string[], terms: string[]): number[] {
  if (!terms.length) return [];
  const scores = items.map((raw) => {
    const t = norm(raw);
    if (t.trim().length < 3) return 0;
    let s = 0;
    for (const k of terms) if (t.includes(k)) s++;
    return s;
  });
  const best = Math.max(0, ...scores);
  let threshold: number;
  if (best >= 3) threshold = Math.max(2, Math.ceil(best * 0.4));
  else if (best === 2) threshold = 2;
  else if (best === 1 && terms.length <= 2) threshold = 1;
  else return [];
  const picked = scores.map((s, i) => (s >= threshold ? i : -1)).filter((i) => i >= 0);
  // صفحة كاملة مظللة لا تفيد — خذ الأقوى فقط
  if (picked.length > 12) {
    return picked.sort((a, b) => scores[b] - scores[a]).slice(0, 12);
  }
  return picked;
}
