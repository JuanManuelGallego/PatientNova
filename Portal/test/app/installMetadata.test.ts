import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import * as protectedLayout from "@/src/app/(provider)/(protected)/layout";
import * as loginLayout from "@/src/app/(provider)/login/layout";
import * as root from "@/src/app/layout";
import * as providerLayout from "@/src/app/(provider)/layout";
import { theme } from "@/src/config/theme";
import { WEB_MANIFEST_PATH } from "@/src/config/webManifest";

vi.mock("next/font/google", () => ({ DM_Sans: () => ({ className: "font" }) }));

describe("installed app metadata", () => {
    it("links the manifest from provider pages and the login page only", () => {
        expect(protectedLayout.metadata.manifest).toBe(WEB_MANIFEST_PATH);
        expect(loginLayout.metadata.manifest).toBe(WEB_MANIFEST_PATH);
        // The landing page lives in (provider) too: no install offer there, nor on marketing and booking pages.
        expect(root.metadata.manifest).toBeUndefined();
        expect((providerLayout as { metadata?: unknown }).metadata).toBeUndefined();
    });

    it("opens full screen on iOS under the app's name, with dark status bar text over the white top bar", () => {
        expect(protectedLayout.metadata.appleWebApp).toEqual({ capable: true, title: "Patient Nova", statusBarStyle: "default" });
    });

    it("leaves the theme colour to PageLayout, which follows the provider's theme", () => {
        expect((protectedLayout as { viewport?: unknown }).viewport).toBeUndefined();
        expect(root.viewport.themeColor).toBeUndefined();
        expect(root.metadata.appleWebApp).toBeUndefined();
    });

    it("keeps the theme colours equal to the top bar's --c-surface in each theme", () => {
        const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
        const surface = (selector: string) => {
            const start = css.indexOf(`${selector} {`);
            return css.slice(start, css.indexOf("\n}", start)).match(/--c-surface:\s*(#[0-9a-f]+)/i)?.[ 1 ]?.toLowerCase();
        };
        expect(surface('[data-theme="light"]')).toBe(theme.themeColor.light.toLowerCase());
        expect(surface('[data-theme="dark"]')).toBe(theme.themeColor.dark.toLowerCase());
    });
});
