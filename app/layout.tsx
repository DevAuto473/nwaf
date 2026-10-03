import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "منصة التعليم — مركز المنهج الدراسي",
  description:
    "تصفح وحداتك الدراسية، وصول إلى الدروس، تحميل الموارد، ومتابعة تقدمك — كل ذلك في مكان واحد.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ar" dir="rtl" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-black text-white relative">
        {/* Global Background Image */}
        <div 
          className="fixed inset-0 z-[-1] pointer-events-none bg-cover bg-center bg-no-repeat opacity-15"
          style={{ backgroundImage: `url('https://i.pinimg.com/1200x/a8/42/52/a84252128eec421e7761b20481d405d3.jpg')` }}
        />
        {children}
      </body>
    </html>
  );
}
