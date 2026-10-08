import { describe, expect, it } from "vitest";
import { buildCsp, buildSecurityHeaders } from "@/src/config/securityHeaders";

describe("security headers", () => {
  const prod = { apiUrl: "https://api.patientnova.net/v1", isDev: false };

  it("locks framing, objects and base URI, and limits network access to self + the API", () => {
    const csp = buildCsp(prod);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("connect-src 'self' https://api.patientnova.net");
    expect(csp).toContain("img-src 'self' data: blob: https://flagcdn.com");
  });

  it("allows no third-party script sources and no eval in production", () => {
    const script = buildCsp(prod).split("; ").find((d) => d.startsWith("script-src"))!;
    expect(script).not.toMatch(/https?:/);
    expect(script).not.toContain("unsafe-eval");
    expect(buildCsp({ ...prod, isDev: true })).toContain("'unsafe-eval'");
  });

  it("ships as Report-Only until enforcement is switched on", () => {
    const reportOnly = buildSecurityHeaders({ ...prod, enforceCsp: false }).map((h) => h.key);
    expect(reportOnly).toContain("Content-Security-Policy-Report-Only");
    expect(reportOnly).not.toContain("Content-Security-Policy");
    const enforced = buildSecurityHeaders({ ...prod, enforceCsp: true }).map((h) => h.key);
    expect(enforced).toContain("Content-Security-Policy");
  });

  it("sets the baseline hardening headers", () => {
    const headers = Object.fromEntries(buildSecurityHeaders({ ...prod, enforceCsp: true }).map((h) => [ h.key, h.value ]));
    expect(headers[ "Referrer-Policy" ]).toBe("strict-origin-when-cross-origin");
    expect(headers[ "X-Content-Type-Options" ]).toBe("nosniff");
    expect(headers[ "X-Frame-Options" ]).toBe("DENY");
    expect(headers[ "Permissions-Policy" ]).toMatch(/camera=\(\)/);
    expect(headers[ "Strict-Transport-Security" ]).toMatch(/max-age=\d+/);
  });

  it("ignores a malformed API URL instead of throwing", () => {
    expect(buildCsp({ apiUrl: "not a url", isDev: false })).toContain("connect-src 'self'");
  });
});
