"use client";

import { useCallback, useRef, useState } from "react";
import { isQuizRequest, type Quiz } from "../../lib/quiz";
import { addLibraryItem } from "../../lib/library";
import { detectStudyMode, parsePageRange, type AiMode, type PageRange, type StudyData } from "../../lib/study";

export interface ChatMessage {
  id: string;
  role: "user" | "ai";
  text: string;
  isError?: boolean;
  pending?: boolean;
  pendingLabel?: string;
  /** اختبار تفاعلي مرفق بالرسالة — يُعرض كبطاقة تفتح لوحة الـ Canvas */
  quiz?: Quiz;
  /** خريطة ذهنية أو بطاقات مرفقة بالرسالة */
  study?: StudyData;
  /** يُفتح الاختبار تلقائياً عند وصوله */
  autoOpen?: boolean;
}

type HistoryEntry = { role: "user" | "assistant"; content: string };

/** النموذج أحياناً يكتب Markdown رغم التعليمات — نعرض نصاً نظيفاً */
function plain(text: string) {
  return text
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/^\s*[*•]\s+/gm, "- ")
    .replace(/`([^`]+)`/g, "$1");
}
export type SendOptions = { mode?: AiMode; pages?: PageRange };

const PENDING: Record<AiMode, string | undefined> = {
  chat: undefined,
  quiz: "يجهّز الاختبار…",
  mindmap: "يرسم الخريطة الذهنية…",
  flashcards: "يجهّز البطاقات…",
};

/** منطق محادثة يزيد — مشترك بين اللوحة العائمة ونافذة الوحدة */
export function useYazidChat(unitId: string | null, welcome: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "welcome", role: "ai", text: welcome },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const history = useRef<HistoryEntry[]>([]);
  const abort = useRef<AbortController | null>(null);

  const reset = useCallback((newWelcome: string) => {
    abort.current?.abort();
    abort.current = null;
    history.current = [];
    setIsLoading(false);
    setMessages([{ id: `welcome-${Date.now()}`, role: "ai", text: newWelcome }]);
  }, []);

  const send = useCallback(
    async (raw: string, opts?: SendOptions) => {
      const text = raw.trim();
      if (!text || isLoading) return;
      const mode: AiMode = opts?.mode ?? detectStudyMode(text) ?? (isQuizRequest(text) ? "quiz" : "chat");
      const pages = opts?.pages ?? parsePageRange(text) ?? undefined;

      const now = Date.now();
      const pendingId = `ai-${now}`;
      setMessages((prev) => [
        ...prev,
        { id: `u-${now}`, role: "user", text },
        {
          id: pendingId,
          role: "ai",
          text: "",
          pending: true,
          pendingLabel: PENDING[mode],
        },
      ]);
      setIsLoading(true);

      const controller = new AbortController();
      abort.current = controller;
      const finish = (patch: Partial<ChatMessage>) =>
        setMessages((prev) =>
          prev.map((m) => (m.id === pendingId ? { ...m, ...patch, pending: false } : m))
        );

      try {
        const res = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            unit_id: unitId ?? undefined,
            message: text,
            history: history.current,
            mode,
            pages,
          }),
          signal: controller.signal,
        });
        const data: { reply?: string; error?: string; quiz?: Quiz; study?: StudyData } = await res
          .json()
          .catch(() => ({}));

        if (!res.ok || data.error || !data.reply) {
          finish({
            text:
              data.error ??
              (mode !== "chat" ? "ما قدرت أجهّز الطلب. حاول مرة ثانية." : "حدث خطأ غير متوقع. حاول مرة أخرى."),
            isError: true,
          });
          return;
        }

        finish({ text: plain(data.reply), quiz: data.quiz, study: data.study, autoOpen: !!(data.quiz || data.study) });
        // حفظ تلقائي في مكتبتي
        if (data.quiz) addLibraryItem({ id: pendingId, kind: "quiz", title: data.quiz.title, createdAt: now, quiz: data.quiz });
        else if (data.study) addLibraryItem({ id: pendingId, kind: data.study.kind, title: data.study.data.title, createdAt: now, study: data.study });
        const assistantText = data.quiz
          ? `${data.reply}\n(أرسلت اختباراً تفاعلياً: «${data.quiz.title}» — ${data.quiz.questions.length} أسئلة)`
          : data.study
          ? `${data.reply}\n(أرسلت ${data.study.kind === "mindmap" ? "خريطة ذهنية" : "بطاقات"}: «${data.study.data.title}»)`
          : data.reply;
        const next: HistoryEntry[] = [
          ...history.current,
          { role: "user", content: text },
          { role: "assistant", content: assistantText },
        ];
        history.current = next.slice(-12);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        finish({ text: "تعذّر الاتصال بالخادم. تحقق من اتصالك بالإنترنت.", isError: true });
      } finally {
        if (abort.current === controller) {
          abort.current = null;
          setIsLoading(false);
        }
      }
    },
    [isLoading, unitId]
  );

  return { messages, isLoading, send, reset };
}
