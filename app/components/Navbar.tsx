"use client";

import React, { useState } from "react";
import {
  GraduationCap,
  Menu,
  X,
} from "lucide-react";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="w-full bg-transparent px-4 pt-4 sm:px-6">
      {/* Floating rounded container */}
      <div className="mx-auto flex h-14 sm:h-16 max-w-7xl items-center justify-between rounded-2xl border border-teal-800 bg-black px-4 sm:px-5">
        {/* Logo */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl border border-teal-700 bg-black">
            <GraduationCap className="h-4 w-4 sm:h-5 sm:w-5 text-teal-600" />
          </div>
          <span
            className="text-base sm:text-lg font-semibold tracking-tight text-white"
            style={{ fontFamily: "'Zain', sans-serif" }}
          >
            منصة التعليم
          </span>
        </div>

        {/* Desktop Actions */}
        <div className="hidden sm:flex items-center gap-3">
          <div className="text-start">
            <p className="text-sm font-medium text-white"> الأستاذ نواف المزيني </p>
          </div>
        </div>

        {/* Mobile: hamburger */}
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex sm:hidden h-9 w-9 items-center justify-center rounded-lg border border-teal-800 bg-black text-gray-400"
          title="القائمة"
        >
          {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div className="sm:hidden mx-auto mt-2 max-w-7xl rounded-xl border border-teal-800 bg-black p-4 space-y-3">
          {/* User info */}
          <div className="flex items-center justify-between border-b border-teal-900 pb-3">
            <div>
              <p className="text-sm font-medium text-white">الأستاذ نواف المزيني</p>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
