import { NextRequest, NextResponse } from "next/server";
import { search } from "../../lib/bookSearch";

/** بحث في نص الكتاب كاملاً (الوحدة 1 = الكتاب كاملاً): يرجع صفحات مع مقتطف. */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 120);
  if (q.length < 2) return NextResponse.json({ results: [] });

  const chunks = await search(q, 1, 24);
  const words = q.split(/\s+/).filter((w) => w.length >= 2);
  const seen = new Set<number>();
  const results: { page: number; heading: string; snippet: string }[] = [];

  for (const c of chunks) {
    if (c.page == null || seen.has(c.page)) continue;
    seen.add(c.page);
    const text = c.text.replace(/\s+/g, " ").trim();
    let at = -1;
    for (const w of words) {
      at = text.indexOf(w);
      if (at >= 0) break;
    }
    // الكلمة قد تختلف بالتصريف: لو ما وجدناها حرفياً نبدأ من أول المقطع
    const start = at > 40 ? at - 40 : 0;
    const snippet = (start > 0 ? "…" : "") + text.slice(start, start + 170) + (start + 170 < text.length ? "…" : "");
    results.push({ page: c.page, heading: c.heading, snippet });
    if (results.length >= 10) break;
  }
  return NextResponse.json({ results });
}
