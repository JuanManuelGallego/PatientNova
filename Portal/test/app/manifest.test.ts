// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GET, dynamic } from "@/src/app/app.webmanifest/route";
import { WEB_MANIFEST_PATH } from "@/src/config/webManifest";
import { theme } from "@/src/config/theme";

function pngSize(path: string) {
    const bytes = readFileSync(path);
    expect(bytes.subarray(1, 4).toString("ascii"), path).toBe("PNG");
    return `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`;
}

async function served() {
    const response = GET();
    return { response, m: await response.json() };
}

describe("web app manifest", () => {
    it("is a static route handler at /app.webmanifest, served as a manifest", async () => {
        expect(WEB_MANIFEST_PATH).toBe("/app.webmanifest");
        expect(dynamic).toBe("force-static");
        const { response } = await served();
        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toBe("application/manifest+json");
    });

    it("is not an app-root metadata file, which Next would link from every page (booking and marketing included)", () => {
        for (const name of [ "manifest.ts", "manifest.js", "manifest.json", "manifest.webmanifest" ]) {
            expect(existsSync(join(process.cwd(), "src/app", name)), name).toBe(false);
        }
    });

    it("installs the provider portal as a standalone app that opens on the dashboard", async () => {
        const { m } = await served();
        expect(m).toMatchObject({
            id: "/dashboard",
            name: "Patient Nova",
            short_name: "Patient Nova",
            start_url: "/dashboard",
            scope: "/",
            display: "standalone",
            lang: "es",
        });
    });

    it("takes its colours from the brand tokens", async () => {
        const { m } = await served();
        expect(m.background_color).toBe(theme.colors.background);
        expect(m.theme_color).toBe(theme.themeColor.light);
    });

    it("offers 192 and 512 PNG icons, plain and maskable", async () => {
        const { m } = await served();
        const icons: { sizes: string; purpose?: string; type: string }[] = m.icons;
        const key = (purpose: string) => icons.filter((i) => (i.purpose ?? "any") === purpose).map((i) => i.sizes).sort();
        expect(key("any")).toEqual([ "192x192", "512x512" ]);
        expect(key("maskable")).toEqual([ "192x192", "512x512" ]);
        for (const icon of icons) expect(icon.type).toBe("image/png");
    });

    it("points every icon at a public file of the declared pixel size", async () => {
        const { m } = await served();
        for (const icon of m.icons as { src: string; sizes: string }[]) {
            expect(icon.src).toMatch(/^\/icons\/[\w-]+\.png$/);
            expect(pngSize(join(process.cwd(), "public", icon.src))).toBe(icon.sizes);
        }
    });
});
