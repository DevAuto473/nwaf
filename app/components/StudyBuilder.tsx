"use client";

import React, { useState } from "react";
import { Layers, ListChecks, Network, Search } from "lucide-react";
import { CHAPTER_RANGES } from "../lib/pageHighlight";
import { BOOK_PAGES, MAX_PAGE_SPAN, normalizeRange, type PageRange } from "../lib/study";

export type BuilderKind = "quiz" | "mindmap" | "flashcards";

const KINDS: { id: BuilderKind; label: string; icon: React.ReactNode }[] = [
  { id: "quiz", label: "اختبار", icon: <ListChecks aria-hidden className="h-4 w-4" /> },
  { id: "mindmap", label: "خريطة ذهنية", icon: <Network aria-hidden className="h-4 w-4" /> },
  { id: "flashcards", label: "بطاقات", icon: <Layers aria-hidden className="h-4 w-4" /> },
];
const COUNTS: Record<BuilderKind, number[]> = { quiz: [5, 10, 15], flashcards: [10, 15, 20], mindmap: [] };

/** يبني نص الطلب الذي يُرسل ليزيد */
export function studyPrompt(kind: BuilderKind, range: PageRange, count: number): string {
  const [a, b] = range;
  const where = a === b ? `صفحة ${a}` : `صفحة ${a} إلى ${b}`;
  if (kind === "quiz") return `اختبرني بـ ${count} أسئلة من ${where}`;
  if (kind === "flashcards") return `سوِّ لي ${count} بطاقة مراجعة من ${where}`;
  return `ارسم لي خريطة ذهنية لما في ${where}`;
}

/**
 * نافذة اختيار الصفحات: نوع المادة + من/إلى + عدد العناصر.
 * تُفتح من شريط الكتاب، وقيم الصفحات تبدأ بالصفحات الظاهرة حالياً.
 */
export default function StudyBuilder({
  first,
  last,
  chapter,
  onSubmit,
}: {
  first: number;
  last: number;
  chapter: number | null;
  onSubmit: (kind: BuilderKind, range: PageRange, count: number) => void;
}) {
  const [kind, setKind] = useState<BuilderKind>("quiz");
  const [from, setFrom] = useState(String(first));
  const [to, setTo] = useState(String(last));
  const [count, setCount] = useState(10);

  const range = normalizeRange(Number(from), Number(to));
  const span = range ? range[1] - range[0] + 1 : 0;
  const tooWide = Math.abs(Number(to) - Number(from)) + 1 > MAX_PAGE_SPAN;
  const chap = chapter ? CHAPTER_RANGES.find((c) => c.chapter === chapter) : undefined;
  const counts = COUNTS[kind];
  const shownCount = counts.includes(count) ? count : counts[1] ?? 10;

  const setRange = (a: number, b: number) => {
    setFrom(String(a));
    setTo(String(b));
  };

  return (
    <div
      role="dialog"
      aria-label="تجهيز مادة مذاكرة من صفحات محددة"
      className="yz-pop pointer-events-auto absolute start-3 top-[68px] w-[min(340px,calc(100%-24px))] rounded-3xl border border-[#1f2b2b] bg-[#0d1414] p-4 shadow-2xl shadow-black/70"
    >
      <p className="flex items-center gap-2 text-sm font-semibold text-white">
        <Search aria-hidden className="h-4 w-4 text-teal-400" />
        ذاكر صفحات محددة
      </p>

      <div role="radiogroup" aria-label="نوع المادة" className="mt-3 grid grid-cols-3 gap-1 rounded-2xl bg-[#121b1b] p-1">
        {KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            role="radio"
            aria-checked={kind === k.id}
            onClick={() => setKind(k.id)}
            className={`press flex h-10 items-center justify-center gap-1.5 rounded-xl text-xs font-medium ${
              kind === k.id ? "bg-teal-700 text-white" : "text-gray-300 hover:bg-[#1c2626]"
            }`}
          >
            {k.label}
            {k.icon}
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <label className="flex-1 text-xs text-gray-400">
          من صفحة
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={BOOK_PAGES}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 h-11 w-full rounded-xl border border-[#2a3838] bg-[#121b1b] px-3 text-base text-white outline-none focus:border-teal-400"
          />
        </label>
        <label className="flex-1 text-xs text-gray-400">
          إلى صفحة
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={BOOK_PAGES}
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 h-11 w-full rounded-xl border border-[#2a3838] bg-[#121b1b] px-3 text-base text-white outline-none focus:border-teal-400"
          />
        </label>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <Chip onClick={() => setRange(first, last)}>الصفحات الظاهرة</Chip>
        {chap && <Chip onClick={() => setRange(chap.from, Math.min(chap.to, chap.from + MAX_PAGE_SPAN - 1))}>الفصل {chap.chapter}</Chip>}
      </div>

      {counts.length > 0 && (
        <div className="mt-4">
          <p className="text-xs text-gray-400">{kind === "quiz" ? "عدد الأسئلة" : "عدد البطاقات"}</p>
          <div className="mt-1 flex gap-1.5">
            {counts.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={shownCount === c}
                onClick={() => setCount(c)}
                className={`press h-9 flex-1 rounded-xl border text-sm ${
                  shownCount === c ? "border-teal-600 bg-teal-700 text-white" : "border-[#2a3838] text-gray-300 hover:bg-[#1c2626]"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="mt-3 min-h-5 text-xs text-gray-400">
        {!range
          ? "اكتب أرقام صفحات صحيحة."
          : tooWide
          ? `الحد الأقصى ${MAX_PAGE_SPAN} صفحة، سيُقصّ المدى إلى ${range[0]}–${range[1]}.`
          : `${span} ${span === 1 ? "صفحة" : span < 11 ? "صفحات" : "صفحة"} (${range[0]}–${range[1]})`}
      </p>

      <button
        type="button"
        disabled={!range}
        onClick={() => range && onSubmit(kind, range, shownCount)}
        className="press mt-2 h-12 w-full rounded-2xl bg-teal-700 font-semibold text-white hover:bg-teal-600 disabled:opacity-40"
      >
        جهّز لي {KINDS.find((k) => k.id === kind)!.label}
      </button>
    </div>
  );
}

function Chip({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="press rounded-full border border-[#2a3838] px-3 py-1 text-xs text-gray-200 hover:bg-[#1c2626]">
      {children}
    </button>
  );
}
