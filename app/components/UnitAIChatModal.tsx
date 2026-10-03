"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  X,
  Brain,
  Send,
  User,
  Bot,
  Loader2,
  AlertCircle,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { useAppContext, Unit } from "../context/AppContext";

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


export default function UnitAIChatModal() {
  const { unitChatUnit, setUnitChatUnit } = useAppContext();

  const [messages, setMessages] = useState<Message[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Mount/unmount with animation
  useEffect(() => {
    if (unitChatUnit) {
      setIsExiting(false);
      setIsMounted(true);
      // Reset conversation for new unit
      setMessages([
        {
          id: "welcome",
          role: "ai",
          text: `هلا، أنا يزيد مساعدكم الشخصي.\n\nوش حاب تسأل في "${unitChatUnit.title}"؟\n\n${unitChatUnit.description}`,
        },
      ]);
      setHistory([]);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [unitChatUnit]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleClose = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      setIsMounted(false);
      setUnitChatUnit(null);
      setIsExiting(false);
    }, 220);
  }, [setUnitChatUnit]);

  // Close on Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleClose]);

  const handleSend = async (text?: string) => {
    const msgText = (text ?? input).trim();
    if (!msgText || isLoading || !unitChatUnit) return;

    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", text: msgText };
    const thinkingId = `ai-${Date.now()}`;

    setMessages((prev) => [...prev, userMsg, { id: thinkingId, role: "ai", text: "…" }]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unit_id: unitChatUnit.id,
          message: msgText,
          history,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === thinkingId
              ? { ...m, text: data.error ?? "حدث خطأ.", isError: true }
              : m
          )
        );
        return;
      }

      const aiReply: string = data.reply;
      setMessages((prev) =>
        prev.map((m) => (m.id === thinkingId ? { ...m, text: aiReply } : m))
      );
      setHistory((prev) =>
        ([...prev, { role: "user" as const, content: msgText }, { role: "assistant" as const, content: aiReply }].slice(-12) as HistoryEntry[])
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === thinkingId
            ? { ...m, text: "تعذّر الاتصال بالخادم.", isError: true }
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

  if (!isMounted || !unitChatUnit) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 bg-black/70 backdrop-blur-sm ${
          isExiting ? "animate-[fadeIn_0.22s_ease-out_reverse]" : "modal-overlay"
        }`}
        onClick={handleClose}
      />

      {/* Fullscreen Modal */}
      <div
        dir="rtl"
        className={`fixed inset-0 z-50 flex flex-col transition-opacity duration-300 ${
          isExiting ? "opacity-0" : "opacity-100"
        }`}
      >
        {/* Background Image explicitly inside the modal */}
        <div 
          className="absolute inset-0 z-0 pointer-events-none bg-cover bg-center bg-[#020404]"
          style={{ backgroundImage: `url('https://i.pinimg.com/1200x/a8/42/52/a84252128eec421e7761b20481d405d3.jpg')`, opacity: 0.2 }}
        />
        
        {/* Modal Content Wrapper */}
        <div className="relative z-10 flex flex-col h-full w-full">

        {/* Header */}
        <div className="relative z-10 w-full border-b border-teal-900/30 bg-[#020404]/80 backdrop-blur-md shrink-0">
          <div className="max-w-3xl mx-auto flex items-center justify-between px-4 py-3 sm:py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-900/30 border border-teal-800/50">
                <Brain className="h-5 w-5 text-teal-500" />
              </div>
              <div>
                <p className="text-base font-medium text-white leading-tight">
                  يزيد
                </p>
                <p className="text-xs text-gray-500 leading-tight mt-0.5 max-w-[200px] sm:max-w-md truncate">
                  {unitChatUnit.title}
                </p>
              </div>
            </div>

            <button
              onClick={handleClose}
              className="flex h-10 w-10 items-center justify-center rounded-full text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>



        {/* Messages Container */}
        <div className="relative z-10 flex-1 overflow-y-auto w-full">
          <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-4 ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-5 py-3.5 leading-relaxed whitespace-pre-wrap text-[15px] ${
                    msg.role === "user"
                      ? "bg-teal-900/60 backdrop-blur-sm text-gray-100 rounded-tr-sm"
                      : msg.isError
                      ? "bg-red-950/60 backdrop-blur-sm text-red-300 rounded-tl-sm"
                      : msg.text === "…"
                      ? "bg-transparent text-gray-500"
                      : "bg-[#050808]/80 backdrop-blur-sm border border-teal-900/20 text-gray-300 rounded-tl-sm"
                  }`}
                >
                  {msg.text === "…" ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-teal-700" />
                      <span className="text-sm text-gray-500">يكتب...</span>
                    </span>
                  ) : (
                    msg.text
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="relative z-10 w-full border-t border-teal-900/30 bg-[#020404]/80 backdrop-blur-md shrink-0">
          <div className="max-w-3xl mx-auto px-4 py-4 sm:py-6">
            <div className="relative flex items-center">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                placeholder="اكتب رسالتك لـ يزيد..."
                className="w-full rounded-full border border-teal-900/40 bg-[#050808] px-6 py-4 pr-6 pl-14 text-[15px] text-white placeholder-gray-600 outline-none transition-colors focus:border-teal-700 focus:bg-[#070b0b] disabled:opacity-50"
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || isLoading}
                className="absolute left-2 flex h-10 w-10 items-center justify-center rounded-full bg-teal-800 text-white transition-colors hover:bg-teal-700 disabled:bg-transparent disabled:text-gray-600"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 -ml-0.5" />
                )}
              </button>
            </div>
            <p className="mt-3 text-center text-[11px] text-gray-600">
              يبحث في محتوى: {unitChatUnit.title}
            </p>
          </div>
        </div>
        </div>
      </div>
    </>
  );
}
