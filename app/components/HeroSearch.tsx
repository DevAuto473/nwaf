"use client";

import React from "react";
import { Search, X } from "lucide-react";
import { useAppContext } from "../context/AppContext";

export default function HeroSearch() {
  const { searchQuery, setSearchQuery } = useAppContext();

  return (
    <section className="mx-auto w-full max-w-7xl px-4 pt-12 pb-8 sm:px-6 sm:pt-20 sm:pb-12">
      <div className="text-center">
        <p className="text-sm font-medium text-teal-400">السنة الأولى المشتركة · نظام المسارات</p>
        <h1 className="mt-2 text-4xl font-bold text-white sm:text-5xl lg:text-6xl">الأحياء ١</h1>
        <p className="mx-auto mt-4 max-w-xl px-2 text-base leading-relaxed text-gray-300 sm:text-lg">
          تصفّح فصول الكتاب، وافتح ملفاتها، واسأل يزيد عن أي درس — يجيبك من نص الكتاب مع رقم الصفحة.
        </p>
      </div>

      <form
        role="search"
        onSubmit={(e) => e.preventDefault()}
        className="mx-auto mt-8 max-w-2xl sm:mt-10"
      >
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-teal-500"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث عن فصل أو موضوع… مثل: الفطريات"
            aria-label="ابحث في فصول الكتاب"
            className="glass-bar w-full rounded-full py-3.5 ps-12 pe-12 text-base text-white placeholder-gray-500 outline-none transition-[border-color,box-shadow] focus:border-teal-500 focus:shadow-[0_0_0_4px_rgba(20,184,166,0.15)] [&::-webkit-search-cancel-button]:hidden"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label="مسح البحث"
              className="press absolute end-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 hover:bg-[#1c2626] hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
