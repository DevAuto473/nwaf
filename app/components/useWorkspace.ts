"use client";

import { useEffect, useState } from "react";
import { useAppContext, type PanelId } from "../context/AppContext";

export type Slot = { left: number; width: number };

const MARGIN = 16;
const GAP = 16;
// أقل وأكبر عرض لكل نافذة عند ترتيبها جنباً إلى جنب
const MIN: Record<PanelId, number> = { chat: 360, quiz: 400, book: 380 };
const MAX: Record<PanelId, number> = { chat: 420, quiz: 560, book: Infinity };
const ORDER: PanelId[] = ["chat", "quiz", "book"]; // من اليسار لليمين
const Z: Record<PanelId, number> = { chat: 50, quiz: 54, book: 58 };

function useViewportWidth() {
  const [w, setW] = useState(() => (typeof window === "undefined" ? 1280 : window.innerWidth));
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return w;
}

/**
 * يرتّب النوافذ المفتوحة: إذا اتسعت الشاشة لها كلها تقف جنباً إلى جنب (docked)،
 * وإلا تتراكب ويكون أعلاها آخر نافذة فُتحت أو ضُغط عليها.
 */
export function useWorkspace() {
  const { isChatOpen, unitChatUnit, activeQuiz, activeStudy, pageView, front, bringToFront, panelWidth, setPanelWidth } = useAppContext();
  const vw = useViewportWidth();

  const open: PanelId[] = ORDER.filter((id) =>
    id === "chat" ? isChatOpen || !!unitChatUnit : id === "quiz" ? !!activeQuiz || !!activeStudy : !!pageView
  );
  const avail = vw - MARGIN * 2 - GAP * Math.max(0, open.length - 1);
  const need = open.reduce((a, id) => a + MIN[id], 0);
  const docked = vw >= 1024 && open.length >= 2 && avail >= need;

  const slots: Partial<Record<PanelId, Slot>> = {};
  if (docked) {
    const width: Record<string, number> = {};
    open.forEach((id) => (width[id] = MIN[id]));
    let extra = avail - need;
    // المحادثة ثم الاختبار حتى حدّهما، والباقي للكتاب
    // مع الكتاب نخفف حد المحادثة والاختبار حتى تبقى صفحة الكتاب مقروءة
    const cap = (id: PanelId) => (open.includes("book") ? Math.min(MAX[id], id === "chat" ? 380 : 480) : MAX[id]);
    for (const id of open.filter((i) => i !== "book")) {
      const pref = panelWidth[id];
      const target = pref ? Math.max(MIN[id], Math.min(pref, 960)) : cap(id);
      const add = Math.max(0, Math.min(extra, target - width[id]));
      width[id] += add;
      extra -= add;
    }
    if (open.includes("book")) width.book += extra;
    let left = MARGIN;
    for (const id of open) {
      slots[id] = { left, width: width[id] };
      left += width[id] + GAP;
    }
  }

  /** أكبر عرض مسموح لنافذة مع بقاء الباقين بحدّهم الأدنى */
  const maxWidth = (id: PanelId) =>
    Math.max(MIN[id], vw - MARGIN * 2 - open.filter((i) => i !== id).reduce((a, i) => a + MIN[i] + GAP, 0));
  /** عرض النافذة عند التراكب (غير جنباً إلى جنب) على الشاشات الكبيرة */
  const overlayWidth = (id: PanelId) => {
    const w = panelWidth[id];
    return w && vw >= 1024 ? Math.max(MIN[id], Math.min(w, vw - MARGIN * 2)) : undefined;
  };

  const z = (id: PanelId) => (id === front ? 64 : Z[id]);
  return { vw, docked, slots, z, front, bringToFront, panelWidth, setPanelWidth, maxWidth, overlayWidth, min: MIN };
}
