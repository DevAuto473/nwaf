"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AlertCircle, ArrowUp, Layers, ListChecks, Network } from "lucide-react";
import type { ChatMessage } from "./useYazidChat";
import type { Quiz } from "../../lib/quiz";
import type { StudyData } from "../../lib/study";
import { useAppContext, type AskFn } from "../../context/AppContext";

/** يحوّل «(ص 12)» في رد يزيد إلى زر يفتح الصفحة مع تظليل الجملة التي قبله */
function WithCitations({ text }: { text: string }) {
  const { openPage } = useAppContext();
  const re = /\((?:ص|صفحة)\s*([0-9٠-٩]+)\)/g;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const before = text.slice(last, m.index);
    parts.push(before);
    const page = Number(m[1].replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)));
    // الجملة التي تسبق الإشارة = ما نبحث عنه في الصفحة
    const sentence = text.slice(Math.max(0, m.index - 160), m.index).split(/[.\n؛]/).pop() ?? "";
    if (page >= 1 && page <= 277) {
      parts.push(
        <button
          key={m.index}
          type="button"
          onClick={() => openPage(page, [sentence])}
          className="mx-0.5 inline-flex items-center rounded-md bg-teal-900 px-1.5 text-teal-200 underline-offset-4 hover:bg-teal-800 hover:underline"
        >
          ص {page}
        </button>
      );
    } else parts.push(m[0]);
    last = m.index + m[0].length;
  }
  parts.push(text.slice(last));
  return <>{parts}</>;
}

// الاختبارات التي فُتحت تلقائياً مرة — لا نعيد فتحها عند إعادة الرسم
const autoOpened = new Set<string>();

