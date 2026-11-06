"use client";

import React, { useCallback, useRef, useState } from "react";
import {
  BookOpen, BookOpenText, Microscope, Network, Biohazard, Droplets, Sprout,
  PawPrint, Snail, Bug, Brain, Download, FileText, SearchX,
} from "lucide-react";
import { useAppContext, Unit, Point } from "../context/AppContext";
import { CHAPTER_RANGES } from "../lib/pageHighlight";

/** أول صفحة للفصل في الكتاب كاملاً */
const firstPage = (u: Unit) => CHAPTER_RANGES.find((c) => c.chapter === u.chapter)?.from ?? 1;

type IconType = React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

// أيقونات Lucide الجاهزة — المفاتيح تطابق حقل icon في AppContext
const icons: Record<string, IconType> = {
  BookOpenText, Microscope, Network, Biohazard, Droplets, Sprout, PawPrint, Snail, Bug,
};

/** مدة الضغط المطوّل (اختصار لفتح يزيد) */
const LONG_PRESS_MS = 550;
/** حركة أكبر من هذا = تمرير، وليست ضغطة */
const MOVE_SLOP = 10;

/** توحيد الحروف العربية للبحث: إزالة التشكيل وتوحيد الألف والياء والتاء المربوطة */
function normalize(s: string) {
  return s
    .replace(/[\u064B-\u0652\u0640]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .toLowerCase();
}

function centerOf(el: Element): Point {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function UnitCard({
  unit,
  featured = false,
  index = 0,
  onAsk,
  onOpen,
}: {
  unit: Unit;
  index?: number;
  featured?: boolean;
  onAsk: (origin: Point) => void;
  onOpen: () => void;
}) {
  const Icon = icons[unit.icon] ?? BookOpenText;
  const cardRef = useRef<HTMLElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const raf = useRef<number | null>(null);
  const start = useRef<Point | null>(null);
  const fired = useRef(false);
  const [pressing, setPressing] = useState(false);

  const resetVisual = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    if (raf.current) cancelAnimationFrame(raf.current);
    timer.current = null;
    raf.current = null;
    start.current = null;
    if (fillRef.current) fillRef.current.style.clipPath = "inset(100% 0 0 0)";
    setPressing(false);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    // الأزرار والروابط داخل البطاقة لها سلوكها الخاص
    if ((e.target as HTMLElement).closest("a, button")) return;

    fired.current = false;
    start.current = { x: e.clientX, y: e.clientY };
    setPressing(true); // استجابة فورية لحظة الضغط

    const t0 = performance.now();
    const tick = () => {
      const p = Math.min((performance.now() - t0) / LONG_PRESS_MS, 1);
      // تعبئة متصلة 1:1 مع الزمن — تُحدَّث مباشرة بدون إعادة رسم React
      if (fillRef.current) fillRef.current.style.clipPath = `inset(${(1 - p) * 100}% 0 0 0)`;
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);

    timer.current = setTimeout(() => {
      fired.current = true;
      const origin = start.current ?? { x: e.clientX, y: e.clientY };
      if (typeof navigator !== "undefined") navigator.vibrate?.(12);
      resetVisual();
      onAsk(origin);
    }, LONG_PRESS_MS);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!start.current) return;
    if (
      Math.abs(e.clientX - start.current.x) > MOVE_SLOP ||
      Math.abs(e.clientY - start.current.y) > MOVE_SLOP
    ) {
      resetVisual();
    }
  };

  const onClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("a, button")) return;
    if (fired.current) {
      fired.current = false;
      return;
    }
    onOpen();
  };

  const chapterLabel = unit.chapter ? `الفصل ${unit.chapter}` : "الكتاب";

  return (
    <article
      ref={cardRef}
      data-pressing={pressing}
      style={{ "--i": index } as React.CSSProperties}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={resetVisual}
      onPointerLeave={resetVisual}
      onPointerCancel={resetVisual}
      onClick={onClick}
      onContextMenu={(e) => e.preventDefault()}
      title="اضغط لفتح الفصل · اضغط مطوّلاً لسؤال يزيد"
      className={`unit-card card-surface group relative flex cursor-pointer select-none overflow-hidden rounded-3xl border border-[#1f2b2b] hover:border-teal-600 ${
        featured ? "col-span-full flex-col gap-6 p-6 sm:flex-row sm:items-center sm:p-8" : "flex-col p-6"
      }`}
    >
      {/* تعبئة الضغط المطوّل — تبدأ من أول إطار */}
      <div
        ref={fillRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-teal-900"
        style={{ clipPath: "inset(100% 0 0 0)" }}
      />

      <div className={`relative flex ${featured ? "items-center gap-5 sm:flex-1" : "flex-col"}`}>
        <div className={`flex items-center justify-between ${featured ? "" : "mb-5"}`}>
          <span
            className={`icon-tile flex items-center justify-center rounded-2xl ${
              featured ? "h-16 w-16" : "h-12 w-12"
            }`}
          >
            <Icon aria-hidden className={featured ? "h-8 w-8" : "h-6 w-6"} />
          </span>
          {!featured && (
            <span className="rounded-full border border-[#1f2b2b] px-2.5 py-1 text-xs font-medium text-gray-300">
              {chapterLabel}
            </span>
          )}
        </div>

        <div className={featured ? "min-w-0" : ""}>
          <h3 className={`font-bold text-white ${featured ? "text-3xl" : "text-2xl"}`}>{unit.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-gray-300 sm:text-[15px]">{unit.description}</p>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-gray-400">
            {unit.pageCount} صفحة
            <FileText aria-hidden className="h-3.5 w-3.5 text-teal-500" />
          </p>
        </div>
      </div>

      {!featured && <div className="flex-1" />}

      <div className={`relative flex items-center gap-2 ${featured ? "sm:shrink-0" : "mt-6"}`}>
        <button
          type="button"
          onClick={(e) => onAsk(centerOf(e.currentTarget))}
          className="press flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-600 sm:flex-none"
        >
          اسأل يزيد
          <Brain aria-hidden className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onOpen}
          className="press flex h-12 items-center justify-center gap-2 rounded-xl border border-[#2a3838] px-4 text-sm font-medium text-gray-100 hover:border-teal-600 hover:text-white"
        >
          فتح
          <BookOpen aria-hidden className="h-4 w-4" />
        </button>
        <a
          href={unit.pdfUrl}
          download
          aria-label={`تحميل ${unit.title} PDF`}
          title="تحميل PDF"
          className="press flex h-12 w-12 items-center justify-center rounded-xl border border-[#2a3838] text-gray-300 hover:border-teal-600 hover:text-white"
        >
          <Download aria-hidden className="h-4 w-4" />
        </a>
      </div>
    </article>
  );
}

