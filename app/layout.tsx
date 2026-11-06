import type { Metadata, Viewport } from "next";
import "./globals.css";
import AutoFullscreen from "./components/AutoFullscreen";
import Loader from "./components/Loader";

export const metadata: Metadata = {
  title: "بوابة الأحياء",
  description:
    "تصفّح فصول كتاب الأحياء ١، افتح ملفاتها، واسأل يزيد عن أي درس — يجيبك من نص الكتاب مع رقم الصفحة.",
};

export const viewport: Viewport = {
  themeColor: "#000000",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ar" dir="rtl" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-black text-white relative">
        {/* خلفية + تدرّج يحافظ على وضوح النص */}
        <div
          aria-hidden
          className="fixed inset-0 z-[-2] pointer-events-none bg-cover bg-center bg-no-repeat opacity-35"
          style={{ backgroundImage: `url('https://i.pinimg.com/1200x/46/d6/7e/46d67ef0154db84138968eda72e29d75.jpg')` }}
        />
        <div aria-hidden className="fixed inset-0 z-[-1] pointer-events-none bg-linear-to-b from-black/20 via-black/60 to-black" />
        <Loader />
        <AutoFullscreen />
        {children}
      </body>
    </html>
  );
}
