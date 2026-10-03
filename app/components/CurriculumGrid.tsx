"use client";

import React, { useRef, useState, useCallback } from "react";
import {
  Calculator, Shapes, Atom, FlaskConical, Microscope, Code,
  Download, ArrowLeft, FileText,
  Dna, Telescope, Binary, Compass, Orbit, Brain,
  Globe, Cpu, Activity, Gauge,
} from "lucide-react";
import { useAppContext, Unit } from "../context/AppContext";

/* ─── Icon maps — normal (teal on black) and inverted (black on teal) ─── */
const iconMapNormal: Record<string, React.ReactNode> = {
  Calculator:  <Calculator  className="h-6 w-6 text-teal-600" />,
  Shapes:      <Shapes      className="h-6 w-6 text-teal-600" />,
  Atom:        <Atom        className="h-6 w-6 text-teal-600" />,
  FlaskConical:<FlaskConical className="h-6 w-6 text-teal-600" />,
  Microscope:  <Microscope  className="h-6 w-6 text-teal-600" />,
  Code:        <Code        className="h-6 w-6 text-teal-600" />,
  Dna:         <Dna         className="h-6 w-6 text-teal-600" />,
  Telescope:   <Telescope   className="h-6 w-6 text-teal-600" />,
  Binary:      <Binary      className="h-6 w-6 text-teal-600" />,
  Compass:     <Compass     className="h-6 w-6 text-teal-600" />,
  Orbit:       <Orbit       className="h-6 w-6 text-teal-600" />,
  Brain:       <Brain       className="h-6 w-6 text-teal-600" />,
  Globe:       <Globe       className="h-6 w-6 text-teal-600" />,
  Cpu:         <Cpu         className="h-6 w-6 text-teal-600" />,
  Activity:    <Activity    className="h-6 w-6 text-teal-600" />,
  Gauge:       <Gauge       className="h-6 w-6 text-teal-600" />,
};

const iconMapInverted: Record<string, React.ReactNode> = {
  Calculator:  <Calculator  className="h-6 w-6 text-black" />,
  Shapes:      <Shapes      className="h-6 w-6 text-black" />,
  Atom:        <Atom        className="h-6 w-6 text-black" />,
  FlaskConical:<FlaskConical className="h-6 w-6 text-black" />,
  Microscope:  <Microscope  className="h-6 w-6 text-black" />,
  Code:        <Code        className="h-6 w-6 text-black" />,
  Dna:         <Dna         className="h-6 w-6 text-black" />,
  Telescope:   <Telescope   className="h-6 w-6 text-black" />,
  Binary:      <Binary      className="h-6 w-6 text-black" />,
  Compass:     <Compass     className="h-6 w-6 text-black" />,
  Orbit:       <Orbit       className="h-6 w-6 text-black" />,
  Brain:       <Brain       className="h-6 w-6 text-black" />,
  Globe:       <Globe       className="h-6 w-6 text-black" />,
  Cpu:         <Cpu         className="h-6 w-6 text-black" />,
  Activity:    <Activity    className="h-6 w-6 text-black" />,
  Gauge:       <Gauge       className="h-6 w-6 text-black" />,
};

/* ─── Card body — rendered twice (normal + inverted) ─── */
function CardBody({
  unit,
  inverted,
  onBrowse,
}: {
  unit: Unit;
  inverted: boolean;
  onBrowse: () => void;
}) {
  const icons = inverted ? iconMapInverted : iconMapNormal;

  return (
    <div
      className={`relative flex flex-col h-full w-full p-5 ${
        inverted ? "bg-teal-500" : "bg-black"
      }`}
    >
      {/* Icon */}
      <div className="mb-4 flex justify-start mt-2">
        {icons[unit.icon] ?? <Code className={`h-6 w-6 ${inverted ? "text-black" : "text-teal-600"}`} />}
      </div>

      {/* Title */}
      <h3 className={`mb-2 text-lg font-semibold transition-colors ${inverted ? "text-black" : "text-white group-hover:text-teal-400"}`}>
        {unit.title}
      </h3>

      {/* Description */}
      <p className={`mb-5 flex-1 text-sm leading-relaxed ${inverted ? "text-black/70" : "text-gray-400"}`}>
        {unit.description}
      </p>

      {/* Bottom */}
      <div className="flex flex-col gap-3">
        {/* Counts */}
        <div className={`flex items-center gap-4 text-xs ${inverted ? "text-black/70" : "text-gray-500"}`}>
          <span className="flex items-center gap-1.5">
            <FileText className={`h-3.5 w-3.5 ${inverted ? "text-black" : "text-teal-600"}`} />
            {unit.lessonCount} دروس
          </span>
          <span className="flex items-center gap-1.5">
            <Download className={`h-3.5 w-3.5 ${inverted ? "text-black" : "text-teal-600"}`} />
            {unit.fileCount} ملفات
          </span>
        </div>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); alert(`جاري تحميل ملخص PDF لوحدة: ${unit.title}`); }}
            className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors cursor-pointer w-full sm:w-auto ${
              inverted
                ? "border-black/30 bg-transparent text-black hover:bg-black/10"
                : "border-teal-800 bg-black text-teal-500 hover:border-teal-600 hover:text-teal-400"
            }`}
          >
            <Download className="h-3.5 w-3.5" />
            تحميل PDF
          </button>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onBrowse(); }}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors cursor-pointer w-full sm:w-auto ${
              inverted
                ? "bg-black text-teal-400 hover:bg-black/80"
                : "bg-teal-700 text-white hover:bg-teal-600"
            }`}
          >
            تصفح الدروس
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Long-press duration ─── */
const LONG_PRESS_MS = 1200;

