"use client";

import React, { useEffect, useState } from 'react';
import './Loader.css';

export default function Loader() {
  // يظهر الهامستر لحظة فتح الموقع ثم يتلاشى بنعومة (0.9 ثانية عرض + 0.35 تلاشٍ)
  const [phase, setPhase] = useState<"show" | "fade" | "gone">("show");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("fade"), 900);
    const t2 = setTimeout(() => setPhase("gone"), 1250);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (phase === "gone") return null;

  return (
    <div
      aria-hidden={phase === "fade"}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black transition-opacity duration-300"
      style={{ opacity: phase === "fade" ? 0 : 1, pointerEvents: phase === "fade" ? "none" : "auto" }}
    >
      <div aria-label="Orange and tan hamster running in a metal wheel" role="img" className="wheel-and-hamster">
        <div className="wheel" />
        <div className="hamster">
          <div className="hamster__body">
            <div className="hamster__head">
              <div className="hamster__ear" />
              <div className="hamster__eye" />
              <div className="hamster__nose" />
            </div>
            <div className="hamster__limb hamster__limb--fr" />
            <div className="hamster__limb hamster__limb--fl" />
            <div className="hamster__limb hamster__limb--br" />
            <div className="hamster__limb hamster__limb--bl" />
            <div className="hamster__tail" />
          </div>
        </div>
        <div className="spoke" />
      </div>
    </div>
  );
}
