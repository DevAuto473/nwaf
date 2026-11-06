"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Brain, Check, Copy, ExternalLink, FileText, Layers, ListChecks, Loader2, Network, Redo2, ScrollText, Search, SquareDashedMousePointer,
  Undo2, Volume2, VolumeX, X,
} from "lucide-react";
import type { PageFlip as PageFlipT } from "page-flip/dist/js/page-flip.module.js";
import { useAppContext } from "../context/AppContext";
import { usePresence } from "./chat/usePresence";
import { BOOK_PAGES, keyTerms, locatePage, pickHighlights } from "../lib/pageHighlight";
import { cleanSelection, getBookPage, getPdfjs, pageImage } from "../lib/pdfBook";
import { playFlip, playHighlight, preloadBookSounds } from "../lib/flipSound";
import { useWorkspace } from "./useWorkspace";
import StudyBuilder, { studyPrompt } from "./StudyBuilder";

/*
 * كتاب حقيقي بمكتبة StPageFlip (طيّ قطري للورقة + ظلال).
 * المكتبة من اليسار لليمين فقط، فنرتّب الصفحات معكوسة:
 * الفهرس 0 = آخر صفحة … الفهرس 276 = الصفحة 1.
 * النتيجة كتاب عربي: الصفحة اليمنى رقمها أصغر، والتالية تُقلب من اليسار.
 */
const toIndex = (page: number) => BOOK_PAGES - page;
const toPage = (index: number) => BOOK_PAGES - index;
const RATIO = 821.5 / 637.3; // الارتفاع ÷ العرض لصفحات الكتاب
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

type SelMenu = { text: string; page: number; x: number; y: number; below: boolean; source: "select" | "area" };
type Rect = { x: number; y: number; w: number; h: number };

