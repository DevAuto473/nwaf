"use client";

import React from "react";
import { AppProvider } from "./context/AppContext";
import Navbar from "./components/Navbar";
import HeroSearch from "./components/HeroSearch";
import CurriculumGrid from "./components/CurriculumGrid";
import AIChatWidget from "./components/AIChatWidget";
import UnitAIChatModal from "./components/UnitAIChatModal";

export default function Home() {
  return (
    <AppProvider>
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex-1">
          <HeroSearch />
          <CurriculumGrid />
        </main>

        {/* Footer */}
        <footer className="px-4 py-5 sm:px-6 sm:py-6">
          <div className="mx-auto max-w-7xl rounded-2xl border border-teal-900 px-4 sm:px-5 py-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-right">
              <p className="text-xs text-gray-600">
                منصة التعليم — إدارة المحتوى التعليمي
              </p>
              <p className="text-xs text-gray-700">
                صُممت للمعلمين والطلاب
              </p>
            </div>
          </div>
        </footer>

        {/* Overlays */}
        <AIChatWidget />
        <UnitAIChatModal />
      </div>
    </AppProvider>
  );
}
