"use client";

import React, { useCallback, useEffect, useRef } from "react";
import { Brain, ChevronDown, X } from "lucide-react";
import { useAppContext, Unit } from "../context/AppContext";
import { useYazidChat } from "./chat/useYazidChat";
import { usePresence } from "./chat/usePresence";
import { ChatComposer, ChatMessages, ChatSuggestions, YAZID_FOOTNOTE } from "./chat/ChatParts";
import { useWorkspace } from "./useWorkspace";

function welcomeFor(unit: Unit | null) {
  return unit
    ? `هلا، أنا يزيد. اسألني عن فصل «${unit.title}» وأجيبك من الكتاب مع رقم الصفحة.`
    : "هلا، أنا يزيد مساعدك في المذاكرة. اسألني عن أي موضوع في كتاب الأحياء ١.";
}

const SUGGESTIONS_BOOK = [
  "ما الفرق بين الفيروس والبكتيريا؟",
  "ما ممالك التصنيف الست؟",
  "ما خصائص المخلوقات الحية؟",
  "اختبرني في التصنيف",
  "ارسم لي خريطة ذهنية للتصنيف",
  "سوِّ لي بطاقات مراجعة",
];
const SUGGESTIONS_UNIT = ["لخّص لي أهم أفكار الفصل", "ما المصطلحات المهمة؟", "اختبرني بثلاثة أسئلة", "ارسم خريطة ذهنية للفصل", "سوِّ لي بطاقات مراجعة"];

/** إسقاط الزخم (من Apple): أين سيتوقف العنصر لو أكمل بسرعته الحالية */
function project(velocity: number, decel = 0.998) {
  return ((velocity / 1000) * decel) / (1 - decel);
}
/** مقاومة مطاطية عند تجاوز الحد */
function rubberband(overshoot: number, dimension: number, c = 0.55) {
  return (overshoot * dimension * c) / (dimension + c * Math.abs(overshoot));
}

