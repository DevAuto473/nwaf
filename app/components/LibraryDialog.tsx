"use client";

import React, { useEffect, useRef, useState } from "react";
import { BookOpen, Layers, ListChecks, Loader2, Network, Search, Trash2, X } from "lucide-react";
import { useAppContext } from "../context/AppContext";
import { removeLibraryItem, useLibrary, type LibraryItem } from "../lib/library";
import { usePresence } from "./chat/usePresence";

type Tab = "search" | "saved";
type Hit = { page: number; heading: string; snippet: string };

const KIND_LABEL = { quiz: "اختبار", mindmap: "خريطة ذهنية", flashcards: "بطاقات" } as const;

function KindIcon({ kind }: { kind: LibraryItem["kind"] }) {
  const cls = "h-5 w-5";
  return kind === "quiz" ? <ListChecks aria-hidden className={cls} /> : kind === "mindmap" ? <Network aria-hidden className={cls} /> : <Layers aria-hidden className={cls} />;
}

function Marked({ text, words }: { text: string; words: string[] }) {
  if (!words.length) return <>{text}</>;
  const re = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "g");
  return (
    <>
      {text.split(re).map((part, i) =>
        words.includes(part) ? (
          <b key={i} className="font-semibold text-white">
            {part}
          </b>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </>
  );
}

/** نافذة مكتبتي: بحث داخل الكتاب + كل ما ولّده يزيد وحُفظ. تفتح بالزر أو Ctrl+K. */
export default function LibraryDialog() {
  const { libraryOpen, setLibraryOpen, openPage, openQuiz, openStudy, askYazid } = useAppContext();
  const { mounted, visible } = usePresence(libraryOpen);
  const items = useLibrary();
  const [tab, setTab] = useState<Tab>("search");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Ctrl/⌘ + K
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setTab("search");
        setLibraryOpen(!libraryOpen);
      } else if (e.key === "Escape" && libraryOpen) {
        e.stopImmediatePropagation();
        setLibraryOpen(false);
      }
    };
    window.addEventListener("keydown", on, true);
    return () => window.removeEventListener("keydown", on, true);
  }, [libraryOpen, setLibraryOpen]);

  useEffect(() => {
    if (!libraryOpen) return;
    const t = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, [libraryOpen, tab]);

  // بحث بعد توقف الكتابة
  const term = q.trim();
  useEffect(() => {
    if (tab !== "search" || term.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        const d: { results?: Hit[] } = await r.json();
        setHits(d.results ?? []);
      } catch {
        /* أُلغي أو فشل */
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 280);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [term, tab]);

  if (!mounted) return null;
  const state = visible ? "open" : "closed";
  const words = term.split(/\s+/).filter((w) => w.length >= 2);
  const shown = term.length < 2 ? [] : hits;

  const openItem = (it: LibraryItem) => {
    setLibraryOpen(false);
    if (it.kind === "quiz" && it.quiz) {
      openQuiz({
        id: it.id,
        quiz: it.quiz,
        unitId: null,
        unitTitle: "مكتبتي",
        origin: null,
        ask: (text, o) => askYazid(text, o?.mode ?? "chat", null, o?.pages),
      });
    } else if (it.study) {
      openStudy({ id: it.id, study: it.study, unitTitle: "مكتبتي", origin: null });
    }
  };

  return (
    <>
      <div aria-hidden data-state={state} onClick={() => setLibraryOpen(false)} className="yz-scrim fixed inset-0 z-[100] bg-black/70" />
      <section
        role="dialog"
        aria-modal="true"
        aria-label="مكتبتي"
        data-state={state}
        className="yz-dialog fixed inset-x-3 top-[8vh] z-[101] mx-auto flex max-h-[80vh] max-w-xl flex-col overflow-hidden rounded-3xl border border-[#1f2b2b] bg-[#0d1414] shadow-2xl shadow-black"
      >
        <header className="flex items-center gap-2 border-b border-[#1f2b2b] p-3">
          <div role="tablist" className="grid flex-1 grid-cols-2 gap-1 rounded-2xl bg-[#121b1b] p-1">
            {(
              [
                ["search", "بحث في الكتاب", <Search key="s" aria-hidden className="h-4 w-4" />],
                ["saved", `محفوظاتي${items.length ? ` (${items.length})` : ""}`, <BookOpen key="b" aria-hidden className="h-4 w-4" />],
              ] as const
            ).map(([id, label, icon]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={`press flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-medium ${
                  tab === id ? "bg-teal-700 text-white" : "text-gray-300 hover:bg-[#1c2626]"
                }`}
              >
                {label}
                {icon}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setLibraryOpen(false)} aria-label="إغلاق" className="press flex h-11 w-11 items-center justify-center rounded-full text-gray-400 hover:bg-[#1c2626] hover:text-white">
            <X aria-hidden className="h-5 w-5" />
          </button>
        </header>

        {tab === "search" ? (
          <>
            <div className="relative p-3">
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ابحث عن مصطلح أو فكرة في الكتاب…"
                className="h-12 w-full rounded-2xl border border-[#2a3838] bg-[#121b1b] ps-4 pe-12 text-base text-white outline-none placeholder:text-gray-500 focus:border-teal-500"
              />
              <span className="pointer-events-none absolute end-7 top-1/2 -translate-y-1/2 text-gray-400">
                {loading ? <Loader2 aria-hidden className="h-5 w-5 animate-spin" /> : <Search aria-hidden className="h-5 w-5" />}
              </span>
            </div>
            <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 pb-3">
              {shown.map((h) => (
                <li key={h.page}>
                  <button
                    type="button"
                    onClick={() => {
                      setLibraryOpen(false);
                      openPage(h.page, [term]);
                    }}
                    className="press w-full rounded-2xl p-3 text-start hover:bg-[#1c2626]"
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-semibold text-teal-400">{h.heading || "الكتاب"}</span>
                      <span className="shrink-0 rounded-full bg-teal-800 px-2.5 py-0.5 text-xs font-semibold text-white">ص {h.page}</span>
                    </span>
                    <span className="mt-1 block text-sm leading-relaxed text-gray-400">
                      <Marked text={h.snippet} words={words} />
                    </span>
                  </button>
                </li>
              ))}
              {term.length >= 2 && !loading && shown.length === 0 && <li className="px-3 py-8 text-center text-sm text-gray-400">ما لقيت نتائج لـ «{term}»</li>}
              {term.length < 2 && <li className="px-3 py-8 text-center text-sm text-gray-400">اكتب كلمتين على الأقل · Ctrl + K يفتح هذه النافذة بأي وقت</li>}
            </ul>
          </>
        ) : (
          <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain p-3">
            {items.length === 0 && <li className="px-3 py-10 text-center text-sm text-gray-400">لا يوجد شيء محفوظ بعد. أي اختبار أو خريطة أو بطاقات يولّدها يزيد تنحفظ هنا تلقائياً.</li>}
            {items.map((it) => (
              <li key={it.id} className="flex items-center gap-1">
                <button type="button" onClick={() => openItem(it)} className="press flex min-w-0 flex-1 items-center gap-3 rounded-2xl p-3 text-start hover:bg-[#1c2626]">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-800 text-white">
                    <KindIcon kind={it.kind} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-white">{it.title}</span>
                    <span className="block text-xs text-gray-400">
                      {KIND_LABEL[it.kind]} · {new Date(it.createdAt).toLocaleDateString("ar-SA", { day: "numeric", month: "short" })}
                    </span>
                  </span>
                </button>
                <button type="button" onClick={() => removeLibraryItem(it.id)} aria-label={`حذف ${it.title}`} className="press flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-[#1c2626] hover:text-rose-400">
                  <Trash2 aria-hidden className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
