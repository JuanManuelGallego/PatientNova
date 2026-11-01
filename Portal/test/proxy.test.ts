// @vitest-environment node
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { config, proxy } from "@/src/proxy";

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
