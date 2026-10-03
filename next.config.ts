import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // /api/ai يقرأ فهرس الكتاب من القرص — يجب تضمينه عند النشر (Vercel وغيره)
  outputFileTracingIncludes: {
    "/api/ai": ["./units/index.json"],
  },
};

export default nextConfig;
