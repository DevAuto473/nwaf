"use client";
/** تحميل صفحات الكتاب بـ pdf.js — مع كاش للمستندات والصور المرسومة. */
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import { locatePage } from "./pageHighlight";

export async function getPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  // ملفات pdf.js المساندة منسوخة في public/pdfjs (نفس إصدار المكتبة)
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
  return pdfjs;
}

const docs = new Map<string, Promise<PDFDocumentProxy>>();
function loadDoc(url: string) {
  let p = docs.get(url);
  if (!p) {
    p = getPdfjs().then(
      (pdfjs) =>
        pdfjs.getDocument({
          url,
          // تحميل الملف كاملاً: التحميل المتقطع (Range) يعلّق صفحات لو انقطع طلب
          wasmUrl: "/pdfjs/wasm/",
          cMapUrl: "/pdfjs/cmaps/",
          cMapPacked: true,
          standardFontDataUrl: "/pdfjs/standard_fonts/",
          iccUrl: "/pdfjs/iccs/",
        }).promise
    );
    p.catch(() => docs.delete(url));
    docs.set(url, p);
  }
  return p;
}

/** صفحة من الكتاب كاملاً (رقمها في الكتاب) */
export async function getBookPage(page: number): Promise<PDFPageProxy> {
  const { file, filePage } = locatePage(page);
  const doc = await loadDoc(file);
  return doc.getPage(filePage);
}

export interface PageImage {
  url: string;
  /** الارتفاع ÷ العرض */
  ratio: number;
}

const images = new Map<string, Promise<PageImage>>();

/** صورة الصفحة مرسومة بعرض معيّن (يُقرَّب لتقليل إعادة الرسم) */
export function pageImage(page: number, cssWidth: number): Promise<PageImage> {
  const bucket = Math.max(240, Math.ceil(cssWidth / 120) * 120);
  const key = `${page}@${bucket}`;
  let p = images.get(key);
  if (!p) {
    p = (async () => {
      const pdfPage = await getBookPage(page);
      const base = pdfPage.getViewport({ scale: 1 });
      const dpr = Math.min(typeof window === "undefined" ? 1 : window.devicePixelRatio || 1, 2);
      const viewport = pdfPage.getViewport({ scale: (bucket * dpr) / base.width });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no 2d context");
      // "print" يرسم دفعة واحدة بدون requestAnimationFrame — الوضع العادي
      // يتوقف إذا أوقف المتصفح الإطارات (تبويب بالخلفية، وضع توفير الطاقة)
      const task = pdfPage.render({ canvas, canvasContext: ctx, viewport, intent: "print" });
      // صفحة عالقة لا توقف الكتاب: نلغيها ونعيد المحاولة لاحقاً
      await Promise.race([
        task.promise,
        new Promise((_, no) =>
          setTimeout(() => {
            task.cancel();
            no(new Error("render timeout"));
          }, 15000)
        ),
      ]);
      const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.9));
      if (!blob) throw new Error("toBlob failed");
      return { url: URL.createObjectURL(blob), ratio: base.height / base.width };
    })();
    p.catch(() => images.delete(key));
    images.set(key, p);
  }
  return p;
}

/** تصحيح بسيط لنص pdf.js العربي قبل إرساله ليزيد */
export function cleanSelection(text: string) {
  return text
    .normalize("NFKC")
    .replace(/ـ+/g, "")
    .replace(/ا([أإآ])ل/g, "ال$1")
    .replace(/\s+/g, " ")
    .trim();
}
