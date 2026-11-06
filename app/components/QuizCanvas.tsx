"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, BookOpen, Brain, Check, Maximize2, Minimize2, RefreshCw, RotateCcw, X } from "lucide-react";
import { useAppContext, type QuizSession } from "../context/AppContext";
import type { QuizQuestion } from "../lib/quiz";
import { usePresence } from "./chat/usePresence";
import { useWorkspace } from "./useWorkspace";
import ResizeHandle from "./ResizeHandle";

const LETTERS = ["أ", "ب", "ج", "د"];
const FOCUS_W = "780px";

interface RunState {
  src: QuizSession | null;
  questions: QuizQuestion[];
  answers: (number | null)[];
  index: number;
  done: boolean;
  /** هل هذه محاولة "إعادة الأخطاء" (لا تُحسب كنتيجة الاختبار الأصلية) */
  retry: boolean;
}

const fresh = (src: QuizSession, questions: QuizQuestion[], retry = false): RunState => ({
  src,
  questions,
  answers: questions.map(() => null),
  index: 0,
  done: false,
  retry,
});

function ScoreRing({ value }: { value: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(value));
    return () => cancelAnimationFrame(id);
  }, [value]);
  const r = 52;
  const c = 2 * Math.PI * r;
  const color = value >= 0.8 ? "#34d399" : value >= 0.5 ? "#2dd4bf" : "#fb7185";
  return (
    <svg width="132" height="132" viewBox="0 0 132 132" aria-hidden>
      <circle cx="66" cy="66" r={r} fill="none" stroke="#1c2626" strokeWidth="10" />
      <circle
        className="quiz-ring"
        cx="66"
        cy="66"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - shown)}
        transform="rotate(-90 66 66)"
      />
      <text x="66" y="74" textAnchor="middle" fill="#fff" fontSize="26" fontWeight="700">
        {Math.round(value * 100)}%
      </text>
    </svg>
  );
}