function UnitCard({
  unit, onBrowse, onLongPress,
}: {
  unit: Unit;
  onBrowse: () => void;
  onLongPress: () => void;
}) {
  const [progress, setProgress] = useState(0); // 0-100
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef   = useRef<number | null>(null);
  const startRef = useRef(0);
  const fired    = useRef(false);

  const startPress = useCallback(() => {
    fired.current = false;
    startRef.current = performance.now();

    const tick = () => {
      const elapsed = performance.now() - startRef.current;
      const START_DELAY_MS = 300; // Delay before showing animation
      
      if (elapsed > START_DELAY_MS) {
        const animationElapsed = elapsed - START_DELAY_MS;
        const animationDuration = LONG_PRESS_MS - START_DELAY_MS;
        const pct = Math.min((animationElapsed / animationDuration) * 100, 100);
        setProgress(pct);
      } else {
        setProgress(0);
      }
      
      if (elapsed < LONG_PRESS_MS) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    timerRef.current = setTimeout(() => {
      fired.current = true;
      setProgress(0);
      onLongPress();
    }, LONG_PRESS_MS);
  }, [onLongPress]);

  const cancelPress = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (rafRef.current)   cancelAnimationFrame(rafRef.current);
    setProgress(0);
  }, []);

  const handleClick = () => { if (!fired.current) onBrowse(); };

  return (
    <div
      onClick={handleClick}
      onMouseDown={startPress}
      onMouseUp={cancelPress}
      onMouseLeave={cancelPress}
      onTouchStart={startPress}
      onTouchEnd={cancelPress}
      onTouchCancel={cancelPress}
      onContextMenu={(e) => e.preventDefault()}
      className="group relative rounded-2xl border border-teal-800 hover:border-teal-500 overflow-hidden cursor-pointer select-none transition-colors"
      style={{ minHeight: 280 }}
    >
      {/* ── Layer 1: Normal (black bg) ── */}
      <div className="relative z-0 h-full">
        <CardBody
          unit={unit}
          inverted={false}
          onBrowse={onBrowse}
        />
      </div>

      {/* ── Layer 2: Inverted (teal bg) — clipped to fill from bottom ── */}
      {progress > 0 && (
        <div
          className="absolute inset-0 z-10 pointer-events-none"
          style={{ clipPath: `inset(${100 - progress}% 0 0 0)` }}
        >
          <CardBody
            unit={unit}
            inverted={true}
            onBrowse={onBrowse}
          />
        </div>
      )}
    </div>
  );
}

function AddUnitCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-teal-800 bg-black p-5 transition-colors hover:border-teal-600"
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-teal-800 bg-black">
        <Plus className="h-6 w-6 text-teal-600" />
      </div>
      <p className="text-sm font-medium text-teal-600">إضافة وحدة جديدة</p>
      <p className="mt-1 text-xs text-gray-600">اضغط لإنشاء وحدة دراسية جديدة</p>
    </button>
  );
}

export default function CurriculumGrid() {
  const {
    units, searchQuery,
    setSelectedUnit,
    setUnitChatUnit,
  } = useAppContext();

  const filteredUnits = units.filter(
    (u) =>
      u.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <section className="mx-auto w-full max-w-7xl px-4 pb-20 sm:px-6">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {filteredUnits.map((unit) => (
          <UnitCard
            key={unit.id}
            unit={unit}
            onBrowse={() => {
              const url = unit.lessons?.[0]?.documents?.[0]?.url;
              if (url) {
                window.open(url, '_blank');
              } else {
                alert("عذراً، ملف الـ PDF غير متوفر لهذه الوحدة.");
              }
            }}
            onLongPress={() => setUnitChatUnit(unit)}
          />
        ))}
      </div>

      {filteredUnits.length === 0 && (
        <div className="py-20 text-center">
          <p className="text-gray-500">لا توجد وحدات تطابق بحثك.</p>
        </div>
      )}
    </section>
  );
}
