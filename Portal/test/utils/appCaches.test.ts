import { afterEach, describe, expect, it, vi } from "vitest";
import { clearAppCaches } from "@/src/utils/appCaches";

afterEach(() => vi.unstubAllGlobals());

describe("clearAppCaches", () => {
  it("deletes every cache except the offline page", async () => {
    const del = vi.fn().mockResolvedValue(true);
    vi.stubGlobal("caches", { keys: vi.fn().mockResolvedValue([ "pn-static-v1", "pn-offline-v1", "other" ]), delete: del });
    await clearAppCaches();
    expect(del).toHaveBeenCalledTimes(2);
    expect(del).toHaveBeenCalledWith("pn-static-v1");
    expect(del).toHaveBeenCalledWith("other");
  });

  it("does nothing when Cache Storage is missing or throws", async () => {
    vi.stubGlobal("caches", undefined);
    await expect(clearAppCaches()).resolves.toBeUndefined();
    vi.stubGlobal("caches", { keys: vi.fn().mockRejectedValue(new Error("denied")), delete: vi.fn() });
    await expect(clearAppCaches()).resolves.toBeUndefined();
  });
});
