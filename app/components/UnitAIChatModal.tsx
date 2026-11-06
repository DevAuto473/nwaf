"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, Brain, X } from "lucide-react";
import { useAppContext, Unit } from "../context/AppContext";
import { useYazidChat } from "./chat/useYazidChat";
import { usePresence } from "./chat/usePresence";
import { ChatComposer, ChatMessages, ChatSuggestions, YAZID_FOOTNOTE } from "./chat/ChatParts";
import { useWorkspace } from "./useWorkspace";
import { CHAPTER_RANGES } from "../lib/pageHighlight";

function welcomeFor(unit: Unit) {
  return unit.chapter
    ? `هلا، أنا يزيد.\nوش حاب تعرف عن فصل «${unit.title}»؟\n\n${unit.description}`
    : `هلا، أنا يزيد.\nاسألني عن أي موضوع في كتاب الأحياء ١ وأجيبك مع رقم الصفحة.`;
}

const SUGGESTIONS = ["لخّص لي أهم أفكار الفصل", "ما المصطلحات المهمة؟", "اختبرني بثلاثة أسئلة", "ارسم خريطة ذهنية للفصل", "سوِّ لي بطاقات مراجعة"];

export default function UnitAIChatModal() {
  const { unitChatUnit, setUnitChatUnit, unitChatOrigin, pendingAsk, clearPendingAsk, openPage } = useAppContext();
  const ws = useWorkspace();
  const slot = ws.slots.chat;
  const open = unitChatUnit !== null;
  const { mounted, visible } = usePresence(open);

  // نحتفظ بآخر وحدة لتبقى ظاهرة أثناء حركة الإغلاق
  const [unit, setUnit] = useState<Unit | null>(null);
  if (unitChatUnit && unitChatUnit !== unit) setUnit(unitChatUnit);
  const { messages, isLoading, send, reset } = useYazidChat(unit?.id ?? null, "");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!unitChatUnit) return;
    returnFocus.current = document.activeElement as HTMLElement | null;
    reset(welcomeFor(unitChatUnit));
    const t = setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 150);
    return () => clearTimeout(t);
  }, [unitChatUnit, reset]);

  const close = useCallback(() => setUnitChatUnit(null), [setUnitChatUnit]);

  // طلب من عارض الكتاب أثناء فتح نافذة الوحدة → يُرسل هنا
  useEffect(() => {
    if (!pendingAsk || !unitChatUnit || isLoading) return;
    send(pendingAsk.text, { mode: pendingAsk.mode, pages: pendingAsk.pages });
    clearPendingAsk();
  }, [pendingAsk, unitChatUnit, isLoading, send, clearPendingAsk]);

  useEffect(() => {
    if (!open) {
      returnFocus.current?.focus?.();
      return;
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    if (!slot) document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, close, slot]);

  if (!mounted || !unit) return null;

  const state = visible ? "open" : "closed";
  // النافذة تكبر من النقطة التي ضغطها الطالب، وترجع إليها عند الإغلاق
  const origin = unitChatOrigin
    ? `${unitChatOrigin.x}px ${unitChatOrigin.y}px`
    : "50% 50%";

  return (
    <>
      {!slot && (
        <div
          aria-hidden
          data-state={state}
          onClick={close}
          className="yz-scrim fixed inset-0 bg-black/70"
          style={{ zIndex: ws.z("chat") - 1 }}
        />
      )}

      {/* مع الكتاب أو الاختبار: تقف النافذة في مكانها من مساحة العمل */}
      <div
        onPointerDownCapture={() => ws.front !== "chat" && ws.bringToFront("chat")}
        className="ws-morph pointer-events-none fixed inset-0 sm:p-6 lg:p-10"
        style={{
          zIndex: ws.z("chat"),
          ...(slot ? { left: slot.left, width: slot.width, right: "auto", top: 16, bottom: 16, padding: 0 } : {}),
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="yz-unit-title"
          data-state={state}
          style={{ transformOrigin: origin }}
          className={`yz-dialog pointer-events-auto mx-auto flex h-full w-full flex-col ${slot ? "max-w-none rounded-3xl border border-[#1f2b2b]" : "max-w-3xl"} overflow-hidden bg-[#050808] shadow-2xl shadow-black sm:rounded-3xl sm:border sm:border-[#1f2b2b]`}
        >
          <header className="glass-bar flex shrink-0 items-center justify-between gap-3 !rounded-none !border-x-0 !border-t-0 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <span className="icon-tile flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl">
                <Brain aria-hidden className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p id="yz-unit-title" className="text-base font-semibold text-white">يزيد</p>
                <p className="truncate text-sm text-gray-400">
                  {unit.chapter ? `الفصل ${unit.chapter} · ${unit.title}` : unit.title}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => openPage(CHAPTER_RANGES.find((c) => c.chapter === unit.chapter)?.from ?? 1)}
                className="press hidden h-10 items-center gap-2 rounded-full px-3 text-sm text-gray-300 hover:bg-[#1c2626] hover:text-white sm:flex"
              >
                فتح الفصل
                <BookOpen aria-hidden className="h-4 w-4" />
              </button>
              <button
                onClick={close}
                aria-label="إغلاق"
                className="press flex h-10 w-10 items-center justify-center rounded-full text-gray-400 hover:bg-[#1c2626] hover:text-white"
              >
                <X aria-hidden className="h-5 w-5" />
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto overscroll-contain">
            <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
              <ChatMessages messages={messages} roomy onAsk={send} unitId={unit.id} unitTitle={unit.title} />
              {messages.length === 1 && !isLoading && (
                <div className="mt-6">
                  <ChatSuggestions items={SUGGESTIONS} onPick={send} />
                </div>
              )}
            </div>
          </div>

          <div className="shrink-0 border-t border-[#1f2b2b] bg-black/40 pb-[env(safe-area-inset-bottom)]">
            <div className="mx-auto max-w-2xl px-4 py-4 sm:px-6">
              <ChatComposer
                onSend={send}
                busy={isLoading}
                placeholder={`اسأل عن «${unit.title}»…`}
                roomy
                textareaRef={inputRef}
              />
              <p className="mt-2 text-center text-xs text-gray-400">{YAZID_FOOTNOTE}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
