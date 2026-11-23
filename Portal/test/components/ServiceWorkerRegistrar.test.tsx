import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ServiceWorkerRegistrar from "@/src/components/ServiceWorkerRegistrar";

afterEach(() => {
  vi.unstubAllEnvs();
  Reflect.deleteProperty(navigator, "serviceWorker");
});

function stubServiceWorker(register: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, "serviceWorker", { value: { register }, configurable: true });
}

describe("ServiceWorkerRegistrar", () => {
  it("registers /sw.js at scope / in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const register = vi.fn().mockResolvedValue({});
    stubServiceWorker(register);
    render(<ServiceWorkerRegistrar />);
    expect(register).toHaveBeenCalledWith("/sw.js", { scope: "/", updateViaCache: "none" });
  });

  it("does not register outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    const register = vi.fn().mockResolvedValue({});
    stubServiceWorker(register);
    render(<ServiceWorkerRegistrar />);
    expect(register).not.toHaveBeenCalled();
  });

  it("does nothing when service workers are unsupported", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => render(<ServiceWorkerRegistrar />)).not.toThrow();
  });

  it("swallows a rejected registration", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const register = vi.fn().mockRejectedValue(new Error("blocked"));
    stubServiceWorker(register);
    render(<ServiceWorkerRegistrar />);
    await new Promise((r) => setTimeout(r, 0));
    expect(register).toHaveBeenCalled();
  });
});
