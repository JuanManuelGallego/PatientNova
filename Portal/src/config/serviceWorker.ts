/** Service worker (`public/sw.js`): path, cache-name prefix and the headers it must be served with. */
export const SERVICE_WORKER_PATH = "/sw.js";

/** Every cache the worker owns starts with `pn-`; the offline page cache holds no data. */
export const OFFLINE_CACHE_PREFIX = "pn-offline-";

/** The worker script must never be cached by the browser or a CDN, so updates reach installed apps. */
export const SERVICE_WORKER_HEADERS: { key: string; value: string }[] = [
  { key: "Content-Type", value: "application/javascript; charset=utf-8" },
  { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
];