export default function QuizCanvas() {
  const ws = useWorkspace();
  const slot = ws.slots.quiz;
  const { activeQuiz, closeQuiz, setQuizResult, pageView, openPage, studyFocus, setStudyFocus } =
    useAppContext();
  const { mounted, visible } = usePresence(activeQuiz !== null);
  const focus = studyFocus && activeQuiz !== null;
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

  const [run, setRun] = useState<RunState>({
    src: null,
    questions: [],
    answers: [],
    index: 0,
    done: false,
    retry: false,
  });

  // اختبار جديد فُتح → ابدأ من أول سؤال
  if (activeQuiz && activeQuiz !== run.src) {
    setRun(fresh(activeQuiz, activeQuiz.quiz.questions));
  }

  const panelRef = useRef<HTMLElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  // اللوحة تكبر من بطاقة الاختبار في المحادثة، وترجع إليها عند الإغلاق
  useLayoutEffect(() => {
    const el = panelRef.current;
    const o = run.src?.origin;
    if (!el || !mounted) return;
    if (!o) {
      el.style.transformOrigin = "50% 50%";
      return;
    }
    const r = el.getBoundingClientRect();
    el.style.transformOrigin = `${o.x - r.left}px ${o.y - r.top}px`;
  }, [mounted, run.src]);

  useEffect(() => {
    if (activeQuiz) {
      returnFocus.current = document.activeElement as HTMLElement | null;
      const t = setTimeout(() => panelRef.current?.focus({ preventScroll: true }), 80);
      return () => clearTimeout(t);
    }
    returnFocus.current?.focus?.();
  }, [activeQuiz]);

  const q = run.questions[run.index];
  const answer = run.answers[run.index] ?? null;
  const answered = answer !== null;
  const isLast = run.index === run.questions.length - 1;
  const correctCount = run.answers.filter((a, i) => a === run.questions[i]?.answer).length;
  const wrongIdx = run.questions.map((qq, i) => (run.answers[i] === qq.answer ? -1 : i)).filter((i) => i >= 0);

  // ملاحظة: لا آثار جانبية داخل دوال setRun — تُستدعى أثناء الرسم
  const choose = useCallback(
    (k: number) => {
      if (run.done || run.answers[run.index] !== null) return;
      const qq = run.questions[run.index];
      if (!qq || k >= qq.options.length) return;
      if (typeof navigator !== "undefined") navigator.vibrate?.(k === qq.answer ? 10 : [20, 40, 20]);
      const answers = [...run.answers];
      answers[run.index] = k;
      setRun({ ...run, answers });
    },
    [run]
  );

  const next = useCallback(() => {
    if (run.answers[run.index] === null) return;
    if (run.index < run.questions.length - 1) {
      setRun({ ...run, index: run.index + 1 });
      return;
    }
    if (run.src && !run.retry) {
      const correct = run.answers.filter((a, i) => a === run.questions[i].answer).length;
      setQuizResult(run.src.id, { correct, total: run.questions.length });
    }
    setRun({ ...run, done: true });
  }, [run, setQuizResult]);

  const session = run.src;

  const newQuiz = () => {
    if (!session) return;
    session.ask(
      session.unitId ? `اختبرني مرة ثانية بأسئلة مختلفة عن ${session.unitTitle}` : "اختبرني مرة ثانية بأسئلة مختلفة",
      { mode: "quiz" }
    );
    closeQuiz();
  };

  const explainMistakes = () => {
    if (!session) return;
    const lines = wrongIdx.map((i) => {
      const qq = run.questions[i];
      const mine = run.answers[i];
      return `- ${qq.q}\n  إجابتي: ${mine !== null ? qq.options[mine] : "—"}\n  الصحيحة: ${qq.options[qq.answer]}`;
    });
    session.ask(`اشرح لي أخطائي في الاختبار بأسلوب بسيط:\n${lines.join("\n")}`, { mode: "chat" });
    closeQuiz();
  };

  const retryWrong = () => {
    if (!session) return;
    setRun(fresh(session, wrongIdx.map((i) => run.questions[i]), true));
  };

  // لوحة المفاتيح: 1–4 للاختيار، Enter للتالي، Esc للإغلاق
  useEffect(() => {
    if (!activeQuiz) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Esc تغلق النافذة الأمامية فقط
        if (ws.front !== "quiz") return;
        e.stopImmediatePropagation();
        closeQuiz();
        return;
      }
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT") return;
      const digit = "1234".indexOf(e.key) >= 0 ? Number(e.key) : "١٢٣٤".indexOf(e.key) + 1;
      if (digit >= 1 && !run.done) {
        e.preventDefault();
        choose(digit - 1);
      } else if (e.key === "Enter" && !run.done && answered) {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [activeQuiz, closeQuiz, choose, next, run.done, answered, ws.front]);

  if (!mounted || !session) return null;

  const state = visible ? "open" : "closed";
  const total = run.questions.length;
  const pct = total ? correctCount / total : 0;
  const verdict =
    pct === 1 ? "ممتاز! كل إجاباتك صحيحة." : pct >= 0.8 ? "ممتاز، أداء قوي." : pct >= 0.5 ? "جيد، راجع أخطاءك وتصير أقوى." : "تحتاج مراجعة — جرّب إعادة الأخطاء.";



  return (
    <>
      <div
        aria-hidden
        data-state={state}
        onClick={closeQuiz}
        className="yz-scrim fixed inset-0 bg-black/60 lg:hidden"
        style={{ zIndex: ws.z("quiz") - 1 }}
      />
      <section
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="false"
        aria-labelledby="quiz-title"
        data-state={state}
        onPointerDownCapture={() => ws.front !== "quiz" && ws.bringToFront("quiz")}
        style={{
          zIndex: focus ? 90 : ws.z("quiz"),
          ...(focus
            ? { left: 0, top: 0, bottom: 0, right: "auto", width: ws.vw, borderRadius: 0, borderWidth: 0, ["--focus-w" as string]: FOCUS_W }
            : slot
            ? { left: slot.left, width: slot.width, right: "auto", top: 16, bottom: 16 }
            : ws.overlayWidth("quiz")
            ? { width: ws.overlayWidth("quiz") }
            : {}),
        }}
        className={`yz-canvas ws-morph ${focus ? "focus-mode" : ""} fixed inset-0 flex flex-col overflow-hidden bg-[#070b0b] shadow-2xl shadow-black outline-none sm:inset-4 sm:rounded-3xl sm:border sm:border-[#1f2b2b] lg:inset-y-4 lg:right-auto lg:left-4 lg:w-[560px]`}
      >
        <ResizeHandle id="quiz" />
        {/* الرأس */}
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#1f2b2b] px-5 py-4">
          <div className="fm-hide min-w-0">
            <p className="text-sm text-teal-400">اختبار · {session.unitTitle}</p>
            <h2 id="quiz-title" className="truncate text-2xl font-bold text-white">
              {session.quiz.title}
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
              onClick={newQuiz}
              aria-label="اختبار جديد"
              title="اختبار جديد"
              className="press flex h-10 w-10 items-center justify-center rounded-full text-gray-400 hover:bg-[#1c2626] hover:text-white"
            >
              <RefreshCw aria-hidden className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={closeQuiz}
              aria-label="إغلاق الاختبار"
              className="press flex h-10 w-10 items-center justify-center rounded-full text-gray-400 hover:bg-[#1c2626] hover:text-white"
            >
              <X aria-hidden className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* شريط التقدم: كل سؤال قطعة — أخضر صح، أحمر خطأ */}
        <div className="flex shrink-0 gap-1.5 px-5 pt-4" aria-hidden>
          {run.questions.map((qq, i) => {
            const a = run.answers[i];
            const cls =
              a === null
                ? i === run.index && !run.done
                  ? "bg-teal-400"
                  : "bg-[#1c2626]"
                : a === qq.answer
                ? "bg-emerald-500"
                : "bg-rose-500";
            return <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${cls}`} />;
          })}
        </div>

        {!run.done && q ? (
          <>
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-6">
              <div key={`${run.retry}-${run.index}`} className="quiz-step">
                <p className="text-sm text-gray-400">
                  {run.retry ? "إعادة الأخطاء · " : ""}السؤال {run.index + 1} من {total}
                </p>
                <p className="mt-2 text-xl font-semibold leading-relaxed text-white sm:text-[22px]">{q.q}</p>

                <div role="radiogroup" aria-label="الخيارات" className="mt-6 space-y-3">
                  {q.options.map((o, k) => {
                    const chosen = answer === k;
                    const correct = k === q.answer;
                    const cls = !answered
                      ? "border-[#243131] bg-[#0e1515] text-gray-100 hover:border-teal-500 hover:bg-teal-950"
                      : correct
                      ? "border-emerald-500 bg-emerald-950 text-emerald-50"
                      : chosen
                      ? "border-rose-500 bg-rose-950 text-rose-50"
                      : "border-[#151e1e] text-gray-400 opacity-60";
                    return (
                      <button
                        key={k}
                        type="button"
                        role="radio"
                        aria-checked={chosen}
                        disabled={answered}
                        onClick={() => choose(k)}
                        className={`press flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-start text-base transition-[background-color,border-color,opacity,color] duration-200 disabled:cursor-default ${cls}`}
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#2a3838] text-sm font-semibold">
                          {LETTERS[k]}
                        </span>
                        <span className="flex-1 leading-relaxed">{o}</span>
                        {answered && correct && <Check aria-label="الإجابة الصحيحة" className="h-5 w-5 shrink-0 text-emerald-400" />}
                        {answered && chosen && !correct && <X aria-label="إجابتك" className="h-5 w-5 shrink-0 text-rose-400" />}
                      </button>
                    );
                  })}
                </div>

                {answered && (
                  <div
                    role="status"
                    className={`quiz-step mt-5 rounded-2xl border p-4 ${
                      answer === q.answer ? "border-emerald-800 bg-emerald-950" : "border-rose-800 bg-rose-950"
                    }`}
                  >
                    <p className={`flex items-center gap-2 font-semibold ${answer === q.answer ? "text-emerald-300" : "text-rose-300"}`}>
                      {answer === q.answer ? "إجابة صحيحة" : "إجابة غير صحيحة"}
                      {answer === q.answer ? <Check aria-hidden className="h-4 w-4" /> : <X aria-hidden className="h-4 w-4" />}
                    </p>
                    {q.explanation && <p className="mt-1.5 leading-relaxed text-gray-200">{q.explanation}</p>}
                    {q.page && (
                      <button
                        type="button"
                        onClick={() => openPage(q.page!, [q.options[q.answer], q.explanation])}
                        className="press mt-3 inline-flex items-center gap-1.5 rounded-lg text-sm text-teal-300 hover:text-teal-200"
                      >
                        راجع صفحة {q.page} في الكتاب
                        <BookOpen aria-hidden className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <footer className="shrink-0 border-t border-[#1f2b2b] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={next}
                disabled={!answered}
                className="press flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-teal-700 text-base font-semibold text-white transition-colors hover:bg-teal-600 disabled:bg-[#1c2626] disabled:text-gray-500"
              >
                {isLast ? "عرض النتيجة" : "السؤال التالي"}
                <ArrowLeft aria-hidden className="h-5 w-5" />
              </button>
              <p className="mt-2 hidden text-center text-xs text-gray-400 sm:block">
                {answered ? "Enter للمتابعة" : `اختر إجابة، أو اضغط 1 إلى ${q.options.length}`}
              </p>
            </footer>
          </>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-8">
              <div className="quiz-step flex flex-col items-center text-center">
                <ScoreRing value={pct} />
                <p className="mt-4 text-2xl font-bold text-white">
                  {correctCount} من {total}
                </p>
                <p className="mt-1 text-gray-300">{verdict}</p>
              </div>

              <ul className="mt-8 space-y-3">
                {run.questions.map((qq, i) => {
                  const a = run.answers[i];
                  const ok = a === qq.answer;
                  return (
                    <li key={i} className="rounded-2xl border border-[#1f2b2b] bg-[#0c1313] p-4">
                      <div className="flex items-start gap-3">
                        <p className="flex-1 font-medium leading-relaxed text-white">
                          {i + 1}. {qq.q}
                        </p>
                        {ok ? (
                          <Check aria-label="صحيحة" className="mt-1 h-5 w-5 shrink-0 text-emerald-400" />
                        ) : (
                          <X aria-label="خاطئة" className="mt-1 h-5 w-5 shrink-0 text-rose-400" />
                        )}
                      </div>
                      {!ok && a !== null && <p className="mt-2 text-sm text-rose-300">إجابتك: {qq.options[a]}</p>}
                      <p className="mt-1 text-sm text-emerald-300">الصحيحة: {qq.options[qq.answer]}</p>
                      {qq.page && (
                        <button
                          type="button"
                          onClick={() => openPage(qq.page!, [qq.options[qq.answer], qq.explanation])}
                          className={`press mt-2 inline-flex items-center gap-1.5 rounded-lg text-sm hover:text-teal-200 ${
                            pageView?.page === qq.page ? "text-teal-200 underline underline-offset-4" : "text-teal-300"
                          }`}
                        >
                          صفحة {qq.page}
                          <BookOpen aria-hidden className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            <footer className="grid shrink-0 gap-2 border-t border-[#1f2b2b] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:grid-cols-2">
              {wrongIdx.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={retryWrong}
                    className="press flex h-12 items-center justify-center gap-2 rounded-2xl bg-teal-700 font-semibold text-white hover:bg-teal-600"
                  >
                    أعد الأخطاء ({wrongIdx.length})
                    <RotateCcw aria-hidden className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={explainMistakes}
                    className="press flex h-12 items-center justify-center gap-2 rounded-2xl border border-[#2a3838] font-medium text-gray-100 hover:border-teal-500"
                  >
                    اشرح أخطائي
                    <Brain aria-hidden className="h-5 w-5" />
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={newQuiz}
                className={`press flex h-12 items-center justify-center gap-2 rounded-2xl font-semibold sm:col-span-2 ${
                  wrongIdx.length
                    ? "border border-[#2a3838] text-gray-100 hover:border-teal-500"
                    : "bg-teal-700 text-white hover:bg-teal-600"
                }`}
              >
                اختبار جديد
                <RefreshCw aria-hidden className="h-5 w-5" />
              </button>
            </footer>
          </>
        )}
      </section>
    </>
  );
}
