"use client";

import React from "react";
import Link from "next/link";
import { Dna, Library } from "lucide-react";
import { useAppContext } from "../context/AppContext";

export default function Navbar() {
  const { setLibraryOpen } = useAppContext();
  return (
    <header className="sticky top-0 z-30 w-full px-3 pt-3 sm:px-6 sm:pt-4">
      <div className="glass-bar mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 rounded-2xl px-3 sm:h-16 sm:px-5">
        <Link href="/" className="press flex min-h-11 min-w-0 items-center gap-2.5 rounded-xl">
          <span className="icon-tile flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
            <Dna className="h-5 w-5" aria-hidden />
          </span>
          <span className="font-heading text-lg font-bold text-white sm:text-xl">بوابة الأحياء</span>
        </Link>

        <div className="flex min-w-0 items-center gap-3">
          <p className="hidden truncate text-sm text-gray-300 sm:block">الأستاذ نواف المزيني</p>
          <button
            type="button"
            onClick={() => setLibraryOpen(true)}
            title="بحث في الكتاب ومحفوظاتي (Ctrl + K)"
            className="press flex h-11 items-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-medium text-white hover:bg-teal-600"
          >
            مكتبتي
            <Library aria-hidden className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
