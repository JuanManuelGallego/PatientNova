import { OFFLINE_CACHE_PREFIX } from "@/src/config/serviceWorker";

/**
 * Drops Cache Storage on logout. The offline page cache holds no data and is kept, so the
 * fallback still works after logout.
 */
export async function clearAppCaches(): Promise<void> {
  try {
    if (typeof caches === "undefined") return;
    const names = await caches.keys();
    await Promise.all(names.filter((n) => !n.startsWith(OFFLINE_CACHE_PREFIX)).map((n) => caches.delete(n)));
  } catch {
    // Cache Storage can be blocked (private mode); logout must not depend on it.
  }
}
