const VERSION = "v1";
const STATIC_CACHE = "pn-static-" + VERSION;
const OFFLINE_CACHE = "pn-offline-" + VERSION;
const OFFLINE_URL = "/offline.html";
const MAX_STATIC_ENTRIES = 200;

const PROVIDER_PATHS = [
  "/dashboard",
  "/patients",
  "/appointments",
  "/calendar",
  "/reminders",
  "/settings",
  "/medical-records",
  "/requests",
  "/activity",
  "/admin/users",
  "/login",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(OFFLINE_CACHE)
      .then((cache) => cache.add(OFFLINE_URL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((n) => n.startsWith("pn-") && n !== STATIC_CACHE && n !== OFFLINE_CACHE)
            .map((n) => caches.delete(n)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function trimStatic(cache) {
  return cache.keys().then((keys) => {
    const extra = keys.length - MAX_STATIC_ENTRIES;
    if (extra <= 0) return undefined;
    return Promise.all(keys.slice(0, extra).map((k) => cache.delete(k)));
  });
}

function staticResponse(request) {
  return caches.open(STATIC_CACHE).then((cache) =>
    cache.match(request).then((hit) => {
      if (hit) return hit;
      return fetch(request).then((response) => {
        if (response.ok && response.type === "basic") {
          return cache
            .put(request, response.clone())
            .then(() => trimStatic(cache))
            .then(() => response);
        }
        return response;
      });
    }),
  );
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(staticResponse(request));
    return;
  }

  if (
    request.mode === "navigate" &&
    PROVIDER_PATHS.some((p) => url.pathname === p || url.pathname.startsWith(p + "/"))
  ) {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
  }
});
