import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { buildSecurityHeaders } from "./src/config/securityHeaders";
import { assertApiUrlForBuild } from "./src/config/api";
import { uploadSourceMaps } from "./scripts/sentry-sourcemaps.mjs";

const nextConfig: NextConfig = {
  // Uploaded to Sentry and then deleted by scripts/sentry-sourcemaps.mjs (never served).
  productionBrowserSourceMaps: true,
  // Compile-time debug IDs (read by the Sentry SDK from `globalThis._debugIds`) match events to the
  // uploaded maps and change the chunk hashes, unlike rewriting chunks after the build.
  turbopack: { debugIds: true },
  compiler: {
    runAfterProductionCompile: async ({ distDir }) => uploadSourceMaps(distDir),
  },
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

export default function config(phase: string): NextConfig {
  if (phase === PHASE_PRODUCTION_BUILD) assertApiUrlForBuild(process.env.NEXT_PUBLIC_API_URL);
  return nextConfig;
}
