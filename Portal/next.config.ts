import type { NextConfig } from "next";
import { buildSecurityHeaders } from "./src/config/securityHeaders";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "flagcdn.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: buildSecurityHeaders({
          apiUrl: process.env.NEXT_PUBLIC_API_URL,
          sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
          isDev: process.env.NODE_ENV !== "production",
          enforceCsp: process.env.CSP_ENFORCE === "true",
        }),
      },
    ];
  },
};

export default nextConfig;
