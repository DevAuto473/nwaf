"use client";

import { useEffect } from "react";

/**
 * يدخل بالمستخدم وضع ملء الشاشة عند أول لمسة/نقرة/ضغطة مفتاح.
 * المتصفحات تمنع الدخول التلقائي بدون تفاعل من المستخدم، فلا يمكن أبكر من هذا.
 * إذا خرج المستخدم بنفسه (Esc) لا نعيده مرة ثانية في نفس الجلسة.
 */
const KEY = "fs-declined";

export default function AutoFullscreen() {
  useEffect(() => {
    const root = document.documentElement;
    if (!root.requestFullscreen) return; // مثل آيفون
    let declined = false;
    try {
      declined = sessionStorage.getItem(KEY) === "1";
    } catch {
      /* ignore */
    }
    if (declined || document.fullscreenElement) return;

    let entered = false;
    const cleanup = () => {
      window.removeEventListener("pointerdown", enter, true);
      window.removeEventListener("keydown", enter, true);
    };
    function enter() {
      cleanup();
      root.requestFullscreen({ navigationUI: "hide" }).then(
        () => {
          entered = true;
        },
        () => {
          /* رفضه المتصفح: لا بأس */
        }
      );
    }
    const onChange = () => {
      if (!document.fullscreenElement && entered) {
        try {
          sessionStorage.setItem(KEY, "1");
        } catch {
          /* ignore */
        }
      }
    };
    window.addEventListener("pointerdown", enter, true);
    window.addEventListener("keydown", enter, true);
    document.addEventListener("fullscreenchange", onChange);
    return () => {
      cleanup();
      document.removeEventListener("fullscreenchange", onChange);
    };
  }, []);

  return null;
}
