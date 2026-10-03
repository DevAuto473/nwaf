"use client";

import React from "react";
import { Search } from "lucide-react";
import { useAppContext } from "../context/AppContext";

export default function HeroSearch() {
  const { searchQuery, setSearchQuery } = useAppContext();

  return (
    <section className="mx-auto w-full max-w-7xl px-4 pt-10 pb-8 sm:pt-16 sm:pb-10 sm:px-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl leading-tight">
          المنهج الدراسي
        </h1>
        <p className="mx-auto mt-3 sm:mt-4 max-w-2xl text-sm sm:text-base text-gray-400 leading-relaxed px-2">
          تصفح وحداتك الدراسية، وصول إلى الدروس، تحميل الموارد، ومتابعة
          تقدمك — كل ذلك في مكان واحد.
        </p>
      </div>

      {/* Search Bar */}
      <div className="mx-auto mt-7 sm:mt-10 max-w-2xl">
        <div className="relative">
          <Search className="pointer-events-none absolute right-4 sm:right-5 top-1/2 h-4 w-4 sm:h-5 sm:w-5 -translate-y-1/2 text-teal-600" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث في الوحدات الدراسية..."
            className="w-full rounded-full border border-teal-700 bg-black py-3 sm:py-3.5 pr-11 sm:pr-13 pl-4 sm:pl-5 text-sm text-white placeholder-gray-600 outline-none transition-colors focus:border-teal-500"
          />
        </div>
      </div>
    </section>
  );
}
