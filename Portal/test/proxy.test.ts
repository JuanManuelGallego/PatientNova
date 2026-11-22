// @vitest-environment node
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { config, proxy } from "@/src/proxy";
import { NAV_GROUPS } from "@/src/config/navigation";

describe("login redirect", () => {
  it.each([
    "/patients",
    "/patients?search=Ana%20P%C3%A9rez&page=2&status=ACTIVE&status=INACTIVE",
  ])("preserves the return URL %s without an access cookie", (path) => {
    const response = proxy(new NextRequest(`https://patientnova.net${path}`));
    const location = new URL(response.headers.get("location")!);

    expect(response.status).toBe(307);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("from")).toBe(path);
  });
});

describe("public booking pages", () => {
  it("are never matched or redirected (anonymous patients have no provider cookie)", () => {
    expect(config.matcher.some((m) => m.startsWith("/book"))).toBe(false);
    const response = proxy(new NextRequest("https://patientnova.net/book/dra-maria"));
    expect(response.headers.get("location")).toBeNull();
    expect(response.status).toBe(200);
  });
});

describe("confirmation link", () => {
  it("/book/confirmar is not matched or redirected", () => {
    expect(config.matcher.some((m) => m.startsWith("/book"))).toBe(false);
    const response = proxy(new NextRequest("https://patientnova.net/book/confirmar/abc"));
    expect(response.headers.get("location")).toBeNull();
    expect(response.status).toBe(200);
  });
});

describe("provider navigation", () => {
  const paths = NAV_GROUPS.flatMap((g) => g.items).map((i) => i.path);

  it.each(paths)("%s is matched by the proxy", (path) => {
    expect(config.matcher).toContain(`${path}/:path*`);
  });

  it("sends /activity without a cookie to login", () => {
    const response = proxy(new NextRequest("https://patientnova.net/activity"));
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("from")).toBe("/activity");
  });

  it("sends /admin/users without a cookie to login", () => {
    const response = proxy(new NextRequest("https://patientnova.net/admin/users"));
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("from")).toBe("/admin/users");
  });
});


describe("installing the app", () => {
  it.each([
    "/app.webmanifest",
    "/icons/icon-192.png",
    "/icons/icon-512.png",
    "/icons/icon-maskable-512.png",
    "/apple-icon.png",
  ])("%s is served to anonymous requests (the browser fetches it without the session cookie)", (path) => {
    expect(config.matcher.some((m) => path.startsWith(m.replace("/:path*", "")))).toBe(false);
    const response = proxy(new NextRequest(`https://patientnova.net${path}`));
    expect(response.headers.get("location")).toBeNull();
    expect(response.status).toBe(200);
  });
});
