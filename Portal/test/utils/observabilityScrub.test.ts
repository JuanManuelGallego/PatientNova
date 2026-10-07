import { describe, expect, it } from "vitest";
import { scrubBrowserEvent, scrubText } from "@/src/utils/observability/scrub";
import { buildCsp } from "@/src/config/securityHeaders";

describe("error-tracking scrubbing (browser)", () => {
  it("masks personal data and drops user, extra, breadcrumbs and request details", () => {
    const out = scrubBrowserEvent({
      message: "Error saving ana@example.com",
      exception: { values: [ { value: "Phone +573001112233 invalid" } ] },
      request: { url: "https://patientnova.net/patients?search=Ana", headers: { cookie: "x" } },
      user: { id: "u1", email: "a@b.co" },
      extra: { form: { name: "Ana" } },
      breadcrumbs: [ { message: "click" } ],
    });
    const json = JSON.stringify(out);
    expect(out.request).toEqual({ url: "https://patientnova.net/patients" });
    expect(out.user).toBeUndefined();
    for (const leaked of [ "ana@example.com", "573001112233", "Ana", "cookie", "a@b.co" ]) {
      expect(json, leaked).not.toContain(leaked);
    }
  });

  it("scrubText leaves harmless text alone", () => {
    expect(scrubText("Network request failed (503)")).toBe("Network request failed (503)");
  });
});

describe("CSP and error tracking", () => {
  it("allows the Sentry ingest origin only when a DSN is configured", () => {
    const dsn = "https://abc123@o1.ingest.sentry.io/42";
    expect(buildCsp({ isDev: false, sentryDsn: dsn })).toContain("https://o1.ingest.sentry.io");
    expect(buildCsp({ isDev: false })).not.toContain("sentry");
    expect(buildCsp({ isDev: false, sentryDsn: "garbage" })).not.toContain("sentry");
  });
});
