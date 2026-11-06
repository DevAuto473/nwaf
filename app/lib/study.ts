/** أدوات المذاكرة: الخرائط الذهنية والبطاقات التعليمية (أنواع + تحليل + كشف الطلب). */

export type AiMode = "chat" | "quiz" | "mindmap" | "flashcards";
export type PageRange = [number, number];

export interface MindNode {
  label: string;
  note?: string;
  page?: number | null;
  children?: MindNode[];
}
export interface MindMap {
  title: string;
  intro: string;
  root: MindNode;
}
export interface Flashcard {
  front: string;
  back: string;
  page: number | null;
}
export interface Flashcards {
  title: string;
  intro: string;
  cards: Flashcard[];
}
export type StudyData =
  | { kind: "mindmap"; data: MindMap }
  | { kind: "flashcards"; data: Flashcards };

export const MAX_PAGE_SPAN = 40;
export const BOOK_PAGES = 277;

const clean = (s: string) => s.replace(/[ًٌٍَُِّْـ]/g, "");

/** هل الرسالة طلب خريطة ذهنية أو بطاقات؟ */
export function detectStudyMode(text: string): "mindmap" | "flashcards" | null {
  const t = clean(text);
  if (/(خريط[ةه]\s*(ذهني|مفاهيم|عقلي)|mind\s*map|مخطط\s*ذهني|خريطه ذهنيه|خريطة المفاهيم)/i.test(t)) return "mindmap";
  if (/(بطاق[اة]ت?\s*(تعليمي|مراجع|حفظ)?|فلاش\s*كارد|flash\s*cards?|flashcards?|بطاقات)/i.test(t)) return "flashcards";
  return null;
}

/** يستخرج مدى صفحات من نص مثل "من صفحة 40 إلى 55" أو "ص 40-55" */
export function parsePageRange(text: string): PageRange | null {
  const t = text.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  const m = t.match(/(?:ص|صفحة|صفحه|صفحات)\s*(\d{1,3})\s*(?:الى|إلى|الي|لين|حتى|و|-|–|—)\s*(?:ص|صفحة|صفحه)?\s*(\d{1,3})/);
  if (!m) return null;
  return normalizeRange(Number(m[1]), Number(m[2]));
}

export function normalizeRange(a: number, b: number): PageRange | null {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  let from = Math.max(1, Math.min(BOOK_PAGES, Math.round(Math.min(a, b))));
  let to = Math.max(1, Math.min(BOOK_PAGES, Math.round(Math.max(a, b))));
  if (to - from + 1 > MAX_PAGE_SPAN) to = from + MAX_PAGE_SPAN - 1;
  from = Math.min(from, to);
  return [from, to];
}

function extractJson(raw: string): unknown | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const pg = (v: unknown) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 && n <= BOOK_PAGES ? n : null;
};

function cleanNode(x: unknown, depth: number): MindNode | null {
  const n = x as Partial<MindNode> | null;
  const label = str(n?.label, 80);
  if (!label) return null;
  const node: MindNode = { label };
  const note = str(n?.note, 320);
  if (note) node.note = note;
  const page = pg(n?.page);
  if (page) node.page = page;
  if (depth < 3 && Array.isArray(n?.children)) {
    const kids = n.children
      .slice(0, 7)
      .map((c) => cleanNode(c, depth + 1))
      .filter((c): c is MindNode => !!c);
    if (kids.length) node.children = kids;
  }
  return node;
}

export function parseMindmap(raw: string): MindMap | null {
  const d = extractJson(raw) as { title?: unknown; intro?: unknown; root?: unknown } | null;
  if (!d) return null;
  const root = cleanNode(d.root, 0);
  if (!root?.children || root.children.length < 2) return null;
  return {
    title: str(d.title, 90) || `خريطة ذهنية: ${root.label}`,
    intro: str(d.intro, 200) || "جهّزت لك خريطة ذهنية.",
    root,
  };
}

export function parseFlashcards(raw: string): Flashcards | null {
  const d = extractJson(raw) as { title?: unknown; intro?: unknown; cards?: unknown } | null;
  if (!d || !Array.isArray(d.cards)) return null;
  const cards: Flashcard[] = [];
  for (const c of d.cards.slice(0, 24)) {
    const x = c as Partial<Flashcard>;
    const front = str(x.front, 220);
    const back = str(x.back, 420);
    if (!front || !back) continue;
    cards.push({ front, back, page: pg(x.page) });
  }
  if (cards.length < 2) return null;
  return {
    title: str(d.title, 90) || "بطاقات مراجعة",
    intro: str(d.intro, 200) || `جهّزت لك ${cards.length} بطاقات.`,
    cards,
  };
}
