import { describe, expect, it } from "vitest";
import { scrubBrowserEvent, scrubText } from "@/src/utils/observability/scrub";
import { buildCsp } from "@/src/config/securityHeaders";
import { scrubText as serverScrubText } from "../../../Server/src/utils/observability/scrub";

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

  it("scrubText matches the server implementation", () => {
    const corpus = [
      "Error saving ana@example.com",
      "call 300.111.2233 or (300) 111-2233 or +57 300 111 2233",
      "at 2026-10-14T10:30:00.000Z, id 00000000-0000-4000-8000-0000000000a1",
      "Invalid `prisma.patient.update()` invocation: data { firstName: \"Ana\" }",
      "Network request failed (503)",
    ];
    for (const text of corpus) expect(scrubText(text), text).toBe(serverScrubText(text));
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
