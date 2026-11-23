import { beforeEach, describe, expect, it } from "vitest";
import { PROTECTED_PATHS } from "@/src/proxy";
import { loadServiceWorker, type SwHarness } from "./loadServiceWorker";

const ok = (body: string, type: ResponseType = "basic") => {
  const res = new Response(body, { status: 200 });
  Object.defineProperty(res, "type", { value: type });
  return res;
};

let sw: SwHarness;
beforeEach(() => {
  sw = loadServiceWorker();
  sw.fetch.mockImplementation(async (req: Request | string) => {
    const url = typeof req === "string" ? req : req.url;
    return url.endsWith("/offline.html") ? ok("Sin conexión") : ok("network");
  });
});

describe("service worker", () => {
  it("precaches only the offline page on install", async () => {
    await sw.install();
    expect(await sw.cacheKeys()).toEqual({ "pn-offline-v1": [ "https://app.test/offline.html" ] });
  });

  it("serves the network response for a provider navigation and caches nothing", async () => {
    await sw.install();
    const before = await sw.cacheKeys();
    sw.fetch.mockResolvedValue(ok("<html>"));
    const r = await sw.dispatchFetch({ url: "https://app.test/dashboard", mode: "navigate" });
    expect(r.responded).toBe(true);
    expect(await r.response!.text()).toBe("<html>");
    expect(await sw.cacheKeys()).toEqual(before);
  });

  it("falls back to the offline page when a provider navigation fails", async () => {
    await sw.install();
    sw.fetch.mockRejectedValue(new TypeError("offline"));
    const r = await sw.dispatchFetch({ url: "https://app.test/patients", mode: "navigate" });
    expect(await r.response!.text()).toContain("Sin conexión");
  });

  it.each([ ...PROTECTED_PATHS, "/login" ])("handles navigations under %s", async (p) => {
    await sw.install();
    const r = await sw.dispatchFetch({ url: `https://app.test${p}/x`, mode: "navigate" });
    expect(r.responded).toBe(true);
  });

  it("ignores /book navigations and patient-page requests", async () => {
    await sw.install();
    const before = await sw.cacheKeys();
    sw.fetch.mockRejectedValue(new TypeError("offline"));
    for (const p of [ "/book/confirmar/abc", "/book/e2e-publica", "/", "/privacy-policy" ]) {
      const r = await sw.dispatchFetch({ url: `https://app.test${p}`, mode: "navigate" });
      expect(r.responded, p).toBe(false);
    }
    expect(await sw.cacheKeys()).toEqual(before);
  });

  it("never intercepts API, cross-origin or non-GET requests", async () => {
    expect((await sw.dispatchFetch({ url: "https://api.test/v1/patients" })).responded).toBe(false);
    expect((await sw.dispatchFetch({ url: "https://app.test/_next/static/a.js", method: "POST" })).responded).toBe(false);
  });

  it("serves /_next/static from cache after the first fetch", async () => {
    const url = "https://app.test/_next/static/chunks/a.js";
    sw.fetch.mockImplementation(async () => ok("js"));
    const first = await sw.dispatchFetch({ url });
    expect(await first.response!.text()).toBe("js");
    const second = await sw.dispatchFetch({ url });
    expect(await second.response!.text()).toBe("js");
    expect(sw.fetch).toHaveBeenCalledTimes(1);
  });

  it("does not cache failed or opaque static responses", async () => {
    sw.fetch.mockResolvedValueOnce(new Response("nope", { status: 404 }));
    await sw.dispatchFetch({ url: "https://app.test/_next/static/a.js" });
    sw.fetch.mockResolvedValueOnce(ok("x", "opaque"));
    await sw.dispatchFetch({ url: "https://app.test/_next/static/b.js" });
    const keys = await sw.cacheKeys();
    expect(Object.values(keys).flat()).toEqual([]);
  });

  it("keeps at most 200 static entries, dropping the oldest", async () => {
    sw.fetch.mockImplementation(async () => ok("js"));
    for (let i = 0; i < 201; i++) await sw.dispatchFetch({ url: `https://app.test/_next/static/c${i}.js` });
    const keys = (await sw.cacheKeys())["pn-static-v1"]!;
    expect(keys).toHaveLength(200);
    expect(keys).not.toContain("https://app.test/_next/static/c0.js");
  });

  it("deletes older pn- caches on activate and keeps others", async () => {
    for (const n of [ "pn-static-v0", "pn-offline-v0", "other", "pn-static-v1" ]) sw.seedCache(n);
    await sw.activate();
    expect([ ...sw.stores.keys() ].sort()).toEqual([ "other", "pn-static-v1" ]);
  });
});
