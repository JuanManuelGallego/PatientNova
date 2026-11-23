export const SERVICE_WORKER_PATH = "/sw.js";

export const OFFLINE_CACHE_PREFIX = "pn-offline-";

export const SERVICE_WORKER_HEADERS: { key: string; value: string }[] = [
  { key: "Content-Type", value: "application/javascript; charset=utf-8" },
  { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
];