function QuizCard({
  id,
  quiz,
  autoOpen,
  unitId,
  unitTitle,
  onAsk,
}: {
  id: string;
  quiz: Quiz;
  autoOpen?: boolean;
  unitId: string | null;
  unitTitle: string;
  onAsk: AskFn;
}) {
  const { openQuiz, quizResults, activeQuiz } = useAppContext();
  const ref = useRef<HTMLButtonElement>(null);

  const open = useCallback(() => {
    const r = ref.current?.getBoundingClientRect();
    openQuiz({
      id,
      quiz,
      unitId,
      unitTitle,
      origin: r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null,
      ask: onAsk,
    });
  }, [id, quiz, unitId, unitTitle, onAsk, openQuiz]);

  useEffect(() => {
    if (autoOpen && !autoOpened.has(id)) {
      autoOpened.add(id);
      open();
    }
  }, [autoOpen, id, open]);

  const result = quizResults[id];
  const isOpen = activeQuiz?.id === id;
  const n = quiz.questions.length;

  return (
    <button
      ref={ref}
      type="button"
      onClick={open}
      className={`press mt-2 flex w-full items-center gap-3 rounded-2xl border p-4 text-start transition-colors ${
        isOpen ? "border-white bg-teal-600" : "border-transparent bg-teal-700 hover:bg-teal-600"
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-white">{quiz.title}</span>
        <span className="mt-0.5 block text-sm text-teal-100">
          {n} {n > 2 && n < 11 ? "أسئلة" : "سؤال"} ·{" "}
          {result ? `نتيجتك ${result.correct} من ${result.total}` : isOpen ? "مفتوح الآن" : "اضغط للبدء"}
        </span>
      </span>
      <ListChecks aria-hidden className="h-6 w-6 shrink-0 text-white" />
    </button>
  );
}

function StudyCard({ id, study, autoOpen, unitTitle }: { id: string; study: StudyData; autoOpen?: boolean; unitTitle: string }) {
  const { openStudy, activeStudy } = useAppContext();
  const ref = useRef<HTMLButtonElement>(null);

  const open = useCallback(() => {
    const r = ref.current?.getBoundingClientRect();
    openStudy({ id, study, unitTitle, origin: r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null });
  }, [id, study, unitTitle, openStudy]);

  useEffect(() => {
    if (autoOpen && !autoOpened.has(id)) {
      autoOpened.add(id);
      open();
    }
  }, [autoOpen, id, open]);

  const isMap = study.kind === "mindmap";
  const isOpen = activeStudy?.id === id;
  const count = isMap ? (study.data.root.children?.length ?? 0) : study.data.cards.length;
  return (
    <button
      ref={ref}
      type="button"
      onClick={open}
      className={`press mt-2 flex w-full items-center gap-3 rounded-2xl border p-4 text-start transition-colors ${
        isOpen ? "border-white bg-teal-600" : "border-transparent bg-teal-700 hover:bg-teal-600"
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-white">{study.data.title}</span>
        <span className="mt-0.5 block text-sm text-teal-100">
          {isMap ? `خريطة ذهنية · ${count} فروع` : `${count} بطاقة`} · {isOpen ? "مفتوحة الآن" : "اضغط للفتح"}
        </span>
      </span>
      {isMap ? <Network aria-hidden className="h-6 w-6 shrink-0 text-white" /> : <Layers aria-hidden className="h-6 w-6 shrink-0 text-white" />}
    </button>
  );
}

export function ChatMessages({
  messages,
  roomy = false,
  onAsk,
  unitId = null,
  unitTitle = "كل الكتاب",
}: {
  messages: ChatMessage[];
  roomy?: boolean;
  onAsk: AskFn;
  unitId?: string | null;
  unitTitle?: string;
}) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    endRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "end" });
  }, [messages]);

  return (
    <div role="log" aria-live="polite" className={roomy ? "space-y-5" : "space-y-3"}>
      {messages.map((m) => {
        const mine = m.role === "user";
        return (
          // في RTL: رسائل الطالب على اليسار (نهاية السطر)، ويزيد على اليمين
          <div key={m.id} className={`chat-bubble flex ${mine ? "justify-end" : "justify-start"}`}>
            <div className="flex max-w-[85%] flex-col">
            <div
              className={`whitespace-pre-wrap rounded-2xl leading-relaxed ${
                roomy ? "px-5 py-3.5 text-[15px] sm:text-base" : "px-4 py-2.5 text-sm"
              } ${
                mine
                  ? "rounded-ee-md bg-teal-700 text-white"
                  : m.isError
                  ? "rounded-es-md border border-red-800 bg-red-950 text-red-200"
                  : "rounded-es-md border border-[#1f2b2b] bg-[#141d1d] text-gray-100"
              }`}
            >
              {m.pending ? (
                <span className="flex items-center gap-2 py-1" aria-label={m.pendingLabel ?? "يزيد يكتب"}>
                  {m.pendingLabel && <span className="text-sm text-teal-300">{m.pendingLabel}</span>}
                  <span className="flex items-center gap-1">
                    <span className="typing-dot h-1.5 w-1.5 rounded-full bg-teal-400" />
                    <span className="typing-dot h-1.5 w-1.5 rounded-full bg-teal-400" />
                    <span className="typing-dot h-1.5 w-1.5 rounded-full bg-teal-400" />
                  </span>
                </span>
              ) : m.isError ? (
                <span className="flex items-start gap-2">
                  <span className="flex-1">{m.text}</span>
                  <AlertCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
                </span>
              ) : mine ? (
                m.text
              ) : (
                <WithCitations text={m.text} />
              )}
            </div>
            {m.quiz && (
              <QuizCard
                id={m.id}
                quiz={m.quiz}
                autoOpen={m.autoOpen}
                unitId={unitId}
                unitTitle={unitTitle}
                onAsk={onAsk}
              />
            )}
            {m.study && <StudyCard id={m.id} study={m.study} autoOpen={m.autoOpen} unitTitle={unitTitle} />}
            </div>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}

// باستيل صلب (بدون شفافية) — بدون البنفسجي المحجوز للتظليل
const PASTELS = ["#bfe6dc", "#f4d9c4", "#c7def2", "#f1e6b4", "#f2cdd5", "#d4e5c3"];

export function ChatSuggestions({ items, onPick }: { items: string[]; onPick: (s: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2 pt-1">
      {items.map((s, i) => (
        <button
          key={s}
          type="button"
          onClick={() => onPick(s)}
          style={{ background: PASTELS[i % PASTELS.length] }}
          className="press rounded-full px-3.5 py-2.5 text-sm font-medium text-[#10201f] hover:brightness-95"
        >
          {s}
        </button>
      ))}
    </div>
  );
}

export function ChatComposer({
  onSend,
  busy,
  placeholder,
  roomy = false,
  textareaRef,
}: {
  onSend: (text: string) => void;
  busy: boolean;
  placeholder: string;
  roomy?: boolean;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const [value, setValue] = useState("");
  const localRef = useRef<HTMLTextAreaElement>(null);
  const ref = textareaRef ?? localRef;

  // يكبر الحقل مع النص حتى حد معيّن
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value, ref]);

  const canSend = value.trim().length > 0 && !busy;
  const submit = () => {
    if (!canSend) return;
    onSend(value);
    setValue("");
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className={`flex items-end gap-2 rounded-3xl border border-[#1f2b2b] bg-black/60 p-1.5 transition-colors focus-within:border-teal-600 ${
        roomy ? "ps-4" : "ps-3"
      }`}
    >
      <label className="sr-only" htmlFor={roomy ? "yz-input-roomy" : "yz-input"}>
        سؤالك ليزيد
      </label>
      {/* لا نعطّل الحقل أثناء انتظار الرد — الطالب يقدر يكتب سؤاله التالي */}
      <textarea
        id={roomy ? "yz-input-roomy" : "yz-input"}
        ref={ref}
        rows={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={placeholder}
        className={`flex-1 resize-none bg-transparent py-2.5 text-white placeholder-gray-500 outline-none ${
          roomy ? "text-base" : "text-[15px]"
        }`}
      />
      <button
        type="submit"
        disabled={!canSend}
        aria-label="إرسال"
        className={`press flex shrink-0 items-center justify-center rounded-full bg-teal-700 text-white transition-[background-color,opacity] hover:bg-teal-600 disabled:bg-[#1c2626] disabled:text-gray-500 ${
          roomy ? "h-11 w-11" : "h-10 w-10"
        }`}
      >
        <ArrowUp aria-hidden className="h-5 w-5" />
      </button>
    </form>
  );
}

export const YAZID_FOOTNOTE = "يجيب من نص الكتاب ويذكر رقم الصفحة — راجع المعلومة في الكتاب عند الشك.";
