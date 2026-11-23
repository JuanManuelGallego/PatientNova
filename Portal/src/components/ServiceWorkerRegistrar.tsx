"use client";

import { useEffect } from "react";
import { SERVICE_WORKER_PATH } from "@/src/config/serviceWorker";

/**
 * Registers the offline-fallback worker. Rendered only by the login and protected layouts, never
 * by the root layout, the landing page or `/book/*` (see `public/sw.js`). Production only: in
 * development a worker would serve stale chunks.
 */
export default function ServiceWorkerRegistrar(): null {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register(SERVICE_WORKER_PATH, { scope: "/", updateViaCache: "none" })
      .catch(() => undefined);
  }, []);
  return null;
}
