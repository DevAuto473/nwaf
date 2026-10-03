"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Brain,
  Send,
  X,
  User,
  Bot,
  Loader2,
  FileText,
  BookOpen,
  AlertCircle,
} from "lucide-react";
import { useAppContext } from "../context/AppContext";

interface Message {
  id: string;
  role: "user" | "ai";
  text: string;
  isError?: boolean;
}

interface HistoryEntry {
  role: "user" | "assistant";
  content: string;
}

// Extract text from a PDF blob URL using pdfjs-dist (loaded dynamically)
async function extractPdfText(url: string): Promise<string> {
  try {
    // Dynamically import pdfjs-dist to avoid SSR issues
    const pdfjs = await import("pdfjs-dist");
    // Set worker path using the CDN (avoids bundling the heavy worker)
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

    const loadingTask = pdfjs.getDocument({ url });
    const pdf = await loadingTask.promise;

    let fullText = "";
    const maxPages = Math.min(pdf.numPages, 20); // limit to 20 pages
    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ");
      fullText += pageText + "\n";
    }
    return fullText.trim();
  } catch (e) {
    console.warn("PDF extraction failed:", e);
    return "";
  }
}

export default function AIChatWidget() {
  const { isChatOpen, setIsChatOpen, selectedUnit } = useAppContext();

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "initial",
      role: "ai",
      text: "هلا، أنا يزيد مساعدكم الشخصي. وش حاب تسأل في المنهج؟",
    },
  ]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pdfCache, setPdfCache] = useState<Record<string, string>>({}); // url -> extracted text
  const [pdfStatus, setPdfStatus] = useState<
    "idle" | "loading" | "ready" | "none"
  >("idle");
  // Animation state
  const [isPanelMounted, setIsPanelMounted] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync panel mount with isChatOpen
  useEffect(() => {
    if (isChatOpen) {
      setIsExiting(false);
      setIsPanelMounted(true);
    }
  }, [isChatOpen]);

  // Trigger exit animation then unmount
  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      setIsPanelMounted(false);
      setIsChatOpen(false);
      setIsExiting(false);
    }, 180);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isChatOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isChatOpen]);

  // Auto-extract PDFs from the selected unit whenever the unit changes
  useEffect(() => {
    if (!selectedUnit) return;

    const pdfDocs = selectedUnit.lessons
      .flatMap((l) => l.documents ?? [])
      .filter((d) => d.type === "document" && d.url);

    if (pdfDocs.length === 0) {
      setPdfStatus("none");
      return;
    }

    // Only extract PDFs not yet cached
    const uncached = pdfDocs.filter((d) => d.url && !(d.url in pdfCache));
    if (uncached.length === 0) {
      setPdfStatus("ready");
      return;
    }

    setPdfStatus("loading");
    Promise.all(
      uncached.map(async (d) => {
        const text = await extractPdfText(d.url!);
        return [d.url!, text] as [string, string];
      })
    ).then((results) => {
      const newEntries = Object.fromEntries(results);
      setPdfCache((prev) => ({ ...prev, ...newEntries }));
      setPdfStatus("ready");
    });
  }, [selectedUnit]); // eslint-disable-line react-hooks/exhaustive-deps

  const getCombinedPdfText = useCallback((): string => {
    if (!selectedUnit) return "";
    return selectedUnit.lessons
      .flatMap((l) => l.documents ?? [])
      .filter((d) => d.type === "document" && d.url && pdfCache[d.url])
      .map((d) => pdfCache[d.url!])
      .join("\n\n")
      .slice(0, 4000); // hard cap to avoid huge tokens
  }, [selectedUnit, pdfCache]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      text,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    const thinkingId = `ai-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: thinkingId, role: "ai", text: "…" },
    ]);

    try {
      const context = selectedUnit
        ? `${selectedUnit.title} — ${selectedUnit.description}`
        : undefined;

      const pdfText = getCombinedPdfText();

      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          context,
          history,
          pdfText: pdfText || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === thinkingId
              ? { ...m, text: data.error ?? "حدث خطأ غير متوقع.", isError: true }
              : m
          )
        );
        return;
      }

      const aiReply: string = data.reply;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === thinkingId ? { ...m, text: aiReply } : m
        )
      );

      // Update history for multi-turn conversation (keep last 6 turns to save tokens)
      setHistory((prev) => {
        const updated: HistoryEntry[] = [
          ...prev,
          { role: "user", content: text },
          { role: "assistant", content: aiReply },
        ];
        return updated.slice(-12); // keep last 6 pairs = 12 entries
      });
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === thinkingId
            ? {
                ...m,
                text: "تعذر الوصول إلى الخادم. تحقق من اتصالك بالإنترنت.",
                isError: true,
              }
            : m
        )
      );
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const pdfCount =
    selectedUnit?.lessons
      .flatMap((l) => l.documents ?? [])
      .filter((d) => d.type === "document" && d.url).length ?? 0;

  return (
    <>
      {/* Floating Button */}
      {!isChatOpen && (
        <button
          onClick={() => setIsChatOpen(true)}
          title="يزيد (مساعدك في المذاكرة)"
          className="fab-enter fixed bottom-5 left-4 sm:bottom-6 sm:left-6 z-40 flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full border border-teal-700 bg-black transition-all hover:border-teal-500 hover:scale-110 shadow-lg shadow-teal-900/30"
        >
          <Brain className="h-5 w-5 sm:h-6 sm:w-6 text-teal-500" />
          {/* Pulse ring */}
          <span className="absolute inset-0 rounded-full border border-teal-700 animate-ping opacity-30" />
        </button>
      )}

      {/* Chat Panel */}
      {isPanelMounted && (
        <div
          dir="rtl"
          className={`fixed inset-0 sm:inset-auto sm:bottom-6 sm:left-6 z-50 flex flex-col sm:h-[520px] sm:w-[400px] rounded-none sm:rounded-2xl border-0 sm:border border-teal-800/70 bg-[#080c0c] shadow-2xl shadow-black/60 ${
            isExiting ? "chat-panel-exit" : "chat-panel-enter"
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-teal-800/60 px-4 py-3 shrink-0 bg-black/60 rounded-t-2xl">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-900/60 border border-teal-700/40">
                <Brain className="h-4 w-4 text-teal-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white leading-tight">
                  يزيد
                </p>
                <p className="text-[10px] text-teal-600 leading-tight">
                  {selectedUnit ? selectedUnit.title : "اختر وحدة للبدء"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* PDF status badge */}
              {selectedUnit && (
                <span
                  className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium border ${
                    pdfStatus === "ready" && pdfCount > 0
                      ? "border-teal-700 bg-teal-950 text-teal-400"
                      : pdfStatus === "loading"
                      ? "border-yellow-800 bg-yellow-950/50 text-yellow-500"
                      : "border-gray-800 bg-gray-950 text-gray-500"
                  }`}
                >
                  {pdfStatus === "loading" ? (
                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  ) : (
                    <FileText className="h-2.5 w-2.5" />
                  )}
                  {pdfStatus === "loading"
                    ? "جارٍ قراءة PDF..."
                    : pdfCount > 0
                    ? `${pdfCount} ملف PDF`
                    : "لا توجد ملفات"}
                </span>
              )}

              <button
                onClick={handleClose}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-teal-900/30 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Unit context strip */}
          {selectedUnit && (
            <div className="flex items-center gap-2 border-b border-teal-900/40 px-4 py-2 bg-teal-950/20 shrink-0">
              <BookOpen className="h-3 w-3 text-teal-600 shrink-0" />
              <p className="text-[10px] text-teal-600 truncate">
                السياق الحالي: <span className="text-teal-400">{selectedUnit.title}</span>
                {pdfStatus === "ready" && pdfCount > 0 && (
                  <span className="text-teal-600"> · سيبحث في {pdfCount} ملف PDF</span>
                )}
              </p>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${
                  msg.role === "user" ? "flex-row" : "flex-row-reverse"
                }`}
              >
                {/* Avatar */}
                <div
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full mt-0.5 ${
                    msg.role === "user"
                      ? "bg-teal-900 border border-teal-700"
                      : msg.isError
                      ? "bg-red-950 border border-red-800"
                      : "bg-black border border-teal-800"
                  }`}
                >
                  {msg.role === "user" ? (
                    <User className="h-3 w-3 text-teal-400" />
                  ) : msg.isError ? (
                    <AlertCircle className="h-3 w-3 text-red-400" />
                  ) : (
                    <Bot className="h-3 w-3 text-teal-500" />
                  )}
                </div>

                {/* Bubble */}
                <div
                  className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-[13px] leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-teal-900/40 border border-teal-800/60 text-white rounded-tr-sm"
                      : msg.isError
                      ? "bg-red-950/40 border border-red-800/40 text-red-300 rounded-tl-sm"
                      : msg.text === "…"
                      ? "bg-black border border-teal-900/40 text-teal-600 rounded-tl-sm"
                      : "bg-black border border-teal-900/40 text-gray-100 rounded-tl-sm"
                  }`}
                >
                  {msg.text === "…" ? (
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="h-3 w-3 animate-spin text-teal-500" />
                      <span className="text-teal-600 text-[11px]">يفكر…</span>
                    </span>
                  ) : (
                    msg.text
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-teal-800/50 p-3 shrink-0 bg-black/40 rounded-b-2xl">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                placeholder="اطرح سؤالاً عن الدرس..."
                className="flex-1 rounded-xl border border-teal-800/60 bg-black/60 px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none transition-colors focus:border-teal-600 disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-700 text-white transition-all hover:bg-teal-600 disabled:opacity-30 shrink-0 hover:scale-105"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="mt-1.5 text-center text-[9px] text-gray-700">
            nemotron-lightning · يبحث في محتوى الكتاب · مجاني
            </p>
          </div>
        </div>
      )}
    </>
  );
}
