"use client";

import React, { useRef } from "react";
import type { PanelId } from "../context/AppContext";
import { useWorkspace } from "./useWorkspace";

/** مقبض سحب على الحافة اليمنى للنافذة لتكبير/تصغير عرضها (نقر مزدوج = الافتراضي). */
export default function ResizeHandle({ id }: { id: PanelId }) {
  const ws = useWorkspace();
  const drag = useRef<{ left: number } | null>(null);

  const set = (w: number) => ws.setPanelWidth(id, Math.max(ws.min[id], Math.min(w, ws.maxWidth(id))));

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="تغيير عرض النافذة"
      tabIndex={0}
      onDoubleClick={() => ws.setPanelWidth(id, null)}
      onPointerDown={(e) => {
        const panel = e.currentTarget.parentElement;
        if (!panel) return;
        drag.current = { left: panel.getBoundingClientRect().left };
        e.currentTarget.setPointerCapture(e.pointerId);
        document.documentElement.dataset.resizing = "1";
      }}
      onPointerMove={(e) => {
        if (drag.current) set(e.clientX - drag.current.left);
      }}
      onPointerUp={() => {
        drag.current = null;
        delete document.documentElement.dataset.resizing;
      }}
      onPointerCancel={() => {
        drag.current = null;
        delete document.documentElement.dataset.resizing;
      }}
      onKeyDown={(e) => {
        const cur = e.currentTarget.parentElement?.getBoundingClientRect().width ?? 560;
        if (e.key === "ArrowRight") set(cur + 32);
        else if (e.key === "ArrowLeft") set(cur - 32);
      }}
      className="rz-handle group absolute inset-y-0 right-0 z-20 hidden w-4 cursor-col-resize touch-none items-center justify-center lg:flex"
    >
      <span className="h-14 w-1.5 rounded-full bg-[#2a3838] transition-[height,background-color] duration-200 group-hover:h-20 group-hover:bg-teal-700 group-active:bg-teal-600" />
    </div>
  );
}
