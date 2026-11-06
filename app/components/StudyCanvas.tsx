"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Check, Layers, Maximize2, Minimize2, Minus, Network, Plus, RotateCcw, Shuffle, X } from "lucide-react";
import { useAppContext, type StudySession } from "../context/AppContext";
import type { Flashcards, MindMap, MindNode } from "../lib/study";
import { usePresence } from "./chat/usePresence";
import { useWorkspace } from "./useWorkspace";
import ResizeHandle from "./ResizeHandle";

/* ───────────────────────── البطاقات ───────────────────────── */

function shuffled(n: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function CardsView({ data, front, focus }: { data: Flashcards; front: boolean; focus: boolean }) {
  const { openPage } = useAppContext();
  const n = data.cards.length;
  const [order, setOrder] = useState<number[]>(() => Array.from({ length: n }, (_, i) => i));
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<Record<number, boolean>>({});
  const [done, setDone] = useState(false);
  const [fz, setFz] = useState(1);

  const cardIdx = order[pos];
  const card = data.cards[cardIdx];
  const knownCount = Object.values(known).filter(Boolean).length;
  const unknownIdx = data.cards.map((_, i) => i).filter((i) => known[i] === false);

  const go = useCallback(
    (d: number) => {
      const p = pos + d;
      if (p < 0) return;
      if (p >= order.length) {
        setDone(true);
        return;
      }
      setFlipped(false);
      setPos(p);
    },
    [pos, order.length]
  );

  const mark = (ok: boolean) => {
    setKnown((k) => ({ ...k, [cardIdx]: ok }));
    go(1);
  };

  const restart = (list: number[]) => {
    setOrder(list);
    setPos(0);
    setFlipped(false);
    setDone(false);
  };

  useEffect(() => {
    if (!front) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT") return;
      if (e.key === "ArrowLeft") go(1);
      else if (e.key === "ArrowRight") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [front, go]);

  if (done) {
    return (
      <div className="quiz-step flex flex-1 flex-col items-center justify-center gap-5 px-6 py-8 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-900 text-emerald-300">
          <Check aria-hidden className="h-8 w-8" />
        </span>
        <div>
          <p className="text-2xl font-bold text-white">
            حفظت {knownCount} من {n}
          </p>
          <p className="mt-1 text-gray-400">
            {unknownIdx.length ? `باقي ${unknownIdx.length} تحتاج مراجعة` : "ممتاز، كل البطاقات محفوظة"}
          </p>
        </div>
        <div className="flex w-full max-w-xs flex-col gap-2">
          {unknownIdx.length > 0 && (
            <button
              type="button"
              onClick={() => restart(unknownIdx)}
              className="press h-12 rounded-2xl bg-teal-700 font-semibold text-white hover:bg-teal-600"
            >
              راجع غير المحفوظة ({unknownIdx.length})
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setKnown({});
              restart(shuffled(n));
            }}
            className="press flex h-12 items-center justify-center gap-2 rounded-2xl border border-[#2a3838] text-gray-100 hover:bg-[#1c2626]"
          >
            إعادة الكل بترتيب جديد
            <RotateCcw aria-hidden className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex shrink-0 gap-1 px-5 pt-4" aria-hidden>
        {order.map((ci, i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
              known[ci] === true ? "bg-emerald-500" : known[ci] === false ? "bg-amber-400" : i === pos ? "bg-teal-400" : "bg-[#1c2626]"
            }`}
          />
        ))}
      </div>
      <div className="flex flex-1 flex-col overflow-y-auto overscroll-contain px-5 py-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-400">
            بطاقة {pos + 1} من {order.length}
          </p>
          <div className="flex items-center gap-1" aria-label="حجم النص">
            <button type="button" aria-label="تصغير النص" onClick={() => setFz((z) => Math.max(0.7, +(z - 0.15).toFixed(2)))} className="press flex h-11 w-11 items-center justify-center rounded-full text-sm text-gray-300 hover:bg-[#1c2626]">
              أ-
            </button>
            <button type="button" aria-label="تكبير النص" onClick={() => setFz((z) => Math.min(1.8, +(z + 0.15).toFixed(2)))} className="press flex h-11 w-11 items-center justify-center rounded-full text-base text-gray-300 hover:bg-[#1c2626]">
              أ+
            </button>
          </div>
        </div>
        <div
          key={pos}
          role="button"
          tabIndex={0}
          aria-label={flipped ? "الوجه الخلفي، اضغط للرجوع للسؤال" : "السؤال، اضغط لإظهار الإجابة"}
          onClick={() => setFlipped((f) => !f)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setFlipped((f) => !f);
            }
          }}
          className="fc-scene quiz-step mt-3 min-h-[280px] flex-1 cursor-pointer select-none outline-none"
        >
          <div className="fc-inner" data-flipped={flipped}>
            <div className="fc-face border-transparent bg-[#0f766e] text-white">
              <span className="absolute top-4 start-4 text-xs font-semibold opacity-80">السؤال</span>
              <p style={{ fontSize: `${1.5 * fz * (focus ? 1.35 : 1)}rem` }} className="text-center font-bold leading-relaxed">{card.front}</p>
              <span className="absolute bottom-4 text-xs font-medium opacity-75">اضغط لإظهار الإجابة</span>
            </div>
            <div className="fc-face fc-back border-transparent bg-[#14302d] text-[#e6f4f1]">
              <span className="absolute top-4 start-4 text-xs font-semibold opacity-80">الإجابة</span>
              <p style={{ fontSize: `${1.125 * fz * (focus ? 1.35 : 1)}rem` }} className="text-center font-medium leading-loose">{card.back}</p>
              {card.page != null && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openPage(card.page!, [card.back, card.front]);
                  }}
                  className="press absolute bottom-3 flex items-center gap-1.5 rounded-full bg-[#0a1b1a] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#102826]"
                >
                  ص {card.page}
                  <BookOpen aria-hidden className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      <footer className="flex shrink-0 items-center gap-2 border-t border-[#1f2b2b] px-5 py-4">
        {flipped ? (
          <>
            <button
              type="button"
              onClick={() => mark(false)}
              className="press h-12 flex-1 rounded-2xl bg-amber-700 font-semibold text-white hover:bg-amber-600"
            >
              أراجعها
            </button>
            <button
              type="button"
              onClick={() => mark(true)}
              className="press h-12 flex-1 rounded-2xl bg-emerald-700 font-semibold text-white hover:bg-emerald-600"
            >
              حفظتها
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              disabled={pos === 0}
              className="press h-12 rounded-2xl border border-[#2a3838] px-5 text-gray-100 hover:bg-[#1c2626] disabled:opacity-30"
            >
              السابقة
            </button>
            <button
              type="button"
              onClick={() => setFlipped(true)}
              className="press h-12 flex-1 rounded-2xl bg-teal-700 font-semibold text-white hover:bg-teal-600"
            >
              أظهر الإجابة
            </button>
            <button
              type="button"
              onClick={() => {
                setKnown({});
                restart(shuffled(n));
              }}
              aria-label="خلط البطاقات"
              title="خلط البطاقات"
              className="press flex h-12 w-12 items-center justify-center rounded-2xl border border-[#2a3838] text-gray-300 hover:bg-[#1c2626]"
            >
              <Shuffle aria-hidden className="h-5 w-5" />
            </button>
          </>
        )}
      </footer>
    </>
  );
}

/* ───────────────────────── الخريطة الذهنية ───────────────────────── */

// ألوان هادئة وغامقة (نص أبيض مريح) + درجة أفتح للخطوط الواصلة
const TONES = [
  { fill: "#4d7c0f", line: "#92c53f" },
  { fill: "#92590a", line: "#cf9a33" },
  { fill: "#9f2f4a", line: "#d9607d" },
  { fill: "#0b6a9c", line: "#43a6dc" },
  { fill: "#0f7a57", line: "#3cb98a" },
  { fill: "#a2480a", line: "#dd8a3e" },
  { fill: "#0f766e", line: "#40b8ac" },
];
const NODE_W = 142;
const COL_W = 172;
const ROW_H = 58;
const NODE_H = 46;
const ROOT_W = 128;
const PAD = 16;
const K_MIN = 0.3;
const K_MAX = 2.6;

interface LNode {
  id: string;
  node: MindNode;
  depth: number;
  tone: number;
  x: number;
  y: number;
  w: number;
  h: number;
  hasKids: boolean;
  kids: LNode[];
}

function depthOf(n: MindNode): number {
  return 1 + Math.max(0, ...(n.children ?? []).map(depthOf));
}

function layout(root: MindNode, collapsed: Set<string>) {
  const D = depthOf(root) - 1;
  let row = 0;
  const build = (n: MindNode, id: string, depth: number, tone: number): LNode => {
    const showKids = !collapsed.has(id) && !!n.children?.length;
    const kids = showKids ? n.children!.map((c, i) => build(c, `${id}.${i}`, depth + 1, depth === 0 ? i % TONES.length : tone)) : [];
    const w = depth === 0 ? ROOT_W : NODE_W;
    const x = PAD + (D - depth) * COL_W + (depth === 0 ? NODE_W - ROOT_W : 0);
    const y = kids.length ? (kids[0].y + kids[kids.length - 1].y) / 2 : PAD + NODE_H / 2 + row++ * ROW_H;
    return { id, node: n, depth, tone, x, y, w, h: depth === 0 ? 60 : NODE_H, hasKids: !!n.children?.length, kids };
  };
  const tree = build(root, "0", 0, 0);
  const flat: LNode[] = [];
  const walk = (l: LNode) => {
    flat.push(l);
    l.kids.forEach(walk);
  };
  walk(tree);
  const W = PAD * 2 + D * COL_W + NODE_W;
  const H = PAD * 2 + Math.max(1, row) * ROW_H - (ROW_H - NODE_H);
  return { flat, W, H };
}

type View = { x: number; y: number; k: number };

function MapView({ data, front }: { data: MindMap; front: boolean }) {
  const { openPage } = useAppContext();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [sel, setSel] = useState<string | null>(null);
  const { flat, W, H } = useMemo(() => layout(data.root, collapsed), [data.root, collapsed]);

  const boxRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const view = useRef<View>({ x: 0, y: 0, k: 1 });
  const size = useRef({ w: 0, h: 0 });
  const dims = useRef({ W, H });
  const raf = useRef(0);
  const touched = useRef(false);
  const moved = useRef(false);

  useLayoutEffect(() => {
    dims.current = { W, H };
  }, [W, H]);

  const paint = useCallback(() => {
    const v = view.current;
    const el = innerRef.current;
    if (el) el.style.transform = `translate3d(${v.x}px, ${v.y}px, 0) scale(${v.k})`;
  }, []);

  /** يبقي جزءاً من الخريطة ظاهراً دائماً */
  const clampView = useCallback(() => {
    const v = view.current;
    const { W: cw, H: ch } = dims.current;
    const m = 90;
    v.x = Math.min(size.current.w - m, Math.max(m - cw * v.k, v.x));
    v.y = Math.min(size.current.h - m, Math.max(m - ch * v.k, v.y));
  }, []);

  const stop = useCallback(() => cancelAnimationFrame(raf.current), []);

  /** حركة ناعمة نحو هدف (تخميد حرج: بدون ارتداد مزعج) */
  const glide = useCallback(
    (t: View) => {
      stop();
      let last = performance.now();
      const step = (now: number) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        const v = view.current;
        const a = 1 - Math.exp(-dt * 10);
        v.x += (t.x - v.x) * a;
        v.y += (t.y - v.y) * a;
        v.k += (t.k - v.k) * a;
        paint();
        if (Math.abs(t.x - v.x) + Math.abs(t.y - v.y) > 0.4 || Math.abs(t.k - v.k) > 0.002) raf.current = requestAnimationFrame(step);
        else {
          Object.assign(v, t);
          paint();
        }
      };
      raf.current = requestAnimationFrame(step);
    },
    [paint, stop]
  );

  const fitView = useCallback((): View => {
    const { W: cw, H: ch } = dims.current;
    const { w, h } = size.current;
    if (!w || !h) return { x: 0, y: 0, k: 1 };
    const k = Math.max(0.35, Math.min(1.15, (w - 24) / cw, (h - 24) / ch));
    return { k, x: (w - cw * k) / 2, y: Math.max(12, (h - ch * k) / 2) };
  }, []);

  const zoomAt = useCallback((cx: number, cy: number, f: number): View => {
    const v = view.current;
    const k = Math.min(K_MAX, Math.max(K_MIN, v.k * f));
    return { k, x: cx - (cx - v.x) * (k / v.k), y: cy - (cy - v.y) * (k / v.k) };
  }, []);

  const zoomBy = useCallback(
    (f: number) => {
      touched.current = true;
      glide(zoomAt(size.current.w / 2, size.current.h / 2, f));
    },
    [glide, zoomAt]
  );

  // حجم الإطار: أول مرة (أو قبل أي تحريك) نعرض الخريطة كاملة
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      size.current = { w: el.clientWidth, h: el.clientHeight };
      if (!touched.current) {
        Object.assign(view.current, fitView());
        paint();
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fitView, paint]);

  // الطي/الفتح: أعد الاحتواء ما لم يكن المستخدم قد حرّك الخريطة
  useEffect(() => {
    if (!touched.current && size.current.w) glide(fitView());
  }, [W, H, fitView, glide]);

  // عجلة الفأرة / قرص اللمس: تكبير حول المؤشر
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      touched.current = true;
      stop();
      const r = el.getBoundingClientRect();
      const f = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0016));
      Object.assign(view.current, zoomAt(e.clientX - r.left, e.clientY - r.top, f));
      clampView();
      paint();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [stop, zoomAt, clampView, paint]);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  useEffect(() => {
    if (!front) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "+" || e.key === "=") zoomBy(1.25);
      else if (e.key === "-") zoomBy(0.8);
      else if (e.key === "0") {
        touched.current = false;
        glide(fitView());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [front, zoomBy, glide, fitView]);

  // ── سحب + قرص بإصبعين + قصور ذاتي ──
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef({ vx: 0, vy: 0, t: 0 });
  const pinch = useRef({ d0: 1, k0: 1, ax: 0, ay: 0 });

  const startPinch = () => {
    const [a, b] = [...pts.current.values()];
    const r = boxRef.current!.getBoundingClientRect();
    const cx = (a.x + b.x) / 2 - r.left;
    const cy = (a.y + b.y) / 2 - r.top;
    const v = view.current;
    pinch.current = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, k0: v.k, ax: (cx - v.x) / v.k, ay: (cy - v.y) / v.k };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    stop();
    touched.current = true;
    moved.current = false;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    drag.current = { vx: 0, vy: 0, t: performance.now() };
    if (pts.current.size === 2) startPinch();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = pts.current.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    const v = view.current;
    if (pts.current.size >= 2) {
      const [a, b] = [...pts.current.values()];
      const r = boxRef.current!.getBoundingClientRect();
      const cx = (a.x + b.x) / 2 - r.left;
      const cy = (a.y + b.y) / 2 - r.top;
      const k = Math.min(K_MAX, Math.max(K_MIN, (pinch.current.k0 * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.current.d0));
      v.k = k;
      v.x = cx - pinch.current.ax * k;
      v.y = cy - pinch.current.ay * k;
      moved.current = true;
    } else {
      if (!moved.current) {
        if (Math.hypot(dx, dy) < 2) return;
        moved.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
      }
      const now = performance.now();
      const dt = Math.max(1, now - drag.current.t) / 1000;
      drag.current = { vx: drag.current.vx * 0.7 + (dx / dt) * 0.3, vy: drag.current.vy * 0.7 + (dy / dt) * 0.3, t: now };
      v.x += dx;
      v.y += dy;
    }
    clampView();
    paint();
  };

  const release = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pts.current.delete(e.pointerId)) return;
    if (pts.current.size === 1) {
      drag.current = { vx: 0, vy: 0, t: performance.now() };
      return;
    }
    if (pts.current.size > 0 || !moved.current) return;
    // قصور ذاتي بعد رفع الإصبع
    let { vx, vy } = drag.current;
    if (performance.now() - drag.current.t > 90 || Math.hypot(vx, vy) < 60) return;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const f = Math.exp(-dt * 4.2);
      vx *= f;
      vy *= f;
      view.current.x += vx * dt;
      view.current.y += vy * dt;
      clampView();
      paint();
      if (Math.hypot(vx, vy) > 12) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  };

  const selected = flat.find((l) => l.id === sel) ?? null;
  const toggle = (id: string) =>
    setCollapsed((c) => {
      const n = new Set(c);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <>
      <div className="flex shrink-0 items-center justify-between gap-2 px-5 pt-3">
        <p className="text-sm text-gray-400">اسحب للتحرك · العجلة أو القرص للتكبير · اضغط فرعاً لتفاصيله</p>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="تصغير" onClick={() => zoomBy(0.8)} className="press flex h-11 w-11 items-center justify-center rounded-full text-gray-300 hover:bg-[#1c2626]">
            <Minus aria-hidden className="h-4 w-4" />
          </button>
          <button type="button" aria-label="تكبير" onClick={() => zoomBy(1.25)} className="press flex h-11 w-11 items-center justify-center rounded-full text-gray-300 hover:bg-[#1c2626]">
            <Plus aria-hidden className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="احتواء الخريطة"
            title="احتواء الخريطة (0)"
            onClick={() => {
              touched.current = false;
              glide(fitView());
            }}
            className="press flex h-11 w-11 items-center justify-center rounded-full text-gray-300 hover:bg-[#1c2626]"
          >
            <Maximize2 aria-hidden className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        ref={boxRef}
        dir="ltr"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={release}
        onPointerCancel={release}
        onClickCapture={(e) => {
          if (moved.current) {
            e.stopPropagation();
            e.preventDefault();
            moved.current = false;
          }
        }}
        className="mm-box relative mt-2 min-h-0 flex-1 cursor-grab touch-none overflow-hidden active:cursor-grabbing"
      >
        <div ref={innerRef} style={{ width: W, height: H, transformOrigin: "0 0", willChange: "transform" }} className="absolute left-0 top-0">
          <svg width={W} height={H} className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden>
            {flat.flatMap((p) =>
              p.kids.map((c) => {
                const x1 = p.x;
                const x2 = c.x + c.w;
                const mx = (x1 + x2) / 2;
                return (
                  <path
                    key={c.id}
                    d={`M ${x1} ${p.y} C ${mx} ${p.y}, ${mx} ${c.y}, ${x2} ${c.y}`}
                    fill="none"
                    stroke={TONES[c.tone].line}
                    strokeWidth={p.depth === 0 ? 2.6 : 1.9}
                    strokeLinecap="round"
                  />
                );
              })
            )}
          </svg>
          {flat.map((l, i) => {
            const isSel = l.id === sel;
            const root = l.depth === 0;
            const tone = TONES[l.tone];
            return (
              <React.Fragment key={l.id}>
                <button
                  type="button"
                  dir="rtl"
                  onClick={() => setSel(l.id)}
                  aria-pressed={isSel}
                  className="mm-node press absolute flex items-center justify-center rounded-xl px-2 text-center text-[12.5px] font-semibold leading-tight text-white"
                  style={
                    {
                      "--d": i,
                      left: l.x,
                      top: l.y - l.h / 2,
                      width: l.w,
                      height: l.h,
                      background: root ? "#0b3b38" : l.depth === 1 ? tone.fill : `color-mix(in srgb, ${tone.fill} 80%, #000)`,
                      border: `2px solid ${isSel ? "#fff" : root ? "#2dd4bf" : "transparent"}`,
                      fontSize: root ? 14 : undefined,
                    } as React.CSSProperties
                  }
                >
                  <span className="line-clamp-3">{l.node.label}</span>
                </button>
                {l.hasKids && !root && (
                  <button
                    type="button"
                    aria-label={collapsed.has(l.id) ? "فتح الفرع" : "طي الفرع"}
                    onClick={() => toggle(l.id)}
                    className="press absolute flex h-5 w-5 items-center justify-center rounded-full before:absolute before:-inset-3 before:content-['']"
                    style={{ left: l.x - 10, top: l.y - 10, background: tone.line, color: "#0b1412", boxShadow: "0 0 0 3px #070b0b" }}
                  >
                    {collapsed.has(l.id) ? <Plus aria-hidden className="h-3 w-3" /> : <Minus aria-hidden className="h-3 w-3" />}
                  </button>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <footer className="min-h-[88px] shrink-0 border-t border-[#1f2b2b] px-5 py-3">
        {selected ? (
          <div key={selected.id} className="quiz-step flex items-start gap-3">
            <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full" style={{ background: TONES[selected.tone].line }} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-white">{selected.node.label}</p>
              {selected.node.note && <p className="mt-1 text-sm leading-relaxed text-gray-300">{selected.node.note}</p>}
            </div>
            {selected.node.page != null && (
              <button
                type="button"
                onClick={() => openPage(selected.node.page!, [selected.node.label, selected.node.note ?? ""].filter(Boolean))}
                className="press flex shrink-0 items-center gap-1.5 rounded-full bg-teal-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700"
              >
                ص {selected.node.page}
                <BookOpen aria-hidden className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400">اختر فرعاً لعرض شرحه ورقم صفحته في الكتاب.</p>
        )}
      </footer>
    </>
  );
}

/* ───────────────────────── اللوحة ───────────────────────── */

export default function StudyCanvas() {
  const ws = useWorkspace();
  const slot = ws.slots.quiz;
  const { activeStudy, closeStudy, studyFocus, setStudyFocus } = useAppContext();
  const { mounted, visible } = usePresence(activeStudy !== null);
  const [shown, setShown] = useState<StudySession | null>(null);
  const focus = studyFocus && activeStudy !== null;
  useEffect(() => {
    if (!focus) return;
    const on = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        setStudyFocus(false);
      }
    };
    window.addEventListener("keydown", on, true);
    return () => window.removeEventListener("keydown", on, true);
  }, [focus, setStudyFocus]);

  if (activeStudy && activeStudy !== shown) setShown(activeStudy);

  const panelRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const el = panelRef.current;
    const o = shown?.origin;
    if (!el || !mounted) return;
    if (!o) {
      el.style.transformOrigin = "50% 50%";
      return;
    }
    const r = el.getBoundingClientRect();
    el.style.transformOrigin = `${o.x - r.left}px ${o.y - r.top}px`;
  }, [mounted, shown]);

  useEffect(() => {
    if (!activeStudy) return;
    const t = setTimeout(() => panelRef.current?.focus({ preventScroll: true }), 80);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && ws.front === "quiz") closeStudy();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [activeStudy, closeStudy, ws.front]);

  if (!mounted || !shown) return null;
  const state = visible ? "open" : "closed";
  const isMap = shown.study.kind === "mindmap";
  const front = ws.front === "quiz";

  return (
    <>
      <div
        aria-hidden
        data-state={state}
        onClick={closeStudy}
        className="yz-scrim fixed inset-0 bg-black/60 lg:hidden"
        style={{ zIndex: ws.z("quiz") - 1 }}
      />
      <section
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="false"
        aria-labelledby="study-title"
        data-state={state}
        onPointerDownCapture={() => ws.front !== "quiz" && ws.bringToFront("quiz")}
        style={{
          zIndex: focus ? 90 : ws.z("quiz"),
          ...(focus
            ? { left: 0, top: 0, bottom: 0, right: "auto", width: ws.vw, borderRadius: 0, borderWidth: 0, ["--focus-w" as string]: shown?.study.kind === "mindmap" ? "100%" : "820px" }
            : slot
            ? { left: slot.left, width: slot.width, right: "auto", top: 16, bottom: 16 }
            : ws.overlayWidth("quiz")
            ? { width: ws.overlayWidth("quiz") }
            : {}),
        }}
        className={`yz-canvas ws-morph ${focus ? "focus-mode" : ""} fixed inset-0 flex flex-col overflow-hidden bg-[#070b0b] shadow-2xl shadow-black outline-none sm:inset-4 sm:rounded-3xl sm:border sm:border-[#1f2b2b] lg:inset-y-4 lg:right-auto lg:left-4 lg:w-[560px]`}
      >
        <ResizeHandle id="quiz" />
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#1f2b2b] px-5 py-4">
          <div className="fm-hide min-w-0">
            <p className="flex items-center gap-1.5 text-sm text-teal-400">
              {isMap ? "خريطة ذهنية" : "بطاقات مراجعة"} · {shown.unitTitle}
              {isMap ? <Network aria-hidden className="h-4 w-4" /> : <Layers aria-hidden className="h-4 w-4" />}
            </p>
            <h2 id="study-title" className="truncate text-2xl font-bold text-white">
              {shown.study.data.title}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setStudyFocus(!studyFocus)}
              aria-label={focus ? "الخروج من وضع التركيز" : "وضع التركيز (ملء الشاشة)"}
              title={focus ? "خروج (Esc)" : "ملء الشاشة"}
              className="press flex h-10 w-10 items-center justify-center rounded-full text-gray-400 hover:bg-[#1c2626] hover:text-white"
            >
              {focus ? <Minimize2 aria-hidden className="h-5 w-5" /> : <Maximize2 aria-hidden className="h-5 w-5" />}
            </button>
            <button
              type="button"
              onClick={closeStudy}
              aria-label="إغلاق"
              className="press flex h-10 w-10 items-center justify-center rounded-full text-gray-400 hover:bg-[#1c2626] hover:text-white"
            >
              <X aria-hidden className="h-5 w-5" />
            </button>
          </div>
        </header>
        {shown.study.kind === "mindmap" ? (
          <MapView key={shown.id} data={shown.study.data} front={front} />
        ) : (
          <CardsView key={shown.id} data={shown.study.data} front={front} focus={focus} />
        )}
      </section>
    </>
  );
}