function useSize(ref: React.RefObject<HTMLElement | null>, active: boolean) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !active) return;
    const ro = new ResizeObserver(([e]) => {
      const r = e.contentRect;
      setSize((s) => (Math.abs(s.w - r.width) < 2 && Math.abs(s.h - r.height) < 2 ? s : { w: r.width, h: r.height }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, active]);
  return size;
}

export default function BookViewer() {
  const { pageView, closePage, askYazid } = useAppContext();
  const ws = useWorkspace();
  const { mounted, visible } = usePresence(pageView !== null);
  const vw = ws.vw;

  const [muted, setMuted] = useState(() => {
    try {
      return typeof window !== "undefined" && localStorage.getItem("book-muted") === "1";
    } catch {
      return false;
    }
  });
  const mutedRef = useRef(muted);
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  // ── مكانه في مساحة العمل: عمود بجانب المحادثة/الاختبار، أو كامل الشاشة ──
  const slot = ws.slots.book;
  const docked = !!slot;
  const style: React.CSSProperties = {
    zIndex: ws.z("book"),
    ...(slot ? { left: slot.left, width: slot.width, right: "auto", top: 16, bottom: 16 } : {}),
  };

  // ── مقاس الصفحة: صفحتان متقابلتان إذا اتسعت المساحة، وإلا صفحة واحدة ──
  const stageRef = useRef<HTMLDivElement>(null);
  const stage = useSize(stageRef, mounted);
  const padX = vw < 640 ? 8 : 56; // مساحة الأسهم (على الجوال الأسهم بالأسفل)
  const padY = vw < 640 ? 64 : 24;
  const spreadW = Math.floor(Math.min((stage.w - padX * 2) / 2, (stage.h - padY * 2) / RATIO));
  const spread = spreadW >= 300;
  const pageW = Math.max(
    160,
    spread ? spreadW : Math.floor(Math.min(stage.w - padX * 2, (stage.h - padY * 2) / RATIO))
  );
  // تقريب حتى لا نعيد بناء الكتاب مع كل بكسل
  const liveKey = stage.w ? `${spread ? "s" : "p"}-${Math.round(pageW / 16) * 16}` : "";
  const [layoutKey, setLayoutKey] = useState("");
  const [resizing, setResizing] = useState(false);
  useEffect(() => {
    if (liveKey === layoutKey) return;
    const t0 = setTimeout(() => setResizing(true), 0);
    const t = setTimeout(() => {
      setLayoutKey(liveKey);
      setResizing(false);
    }, layoutKey ? 480 : 0);
    return () => {
      clearTimeout(t0);
      clearTimeout(t);
    };
  }, [liveKey, layoutKey]);
  // المقاس الفعلي للكتاب المبني (يتغير مع layoutKey فقط)
  const builtW = layoutKey ? Number(layoutKey.split("-")[1]) : pageW;
  const builtSpread = layoutKey.startsWith("s");

  // ── حالة الكتاب ──
  const bookHostRef = useRef<HTMLDivElement>(null);
  const pfRef = useRef<PageFlipT | null>(null);
  const pagesRef = useRef<HTMLElement[]>([]);
  const [visiblePages, setVisiblePages] = useState<number[]>([]);
  const [busy, setBusy] = useState(true);
  const currentPageRef = useRef(pageView?.page ?? 1);
  const pageViewRef = useRef(pageView);
  useEffect(() => {
    pageViewRef.current = pageView;
  }, [pageView]);

  /** املأ الصفحات القريبة بالصور (الكتاب 277 صفحة — لا نرسمها كلها) */
  const fillAround = useCallback((center: number, w: number) => {
    for (let p = center - 4; p <= center + 5; p++) {
      if (p < 1 || p > BOOK_PAGES) continue;
      const el = pagesRef.current[toIndex(p)];
      if (!el || el.dataset.img === String(w)) continue;
      el.dataset.img = String(w);
      pageImage(p, w).then(
        (img) => {
          const holder = el.querySelector<HTMLImageElement>("img.bk-img");
          if (holder) {
            holder.src = img.url;
            holder.classList.add("ready");
          }
        },
        () => {
          delete el.dataset.img;
        }
      );
    }
  }, []);

  /** طبقة النص (للتحديد) + تظليل الإجابة على الصفحات الظاهرة */
  const decorate = useCallback(async (pages: number[], w: number) => {
    const pdfjs = await getPdfjs();
    const pv = pageViewRef.current;
    for (const p of pages) {
      const el = pagesRef.current[toIndex(p)];
      if (!el) continue;
      const host = el.querySelector<HTMLDivElement>(".textLayer");
      if (!host) continue;
      const wantHl = pv && pv.page === p && pv.highlight.length ? String(pv.key) : "";
      if (host.dataset.w === String(w) && el.dataset.hl === wantHl) continue;
      try {
        const pdfPage = await getBookPage(p);
        const base = pdfPage.getViewport({ scale: 1 });
        const viewport = pdfPage.getViewport({ scale: w / base.width });
        const content = await pdfPage.getTextContent();
        if (host.dataset.w !== String(w)) {
          host.replaceChildren();
          host.style.setProperty("--total-scale-factor", String(viewport.scale));
          await new pdfjs.TextLayer({ textContentSource: content, container: host, viewport }).render();
          // نفس حيلة عارض pdf.js: عنصر في نهاية الطبقة يمنع التحديد من القفز لكتل كبيرة
          const end = document.createElement("div");
          end.className = "endOfContent";
          host.appendChild(end);
          host.dataset.w = String(w);
        }
        // التظليل
        const hlLayer = el.querySelector<HTMLDivElement>(".hl-layer");
        hlLayer?.replaceChildren();
        el.dataset.hl = wantHl;
        if (wantHl && pv) {
          const items = content.items.filter(
            (it): it is Extract<(typeof content.items)[number], { str: string }> => "str" in it
          );
          const idx = pickHighlights(items.map((i) => i.str), keyTerms(pv.highlight));
          idx.forEach((i, n) => {
            const it = items[i];
            const tx = pdfjs.Util.transform(viewport.transform, it.transform);
            const h = Math.hypot(tx[2], tx[3]);
            const span = document.createElement("span");
            span.className = "page-hl";
            span.style.cssText = `left:${tx[4] - 3}px;top:${tx[5] - h * 1.05}px;width:${it.width * viewport.scale + 6}px;height:${h * 1.4}px;animation-delay:${n * 40 + 250}ms`;
            hlLayer?.appendChild(span);
          });
        }
      } catch (e) {
        console.warn("BookViewer:", e);
      }
    }
  }, []);

  const readVisible = useCallback(() => {
    const pf = pfRef.current;
    if (!pf) return [];
    // المكتبة تعرض صفحة الفهرس الحالي والتي بعده (في وضع الصفحتين)
    const idx = pf.getCurrentPageIndex();
    const both = [idx, idx + 1]
      .filter((i) => i >= 0 && i < BOOK_PAGES)
      .filter((i) => pagesRef.current[i]?.style.display === "block");
    return (both.length ? both : [idx]).map(toPage).sort((a, b) => a - b);
  }, []);

  // ── بناء الكتاب (ومعه إعادة البناء عند تغيير المقاس) ──
  useEffect(() => {
    const host = bookHostRef.current;
    if (!mounted || !host || !layoutKey) return;
    let disposed = false;
    let pf: PageFlipT | null = null;
    const w = builtW;
    setBusy(true);

    (async () => {
      const { PageFlip } = await import("page-flip/dist/js/page-flip.module.js");
      if (disposed) return;
      host.replaceChildren();
      const book = document.createElement("div");
      book.className = "bk-book";
      host.appendChild(book);

      const pages: HTMLElement[] = [];
      for (let i = 0; i < BOOK_PAGES; i++) {
        const p = toPage(i);
        const el = document.createElement("div");
        el.className = "bk-page";
        el.dataset.page = String(p);
        // الغلاف (أول وآخر صفحة) ورق مقوّى
        el.dataset.density = p === 1 || p === BOOK_PAGES ? "hard" : "soft";
        el.innerHTML = `<div class="bk-paper"><img class="bk-img" alt="" draggable="false"/><div class="hl-layer"></div><div class="textLayer"></div><div class="bk-gutter"></div></div>`;
        pages.push(el);
        book.appendChild(el);
      }
      pagesRef.current = pages;

      pf = new PageFlip(book, {
        width: w,
        height: Math.floor(w * RATIO),
        size: "fixed",
        startPage: toIndex(currentPageRef.current),
        showCover: true,
        usePortrait: !builtSpread,
        drawShadow: true,
        maxShadowOpacity: 0.55,
        flippingTime: 850,
        mobileScrollSupport: false,
        showPageCorners: true,
        disableFlipByClick: true,
        swipeDistance: 40,
        autoSize: false,
      });
      pfRef.current = pf;
      fillAround(currentPageRef.current, w);
      pf.loadFromHTML(pages);


      const settle = () => {
        if (disposed) return;
        const vis = readVisible();
        if (!vis.length) return;
        currentPageRef.current = vis[0];
        setVisiblePages(vis);
        fillAround(vis[0], w);
        void decorate(vis, w);
      };
      pf.on("changeState", (e) => {
        if (e.data === "flipping" && !mutedRef.current) playFlip();
        if (e.data === "read") settle();
      });
      pf.on("flip", () => {
        // اسبق التقليب القادم بالصور
        const idx = pf?.getCurrentPageIndex() ?? 0;
        fillAround(toPage(idx), w);
      });
      setTimeout(() => {
        settle();
        setBusy(false);
      }, 80);
      setTimeout(settle, 600); // بعد أن تستقر المكتبة
    })();

    return () => {
      disposed = true;
      try {
        pf?.destroy();
      } catch {
        /* ignore */
      }
      pfRef.current = null;
      host.replaceChildren();
      pagesRef.current = [];
    };
  }, [mounted, layoutKey, builtW, builtSpread, fillAround, decorate, readVisible]);

  // ── فتح صفحة محددة (من رابط صفحة في الاختبار أو المحادثة) ──
  const lastKey = useRef<number | null>(null);
  useEffect(() => {
    if (!pageView || pageView.key === lastKey.current) return;
    lastKey.current = pageView.key;
    currentPageRef.current = pageView.page;
    const pf = pfRef.current;
    if (!pf) return; // سيُفتح عليها عند البناء
    const vis = readVisible();
    if (vis.includes(pageView.page)) {
      void decorate(vis, builtW); // نفس الصفحة ظاهرة — ظلّل فقط
      return;
    }
    fillAround(pageView.page, builtW);
    const far = Math.abs((vis[0] ?? 1) - pageView.page) > 6;
    if (far) {
      pf.turnToPage(toIndex(pageView.page));
      setTimeout(() => {
        const v = readVisible();
        setVisiblePages(v);
        void decorate(v, builtW);
      }, 80);
    } else pf.flip(toIndex(pageView.page), "bottom");
  }, [pageView, readVisible, decorate, fillAround, builtW]);

  // كتاب عربي: "التالي" = فهارس أصغر في المكتبة
  // نسمح مؤقتاً بالتقليب بالنقر: في وضع الصفحة الواحدة تضع المكتبة زاوية الصفحة السابقة
  // خارج الشاشة، فيُعامَل الزر كنقرة عادية ويُرفض
  const turn = useCallback((dir: 1 | -1) => {
    const pf = pfRef.current;
    if (!pf) return;
    const st = (pf as unknown as { getSettings: () => { disableFlipByClick: boolean } }).getSettings();
    const was = st.disableFlipByClick;
    st.disableFlipByClick = false;
    try {
      if (dir === 1) pf.flipPrev("bottom");
      else pf.flipNext("bottom");
    } finally {
      st.disableFlipByClick = was;
    }
  }, []);
  const next = useCallback(() => turn(1), [turn]);
  const prev = useCallback(() => turn(-1), [turn]);

  // ── منع المكتبة من أخذ الضغط على النص (حتى يعمل التحديد بالماوس) ──
  useEffect(() => {
    const host = bookHostRef.current;
    if (!host || !mounted) return;
    const guard = (e: MouseEvent | TouchEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest?.(".textLayer span")) return;
      // قرب الزوايا نترك المكتبة تمسك الورقة
      const pt = "touches" in e ? e.touches[0] : e;
      const pageEl = t.closest<HTMLElement>(".bk-page");
      if (pageEl && pt) {
        const r = pageEl.getBoundingClientRect();
        const nearX = Math.min(pt.clientX - r.left, r.right - pt.clientX) < 70;
        const nearY = Math.min(pt.clientY - r.top, r.bottom - pt.clientY) < 70;
        if (nearX && nearY) return;
      }
      e.stopPropagation();
      t.closest(".textLayer")?.classList.add("selecting");
    };
    const release = () => host.querySelectorAll(".textLayer.selecting").forEach((n) => n.classList.remove("selecting"));
    document.addEventListener("mouseup", release);
    document.addEventListener("touchend", release);
    host.addEventListener("mousedown", guard, true);
    host.addEventListener("touchstart", guard, true);
    return () => {
      host.removeEventListener("mousedown", guard, true);
      host.removeEventListener("touchstart", guard, true);
      document.removeEventListener("mouseup", release);
      document.removeEventListener("touchend", release);
    };
  }, [mounted]);

  // ── قائمة النص المحدد ──
  const [menu, setMenu] = useState<SelMenu | null>(null);
  const [copied, setCopied] = useState(false);
  // تنبيه قصير
  const [notice, setNotice] = useState<string | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; page: number } | null>(null);
  const [areaMode, setAreaMode] = useState(false);
  const [areaRect, setAreaRect] = useState<Rect | null>(null); // بإحداثيات المسرح
  const areaStart = useRef<{ x: number; y: number } | null>(null);

  /** نص كل أسطر الكتاب الظاهرة داخل مستطيل (إحداثيات الشاشة) */
  const textInRect = useCallback((r: Rect) => {
    const host = bookHostRef.current;
    if (!host) return { text: "", page: currentPageRef.current };
    let text = "";
    let firstPage = 0;
    let lastTop: number | null = null;
    let lastPage = 0;
    const pages = [...host.querySelectorAll<HTMLElement>(".bk-page")]
      .filter((p) => p.style.display === "block")
      .sort((a, b) => Number(a.dataset.page) - Number(b.dataset.page));
    for (const pageEl of pages) {
      const pg = Number(pageEl.dataset.page);
      for (const span of pageEl.querySelectorAll<HTMLElement>(".textLayer span")) {
        const b = span.getBoundingClientRect();
        if (!b.width || !span.textContent?.trim()) continue;
        const ix = Math.max(0, Math.min(b.right, r.x + r.w) - Math.max(b.left, r.x));
        const iy = Math.max(0, Math.min(b.bottom, r.y + r.h) - Math.max(b.top, r.y));
        // السطر يُحسب إذا وقع أغلبه داخل المستطيل
        if (iy < b.height * 0.5 || ix < Math.min(b.width, 24) * 0.5) continue;
        if (!firstPage) firstPage = pg;
        const newLine = lastTop === null || pg !== lastPage || Math.abs(b.top - lastTop) > b.height * 0.6;
        text += (text ? (newLine ? "\n" : " ") : "") + span.textContent;
        lastTop = b.top;
        lastPage = pg;
      }
    }
    return { text: cleanSelection(text.replace(/\n/g, " ¶ ")).replace(/ ¶ /g, "\n").replace(/¶/g, ""), page: firstPage || currentPageRef.current };
  }, []);

  const showAreaMenu = useCallback(
    (screen: Rect) => {
      const { text, page } = textInRect(screen);
      if (text.length < 2) {
        setAreaRect(null);
        setNotice("ما فيه نص في المنطقة المحددة — جرّب منطقة فيها كلام");
        return;
      }
      const below = screen.y < 90;
      setCopied(false);
      if (!mutedRef.current) playHighlight();
      setMenu({
        text: text.slice(0, 1200),
        page,
        x: clamp(screen.x + screen.w / 2, 190, window.innerWidth - 190),
        y: below ? screen.y + screen.h + 10 : screen.y - 10,
        below,
        source: "area",
      });
    },
    [textInRect]
  );

  const stageToScreen = (r: Rect): Rect => {
    const b = stageRef.current?.getBoundingClientRect();
    return b ? { x: r.x + b.left, y: r.y + b.top, w: r.w, h: r.h } : r;
  };

  const onAreaDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const b = e.currentTarget.getBoundingClientRect();
    areaStart.current = { x: e.clientX - b.left, y: e.clientY - b.top };
    setMenu(null);
    setAreaRect({ ...areaStart.current, w: 0, h: 0 });
  };
  const onAreaMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s0 = areaStart.current;
    if (!s0) return;
    const b = e.currentTarget.getBoundingClientRect();
    const x = clamp(e.clientX - b.left, 0, b.width);
    const y = clamp(e.clientY - b.top, 0, b.height);
    setAreaRect({ x: Math.min(s0.x, x), y: Math.min(s0.y, y), w: Math.abs(x - s0.x), h: Math.abs(y - s0.y) });
  };
  const onAreaUp = () => {
    const r = areaRect;
    areaStart.current = null;
    setAreaMode(false);
    if (!r || r.w < 12 || r.h < 8) {
      setAreaRect(null);
      return;
    }
    showAreaMenu(stageToScreen(r));
  };

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 2600);
    return () => clearTimeout(t);
  }, [notice]);

  // إغلاق القوائم بالضغط خارجها
  useEffect(() => {
    if (!menu && !ctxMenu) return;
    const down = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest?.(".sel-menu, .ctx-menu")) return;
      setCtxMenu(null);
      if (menu?.source === "area") {
        setMenu(null);
        setAreaRect(null);
      }
    };
    document.addEventListener("pointerdown", down, true);
    return () => document.removeEventListener("pointerdown", down, true);
  }, [menu, ctxMenu]);

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const page = Number((e.target as HTMLElement).closest<HTMLElement>(".bk-page")?.dataset.page ?? currentPageRef.current);
    setMenu(null);
    setCtxMenu({ x: clamp(e.clientX, 120, window.innerWidth - 120), y: clamp(e.clientY, 60, window.innerHeight - 140), page });
  };

  const selectWholePage = (page: number) => {
    setCtxMenu(null);
    const el = bookHostRef.current?.querySelector<HTMLElement>(`.bk-page[data-page="${page}"]`);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const st = stageRef.current?.getBoundingClientRect();
    if (st) setAreaRect({ x: r.left - st.left, y: r.top - st.top, w: r.width, h: r.height });
    showAreaMenu({ x: r.left, y: r.top, w: r.width, h: r.height });
  };
  const readSelection = useCallback(() => {
    const host = bookHostRef.current;
    const sel = window.getSelection();
    if (!host || !sel || sel.isCollapsed || !sel.rangeCount) {
      setMenu((m) => (m?.source === "area" ? m : null));
      return;
    }
    const range = sel.getRangeAt(0);
    if (!host.contains(range.commonAncestorContainer)) return;
    const text = cleanSelection(sel.toString());
    if (text.length < 2) {
      setMenu(null);
      return;
    }
    const node = range.startContainer.nodeType === 1 ? (range.startContainer as HTMLElement) : range.startContainer.parentElement;
    const page = Number(node?.closest<HTMLElement>(".bk-page")?.dataset.page ?? currentPageRef.current);
    const r = range.getBoundingClientRect();
    const below = r.top < 90;
    setCopied(false);
    if (!mutedRef.current) playHighlight();
    setMenu({
      text: text.slice(0, 700),
      page,
      x: clamp(r.left + r.width / 2, 190, window.innerWidth - 190),
      y: below ? r.bottom + 10 : r.top - 10,
      below,
      source: "select",
    });
    setAreaRect(null);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const up = () => setTimeout(readSelection, 0);
    const change = () => {
      const s = window.getSelection();
      if (!s || s.isCollapsed) setMenu((m) => (m?.source === "area" ? m : null));
    };
    document.addEventListener("mouseup", up);
    document.addEventListener("touchend", up);
    document.addEventListener("keyup", up);
    document.addEventListener("selectionchange", change);
    return () => {
      document.removeEventListener("mouseup", up);
      document.removeEventListener("touchend", up);
      document.removeEventListener("keyup", up);
      document.removeEventListener("selectionchange", change);
    };
  }, [mounted, readSelection]);

  const [builderOpen, setBuilderOpen] = useState(false);


  const act = (kind: "explain" | "define" | "quiz" | "summary" | "cards" | "map") => {
    if (!menu) return;
    const { text: t, page } = menu;
    const prompts = {
      explain: `اشرح لي هذا الجزء من صفحة ${page} بأسلوب بسيط:\n«${t}»`,
      define: `ما معنى «${t}» كما ورد في صفحة ${page} من الكتاب؟`,
      summary: `لخّص لي هذا الجزء من صفحة ${page} في نقاط قصيرة:\n«${t}»`,
      quiz: `اختبرني في هذا الجزء من صفحة ${page}: ${t}`,
      cards: `سوِّ لي بطاقات مراجعة من هذا الجزء من صفحة ${page}:\n«${t}»`,
      map: `ارسم لي خريطة ذهنية لهذا الجزء من صفحة ${page}:\n«${t}»`,
    } as const;
    const c = locatePage(page).chapter;
    const mode = kind === "quiz" ? "quiz" : kind === "cards" ? "flashcards" : kind === "map" ? "mindmap" : "chat";
    askYazid(prompts[kind], mode, c ? String(c + 1) : null, mode === "chat" || mode === "quiz" ? undefined : [page, page]);
    window.getSelection()?.removeAllRanges();
    setMenu(null);
    setAreaRect(null);
    if (vw < 1024) closePage(); // الشاشة الصغيرة: أفسح المكان للمحادثة
  };

  const copy = async () => {
    if (!menu) return;
    try {
      await navigator.clipboard.writeText(menu.text);
      setCopied(true);
      setTimeout(() => {
        setMenu(null);
        setAreaRect(null);
      }, 700);
    } catch {
      /* ignore */
    }
  };

  // ── لوحة المفاتيح ──
  useEffect(() => {
    if (!pageView) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT") return;
      if (e.key === "Escape") {
        if (menu || ctxMenu || areaMode || areaRect) {
          setMenu(null);
          setCtxMenu(null);
          setAreaMode(false);
          setAreaRect(null);
          window.getSelection()?.removeAllRanges();
          e.stopImmediatePropagation();
          return;
        }
        if (ws.front === "book") {
          e.stopImmediatePropagation(); // أغلق الكتاب فقط
          closePage();
        }
        return;
      }
      if (e.key === "ArrowLeft") next();
      else if (e.key === "ArrowRight") prev();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [pageView, next, prev, closePage, menu, ctxMenu, areaMode, areaRect, ws.front]);

  // صوت القلم عند ظهور تظليل الإجابة، وتحميل الأصوات مسبقاً
  const hlKey = pageView && pageView.highlight.length > 0 && visiblePages.includes(pageView.page) ? String(pageView.key) : null;
  useEffect(() => {
    if (hlKey == null || mutedRef.current) return;
    const t = setTimeout(() => playHighlight(), 350);
    return () => clearTimeout(t);
  }, [hlKey]);
  useEffect(() => {
    if (mounted) preloadBookSounds();
  }, [mounted]);

  if (!mounted || !pageView) return null;

  const state = visible ? "open" : "closed";
  const first = visiblePages[0] ?? pageView.page;
  const last = visiblePages[visiblePages.length - 1] ?? first;
  const chapter = locatePage(first).chapter;
  const short = menu ? menu.text.split(/\s+/).length <= 3 : false;
  const hlVisible = pageView.highlight.length > 0 && visiblePages.includes(pageView.page);

  return (
    <>
      {!docked && (
        <div aria-hidden data-state={state} onClick={closePage} className="yz-scrim fixed inset-0 bg-black/70" style={{ zIndex: ws.z("book") - 1 }} />
      )}
      <section
        role="dialog"
        aria-modal={!docked}
        aria-label={`كتاب الأحياء — صفحة ${first}`}
        data-state={state}
        style={style}
        onPointerDownCapture={() => ws.front !== "book" && ws.bringToFront("book")}
        className={`yz-viewer ws-morph book-desk fixed flex flex-col overflow-hidden border border-[#1f2b2b] shadow-2xl shadow-black ${
          docked ? "rounded-3xl" : "inset-0 sm:inset-3 sm:rounded-3xl"
        }`}
      >
        {/* شريط علوي عائم */}
        <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-3 p-3">
          <div className="glass-bar pointer-events-auto rounded-2xl px-4 py-2">
            <p className="text-xs text-teal-400">{chapter ? `الفصل ${chapter}` : "الأحياء ١"}</p>
            <p className="text-base font-semibold text-white">
              {first === last ? `صفحة ${first}` : `صفحة ${first}–${last}`}
              <span className="ms-1 text-xs font-normal text-gray-400">من {BOOK_PAGES}</span>
            </p>
          </div>
          <div className="glass-bar pointer-events-auto flex items-center gap-0.5 rounded-2xl p-1">
            <button
              type="button"
              onClick={() => {
                setMenu(null);
                setAreaRect(null);
                setAreaMode((m) => !m);
              }}
              aria-pressed={areaMode}
              aria-label="تحديد منطقة"
              title="تحديد منطقة (أو كلك يمين على الصفحة)"
              className={`press flex h-10 w-10 items-center justify-center rounded-xl hover:bg-[#1c2626] hover:text-white ${
                areaMode ? "bg-teal-700 text-white hover:bg-teal-600" : "text-gray-200"
              }`}
            >
              <SquareDashedMousePointer aria-hidden className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setMenu(null);
                setAreaRect(null);
                setBuilderOpen((o) => !o);
              }}
              aria-expanded={builderOpen}
              aria-label="ذاكر صفحات محددة"
              title="اختبار / خريطة ذهنية / بطاقات من صفحات تحددها"
              className={`press flex h-10 w-10 items-center justify-center rounded-xl hover:bg-[#1c2626] hover:text-white ${
                builderOpen ? "bg-teal-700 text-white hover:bg-teal-600" : "text-gray-200"
              }`}
            >
              <Search aria-hidden className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() =>
                setMuted((m) => {
                  try {
                    localStorage.setItem("book-muted", m ? "0" : "1");
                  } catch {
                    /* ignore */
                  }
                  return !m;
                })
              }
              aria-label={muted ? "تشغيل صوت التقليب" : "كتم صوت التقليب"}
              title={muted ? "تشغيل الصوت" : "كتم الصوت"}
              className="press flex h-10 w-10 items-center justify-center rounded-xl text-gray-200 hover:bg-[#1c2626] hover:text-white"
            >
              {muted ? <VolumeX aria-hidden className="h-5 w-5" /> : <Volume2 aria-hidden className="h-5 w-5" />}
            </button>
            <a href={`/units/unit1.pdf#page=${first}`} target="_blank" rel="noopener" aria-label="فتح الملف في نافذة جديدة" title="فتح الملف في نافذة جديدة" className="press hidden h-10 w-10 items-center justify-center rounded-xl text-gray-200 hover:bg-[#1c2626] hover:text-white sm:flex">
              <ExternalLink aria-hidden className="h-5 w-5" />
            </a>
            <button type="button" onClick={closePage} aria-label="إغلاق الكتاب" className="press flex h-10 w-10 items-center justify-center rounded-xl text-gray-200 hover:bg-[#1c2626] hover:text-white">
              <X aria-hidden className="h-5 w-5" />
            </button>
          </div>
          {builderOpen && (
            <StudyBuilder
              key={`${first}-${last}`}
              first={first}
              last={last}
              chapter={chapter || null}
              onSubmit={(kind, range, count) => {
                setBuilderOpen(false);
                askYazid(studyPrompt(kind, range, count), kind, null, range);
                if (vw < 1024) closePage();
              }}
            />
          )}
        </header>

        <div ref={stageRef} className="relative flex-1" onContextMenu={onContextMenu}>
          <div className="absolute inset-0 flex items-center justify-center" style={{ paddingTop: 56 }}>
            <div
              ref={bookHostRef}
              className={`bk-host relative ${resizing || busy ? "is-settling" : ""}`}
              style={{ width: builtSpread ? builtW * 2 : builtW, height: Math.floor(builtW * RATIO) }}
            />
          </div>
          {/* أداة تحديد المنطقة */}
          {areaMode && (
            <div
              onPointerDown={onAreaDown}
              onPointerMove={onAreaMove}
              onPointerUp={onAreaUp}
              onPointerCancel={onAreaUp}
              className="absolute inset-0 z-40 cursor-crosshair touch-none"
              aria-label="اسحب لتحديد منطقة"
            >
              {!areaRect && (
                <p className="pointer-events-none absolute left-1/2 top-20 -translate-x-1/2 rounded-full bg-teal-700 px-4 py-2 text-sm font-medium text-white shadow-lg">
                  اسحب مربعاً حول النص · Esc للإلغاء
                </p>
              )}
            </div>
          )}
          {areaRect && (
            <div
              aria-hidden
              className="area-rect pointer-events-none absolute z-40"
              style={{ left: areaRect.x, top: areaRect.y, width: areaRect.w, height: areaRect.h }}
            />
          )}
          {(busy || resizing) && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 text-gray-300">
              جارٍ فتح الكتاب…
              <Loader2 aria-hidden className="h-5 w-5 animate-spin text-teal-400" />
            </div>
          )}

          {/* أسهم التقليب: اليسار = التالية (كتاب عربي) */}
          <button
            type="button"
            onClick={next}
            disabled={last >= BOOK_PAGES}
            aria-label="الصفحة التالية"
            className="press absolute bottom-4 left-3 z-20 flex h-12 w-12 items-center justify-center rounded-full text-gray-300 hover:bg-[#1c2626] hover:text-white disabled:opacity-20"
          >
            <Undo2 aria-hidden className="h-7 w-7" />
          </button>
          <button
            type="button"
            onClick={prev}
            disabled={first <= 1}
            aria-label="الصفحة السابقة"
            className="press absolute bottom-4 right-3 z-20 flex h-12 w-12 items-center justify-center rounded-full text-gray-300 hover:bg-[#1c2626] hover:text-white disabled:opacity-20"
          >
            <Redo2 aria-hidden className="h-7 w-7" />
          </button>
        </div>

        <p className="pointer-events-none absolute inset-x-0 bottom-3 z-10 mx-auto w-fit max-w-[62%] truncate rounded-full bg-black/50 px-4 py-1.5 text-center text-xs text-gray-300" role="status">
          {notice ??
            (hlVisible
              ? (vw < 640 ? "المظلّل هو مكان الإجابة" : "المظلّل هو مكان الإجابة · كلك يمين لتحديد منطقة وسؤال يزيد")
              : vw < 640
                ? "اسحب الصفحة لتقليبها · اضغط مطولاً أو استخدم أيقونة التحديد"
                : "كلك يمين ← تحديد منطقة لتسأل عنها يزيد · اسحب زاوية الورقة لتقليبها")}
        </p>
      </section>

      {ctxMenu && (
        <div
          role="menu"
          aria-label="خيارات الصفحة"
          className="ctx-menu fixed z-[80] w-56 overflow-hidden rounded-2xl border border-[#1f2b2b] bg-[#0d1414] p-1.5 shadow-2xl shadow-black/60"
          style={{ left: ctxMenu.x, top: ctxMenu.y, transform: "translate(-50%, 0)" }}
        >
          <CtxItem
            onClick={() => {
              setCtxMenu(null);
              setAreaRect(null);
              setAreaMode(true);
            }}
            label="تحديد منطقة"
            hint="اسحب مربعاً حول النص"
            icon={<SquareDashedMousePointer className="h-4 w-4" />}
          />
          <CtxItem onClick={() => selectWholePage(ctxMenu.page)} label={`تحديد صفحة ${ctxMenu.page} كاملة`} icon={<FileText className="h-4 w-4" />} />
        </div>
      )}

      {menu && (
        <div
          role="menu"
          aria-label="خيارات النص المحدد"
          onMouseDown={(e) => e.preventDefault()}
          className="sel-menu fixed z-[80] flex max-w-[min(94vw,460px)] flex-wrap items-center justify-center gap-1 rounded-2xl border border-[#1f2b2b] bg-[#0d1414] p-1.5 shadow-2xl shadow-black/60"
          style={{ left: menu.x, top: menu.y, transform: `translate(-50%, ${menu.below ? "0" : "-100%"})` }}
        >
          <MenuBtn onClick={() => act(short ? "define" : "explain")} label={short ? "وش معناها؟" : "اشرح لي"} icon={<Brain className="h-4 w-4" />} primary />
          <MenuBtn onClick={() => act("quiz")} label="اختبرني" icon={<ListChecks className="h-4 w-4" />} />
          {!short && <MenuBtn onClick={() => act("summary")} label="لخّص" icon={<ScrollText className="h-4 w-4" />} />}
          <MenuBtn onClick={() => act("cards")} label="بطاقات" icon={<Layers className="h-4 w-4" />} />
          <MenuBtn onClick={() => act("map")} label="خريطة" icon={<Network className="h-4 w-4" />} />
          <MenuBtn onClick={copy} label={copied ? "تم النسخ" : "نسخ"} icon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} />
        </div>
      )}
    </>
  );
}

function CtxItem({ onClick, label, hint, icon }: { onClick: () => void; label: string; hint?: string; icon: React.ReactNode }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="press flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start hover:bg-[#1c2626]"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-white">{label}</span>
        {hint && <span className="block text-xs text-gray-400">{hint}</span>}
      </span>
      <span aria-hidden className="text-teal-400">{icon}</span>
    </button>
  );
}

function MenuBtn({ onClick, label, icon, primary }: { onClick: () => void; label: string; icon: React.ReactNode; primary?: boolean }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`press flex h-9 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 text-sm font-medium ${
        primary ? "bg-teal-700 text-white hover:bg-teal-600" : "text-gray-100 hover:bg-[#1c2626]"
      }`}
    >
      {label}
      <span aria-hidden>{icon}</span>
    </button>
  );
}
