"use client";

/** مكتبتي: كل اختبار/خريطة/بطاقات يولّدها يزيد تُحفظ في المتصفح (localStorage) وتُفتح لاحقاً بدون توليد جديد. */
import { useMemo, useSyncExternalStore } from "react";
import type { Quiz } from "./quiz";
import type { StudyData } from "./study";

export interface LibraryItem {
  id: string;
  kind: "quiz" | "mindmap" | "flashcards";
  title: string;
  createdAt: number;
  quiz?: Quiz;
  study?: StudyData;
}

const KEY = "nwaf-library-v1";
const MAX_ITEMS = 60;
const listeners = new Set<() => void>();

function read(): string {
  try {
    return localStorage.getItem(KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function parse(raw: string): LibraryItem[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function write(items: LibraryItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {
    /* الامتلاء أو الخصوصية: نتجاهل */
  }
  listeners.forEach((l) => l());
}

export function addLibraryItem(item: LibraryItem) {
  const items = parse(read()).filter((i) => i.id !== item.id);
  write([item, ...items]);
}

export function removeLibraryItem(id: string) {
  write(parse(read()).filter((i) => i.id !== id));
}

export function useLibrary(): LibraryItem[] {
  const raw = useSyncExternalStore(subscribe, read, () => "[]");
  return useMemo(() => parse(raw), [raw]);
}