export default function AIChatWidget() {
  const { isChatOpen, setIsChatOpen, selectedUnit, setSelectedUnit, units, pendingAsk, clearPendingAsk, unitChatUnit } =
    useAppContext();
  const { mounted, visible } = usePresence(isChatOpen);
  const ws = useWorkspace();
  const slot = unitChatUnit ? undefined : ws.slots.chat;
  const { messages, isLoading, send, reset } = useYazidChat(selectedUnit?.id ?? null, welcomeFor(null));

  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const drag = useRef<{ startY: number; lastY: number; lastT: number; v: number; dy: number } | null>(null);

  const close = useCallback(() => setIsChatOpen(false), [setIsChatOpen]);

  // تغيير نطاق السؤال يبدأ محادثة جديدة
  const scopeId = selectedUnit?.id ?? null;
  useEffect(() => {
    reset(welcomeFor(selectedUnit));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeId, reset]);

  // طلب من عارض الكتاب: اضبط نطاق الفصل، افتح المحادثة، ثم أرسل
  useEffect(() => {
    if (!pendingAsk || unitChatUnit) return;
    const target = units.find((u) => u.id === pendingAsk.unitId) ?? null;
    if ((selectedUnit?.id ?? null) !== (target?.id ?? null)) {
      setSelectedUnit(target); // يعيد هذا التأثير بعد تغيير النطاق
      return;
    }
    if (!isChatOpen) setIsChatOpen(true);
    if (isLoading) return;
    send(pendingAsk.text, { mode: pendingAsk.mode, pages: pendingAsk.pages });
    clearPendingAsk();
  }, [pendingAsk, unitChatUnit, units, selectedUnit, setSelectedUnit, isChatOpen, setIsChatOpen, isLoading, send, clearPendingAsk]);

  // التركيز: إلى الحقل عند الفتح، ويرجع للزر عند الإغلاق
  useEffect(() => {
    if (isChatOpen) {
      wasOpen.current = true;
      const t = setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 120);
      return () => clearTimeout(t);
    }
    if (wasOpen.current && !mounted) fabRef.current?.focus();
  }, [isChatOpen, mounted]);

  useEffect(() => {
    if (!isChatOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isChatOpen, close]);

  // ── سحب اللوحة للأسفل لإغلاقها (الجوال) ──
  const onDragStart = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startY: e.clientY, lastY: e.clientY, lastT: e.timeStamp, v: 0, dy: 0 };
    panelRef.current?.setAttribute("data-dragging", "true");
  };
  const onDragMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const panel = panelRef.current;
    if (!d || !panel) return;
    const dt = e.timeStamp - d.lastT;
    if (dt > 0) d.v = 0.8 * ((e.clientY - d.lastY) / dt) * 1000 + 0.2 * d.v;
    d.lastY = e.clientY;
    d.lastT = e.timeStamp;
    const raw = e.clientY - d.startY;
    d.dy = raw < 0 ? -rubberband(-raw, panel.offsetHeight) : raw; // يتبع الإصبع 1:1
    panel.style.transform = `translateY(${d.dy}px)`;
  };
  const onDragEnd = () => {
    const d = drag.current;
    const panel = panelRef.current;
    drag.current = null;
    if (!d || !panel) return;
    panel.removeAttribute("data-dragging");
    panel.style.transform = ""; // الانتقال يكمل من الموضع الحالي
    if (d.dy + project(d.v) > panel.offsetHeight * 0.35) close();
  };

  const showSuggestions = messages.length === 1 && !isLoading;
  const chapters = units.filter((u) => u.chapter);

  return (
    <>
      {!isChatOpen && (
        <button
          ref={fabRef}
          onClick={() => setIsChatOpen(true)}
          aria-label="افتح يزيد، مساعدك في المذاكرة"
          className="yz-fab press fixed bottom-5 left-4 z-40 flex h-14 w-14 items-center justify-center rounded-full shadow-lg shadow-teal-900/40 sm:bottom-6 sm:left-6"
        >
          <span aria-hidden className="pointer-events-none absolute inset-[-3px] -z-10">
            <span className="nebula-blob-a absolute inset-0 rounded-full opacity-60 blur-[3px] bg-[conic-gradient(from_0deg,rgba(34,197,94,0.9),rgba(20,184,166,0.15)_30%,rgba(168,85,247,0.9)_55%,rgba(20,184,166,0.15)_80%,rgba(34,197,94,0.9))]" />
            <span className="nebula-blob-b absolute inset-0 rounded-full opacity-45 blur-[4px] bg-[conic-gradient(from_90deg,rgba(168,85,247,0.8),rgba(34,197,94,0.1)_35%,rgba(20,184,166,0.9)_60%,rgba(168,85,247,0.1)_85%,rgba(168,85,247,0.8))]" />
          </span>
          <span aria-hidden className="nebula-blob-core absolute inset-[2px] rounded-full bg-[#050808]" />
          <Brain aria-hidden className="relative z-10 h-6 w-6 text-teal-400" />
        </button>
      )}

      {mounted && (
        <>
          {/* تعتيم خفيف على الجوال فقط — على الكمبيوتر اللوحة لا تقطع التصفح */}
          <div
            aria-hidden
            data-state={visible ? "open" : "closed"}
            onClick={close}
            className="yz-scrim fixed inset-0 bg-black/50 sm:hidden"
            style={{ zIndex: ws.z("chat") - 1 }}
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="false"
            aria-labelledby="yz-title"
            data-state={visible ? "open" : "closed"}
            onPointerDownCapture={() => ws.front !== "chat" && ws.bringToFront("chat")}
            style={{
              zIndex: ws.z("chat"),
              // مع الكتاب أو الاختبار: بطول الشاشة في عمودها من مساحة العمل
              ...(slot ? { left: slot.left, width: slot.width, top: 16, bottom: 16, height: "auto", maxHeight: "none" } : {}),
            }}
            className="yz-panel ws-morph fixed inset-x-0 bottom-0 flex h-[88dvh] flex-col overflow-hidden rounded-t-3xl border border-[#1f2b2b] bg-[#070b0b] shadow-2xl shadow-black/70 sm:inset-x-auto sm:bottom-6 sm:left-6 sm:h-[600px] sm:max-h-[calc(100dvh-3rem)] sm:w-[420px] sm:rounded-3xl"
          >
            {/* مقبض السحب (جوال) */}
            <div
              onPointerDown={onDragStart}
              onPointerMove={onDragMove}
              onPointerUp={onDragEnd}
              onPointerCancel={onDragEnd}
              className="flex h-6 shrink-0 cursor-grab touch-none items-center justify-center sm:hidden"
            >
              <span className="h-1.5 w-10 rounded-full bg-[#4a5252]" />
            </div>

            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#1f2b2b] px-4 pb-3 sm:pt-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="icon-tile flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl">
                  <Brain aria-hidden className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p id="yz-title" className="text-base font-semibold text-white">يزيد</p>
                  <div className="relative mt-0.5">
                    <label htmlFor="yz-scope" className="sr-only">نطاق السؤال</label>
                    <select
                      id="yz-scope"
                      value={selectedUnit?.id ?? ""}
                      onChange={(e) => setSelectedUnit(units.find((u) => u.id === e.target.value) ?? null)}
                      className="max-w-[220px] cursor-pointer appearance-none truncate rounded-lg bg-transparent py-0.5 pe-6 text-sm text-teal-300 outline-none hover:text-teal-200 [&>option]:bg-black [&>option]:text-white"
                    >
                      <option value="">كل الكتاب</option>
                      {chapters.map((u) => (
                        <option key={u.id} value={u.id}>
                          الفصل {u.chapter}: {u.title}
                        </option>
                      ))}
                    </select>
                    <ChevronDown aria-hidden className="pointer-events-none absolute end-0 top-1/2 h-4 w-4 -translate-y-1/2 text-teal-400" />
                  </div>
                </div>
              </div>
              <button
                onClick={close}
                aria-label="إغلاق"
                className="press flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-[#1c2626] hover:text-white"
              >
                <X aria-hidden className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
              <ChatMessages
                messages={messages}
                onAsk={send}
                unitId={selectedUnit?.id ?? null}
                unitTitle={selectedUnit?.title ?? "كل الكتاب"}
              />
              {showSuggestions && (
                <div className="mt-4">
                  <ChatSuggestions items={selectedUnit ? SUGGESTIONS_UNIT : SUGGESTIONS_BOOK} onPick={send} />
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-[#1f2b2b] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <ChatComposer
                onSend={send}
                busy={isLoading}
                placeholder={selectedUnit ? `اسأل عن «${selectedUnit.title}»…` : "اسأل عن أي درس…"}
                textareaRef={inputRef}
              />
              <p className="mt-2 text-center text-xs text-gray-400">{YAZID_FOOTNOTE}</p>
            </div>
          </div>
        </>
      )}
    </>
  );
}
