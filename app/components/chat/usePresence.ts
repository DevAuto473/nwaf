"use client";

import { useEffect, useState } from "react";

/**
 * يبقي العنصر في الصفحة أثناء حركة الخروج.
 * mounted = مفتوح، أو ما زال يخرج. visible = الحالة المرئية (تتحكم بانتقال CSS).
 * لو أعاد المستخدم الفتح أثناء الإغلاق، تنعكس الحركة من موضعها الحالي.
 */
export function usePresence(open: boolean, exitMs = 450) {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (open) {
      // إطاران حتى يرسم المتصفح الحالة "مغلق" أولاً فتعمل الحركة،
      // ومؤقت احتياطي لأن بعض المتصفحات توقف requestAnimationFrame
      let done = false;
      const enter = () => {
        if (done) return;
        done = true;
        setEntered(true);
      };
      let inner = 0;
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(enter);
      });
      const fallback = setTimeout(enter, 60);
      return () => {
        done = true;
        cancelAnimationFrame(outer);
        cancelAnimationFrame(inner);
        clearTimeout(fallback);
      };
    }
    const t = setTimeout(() => setEntered(false), exitMs);
    return () => clearTimeout(t);
  }, [open, exitMs]);

  return { mounted: open || entered, visible: open && entered };
}
