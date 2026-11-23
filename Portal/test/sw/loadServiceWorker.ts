import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { vi } from "vitest";

type Listener = (event: unknown) => void;

const ORIGIN = "https://app.test";

function keyOf(req: Request | string): string {
  const url = typeof req === "string" ? req : req.url;
  return new URL(url, ORIGIN).href;
}

export class MemoryCache {
  entries = new Map<string, Response>();
  constructor(private readonly fetcher: (r: Request | string) => Promise<Response>) {}
  async put(req: Request | string, res: Response) { this.entries.set(keyOf(req), res); }
  async add(req: Request | string) { this.entries.set(keyOf(req), await this.fetcher(req)); }
  async match(req: Request | string) { return this.entries.get(keyOf(req))?.clone(); }
  async keys() { return [ ...this.entries.keys() ].map((url) => new Request(url)); }
  async delete(req: Request | string) { return this.entries.delete(keyOf(req)); }
}

export interface FetchResult { responded: boolean; response?: Response }

export interface SwHarness {
  fetch: ReturnType<typeof vi.fn>;
  stores: Map<string, MemoryCache>;
  seedCache(name: string): void;
  install(): Promise<void>;
  activate(): Promise<void>;
  dispatchFetch(opts: { url: string; mode?: string; method?: string }): Promise<FetchResult>;
  cacheKeys(): Promise<Record<string, string[]>>;
}

export function loadServiceWorker(): SwHarness {
  const source = readFileSync(path.resolve(__dirname, "../../public/sw.js"), "utf8");
  const listeners: Record<string, Listener> = {};
  const stores = new Map<string, MemoryCache>();
  const fetchMock = vi.fn();
  const fresh = () => new MemoryCache((r) => fetchMock(r));

  const caches = {
    async open(name: string) {
      if (!stores.has(name)) stores.set(name, fresh());
      return stores.get(name)!;
    },
    async match(req: Request | string) {
      for (const store of stores.values()) {
        const hit = await store.match(req);
        if (hit) return hit;
      }
      return undefined;
    },
    async keys() { return [ ...stores.keys() ]; },
    async delete(name: string) { return stores.delete(name); },
  };

  const self = {
    addEventListener: (type: string, fn: Listener) => { listeners[type] = fn; },
    skipWaiting: vi.fn(async () => undefined),
    clients: { claim: vi.fn(async () => undefined) },
    location: { origin: ORIGIN },
  };

  vm.runInNewContext(source, { self, caches, fetch: fetchMock, Request, Response, URL, Promise, console });

  async function lifecycle(type: "install" | "activate") {
    const waits: Promise<unknown>[] = [];
    listeners[type]!({ waitUntil: (p: Promise<unknown>) => waits.push(p) });
    await Promise.all(waits);
  }

  return {
    fetch: fetchMock,
    stores,
    seedCache: (name) => { stores.set(name, fresh()); },
    install: () => lifecycle("install"),
    activate: () => lifecycle("activate"),
    async dispatchFetch({ url, mode = "cors", method = "GET" }) {
      const real = new Request(url, { method });
      const request = { url: real.url, method, mode, clone: () => real.clone() } as unknown as Request;
      let pending: Promise<Response> | undefined;
      listeners.fetch!({ request, respondWith: (p: Promise<Response>) => { pending = Promise.resolve(p); } });
      if (!pending) return { responded: false };
      return { responded: true, response: await pending };
    },
    async cacheKeys() {
      const out: Record<string, string[]> = {};
      for (const [ name, store ] of stores) out[name] = [ ...store.entries.keys() ];
      return out;
    },
  };
}
