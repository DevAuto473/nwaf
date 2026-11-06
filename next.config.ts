import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // واجهات الخادم تقرأ نص الكتاب من القرص (fs) — لازم تُضمَّن صراحةً عند النشر على Vercel
  outputFileTracingIncludes: {
    "/api/ai": ["./units/index.json", "./units/pages/unit1/*.md"],
    "/api/search": ["./units/index.json"],
  },
};

export default nextConfig;
