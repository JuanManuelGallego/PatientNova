"use client";

import { useEffect } from "react";
import { SERVICE_WORKER_PATH } from "@/src/config/serviceWorker";

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