export default function CurriculumGrid() {
  const { units, searchQuery, setSearchQuery, setUnitChatUnit, openPage } = useAppContext();

  const q = normalize(searchQuery.trim());
  const filtered = q
    ? units.filter((u) =>
        normalize(`${u.title} ${u.description} ${u.chapter ? `الفصل ${u.chapter}` : ""}`).includes(q)
      )
    : units;

  const featured = !q ? filtered.find((u) => !u.chapter) : undefined;
  const chapters = filtered.filter((u) => u !== featured);

  return (
    <section aria-label="فصول الكتاب" className="mx-auto w-full max-w-7xl px-4 pb-28 sm:px-6">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {featured && (
          <UnitCard
            unit={featured}
            featured
            onAsk={(origin) => setUnitChatUnit(featured, origin)}
            onOpen={() => openPage(firstPage(featured))}
          />
        )}
        {chapters.map((unit, i) => (
          <UnitCard
            key={unit.id}
            index={i + 1}
            unit={unit}
            onAsk={(origin) => setUnitChatUnit(unit, origin)}
            onOpen={() => openPage(firstPage(unit))}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center py-20 text-center">
          <SearchX aria-hidden className="h-10 w-10 text-gray-400" />
          <p className="mt-4 text-base text-gray-300">لا يوجد فصل يطابق «{searchQuery}»</p>
          <p className="mt-1 text-sm text-gray-400">جرّب كلمة أخرى، أو اسأل يزيد مباشرة.</p>
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="press mt-5 rounded-xl border border-[#2a3838] px-4 py-2 text-sm text-gray-100 hover:border-teal-600"
          >
            مسح البحث
          </button>
        </div>
      )}
    </section>
  );
}
