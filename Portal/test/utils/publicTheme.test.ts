import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PUBLIC_CSS_DIR = join(process.cwd(), "src/components/PublicBooking");
const globals = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
const publicCss = readdirSync(PUBLIC_CSS_DIR)
    .filter((file) => file.endsWith(".css"))
    .map((file) => ({ file, css: readFileSync(join(PUBLIC_CSS_DIR, file), "utf8") }));

/** The declarations of the first block that opens with `selector`. */
function block(selector: string) {
    const start = globals.indexOf(`${selector} {`);
    expect(start, selector).toBeGreaterThanOrEqual(0);
    return globals.slice(start, globals.indexOf("\n}", start));
}

describe("public pages theme", () => {
    // An undefined color token does not fail: the text silently takes the inherited color instead.
    it("defines every color token the public pages use, in both themes", () => {
        const light = block('[data-theme="light"]');
        const dark = block('[data-theme="dark"]');
        const missing = publicCss.flatMap(({ file, css }) => [ ...css.matchAll(/var\((--c-[\w-]+)\)/g) ]
            .map((match) => match[ 1 ])
            .filter((token) => !light.includes(`${token}:`) || !dark.includes(`${token}:`))
            .map((token) => `${file}: ${token}`));

        expect([ ...new Set(missing) ]).toEqual([]);
    });

    // <body> resolves its color from the html theme, so without this a dark theme reaches inherited text.
    it("sets the text color on the light frame, not only the tokens", () => {
        const css = publicCss.find(({ file }) => file === "PublicChrome.module.css")!.css;
        const frame = css.slice(css.indexOf(".frame {"), css.indexOf("}", css.indexOf(".frame {")));

        expect(frame).toMatch(/\n\s*color: var\(--c-gray-900\);/);
    });

    // Each of these is under 4.5:1 on the white and lilac surfaces of the public pages.
    it("keeps text off the colors too faint to read, disabled controls included", () => {
        const faint = publicCss.flatMap(({ file, css }) => [ ...css.matchAll(/^\s*color: var\(--c-(gray-300|gray-400|error|success|warning)\);/gm) ]
            .map((match) => `${file}: ${match[ 1 ]}`));

        expect(faint).toEqual([]);
    });

    it("shows inline errors in the readable red", () => {
        expect(block(".error-inline")).toContain("color: var(--c-error-text);");
    });

    // The global rule fades the button to 1.9:1, which leaves a patient guessing what it says.
    it("gives a disabled primary button a solid look on the public pages", () => {
        const css = publicCss.find(({ file }) => file === "PublicChrome.module.css")!.css;
        const start = css.indexOf(".frame :global(.btn-primary):disabled {");
        expect(start).toBeGreaterThanOrEqual(0);
        const rule = css.slice(start, css.indexOf("}", start));

        expect(rule).toContain("opacity: 1;");
        expect(rule).toContain("color: var(--c-gray-600);");
    });
});
