import { OFFLINE_CACHE_PREFIX } from "@/src/config/serviceWorker";

export async function clearAppCaches(): Promise<void> {
  try {
    if (typeof caches === "undefined") return;
    const names = await caches.keys();
    await Promise.all(names.filter((n) => !n.startsWith(OFFLINE_CACHE_PREFIX)).map((n) => caches.delete(n)));
  } catch {
  }
}
