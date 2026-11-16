import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(process.cwd(), "src");
const globals = readFileSync(join(SRC, "app/globals.css"), "utf8");

function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return sourceFiles(path);
        return /\.(ts|tsx|css)$/.test(name) ? [ path ] : [];
    });
}

function block(selector: string) {
    const start = globals.indexOf(`${selector} {`);
    expect(start, selector).toBeGreaterThanOrEqual(0);
    return globals.slice(start, globals.indexOf("\n}", start));
}

describe("color tokens", () => {
    it("declares every --c-* token used anywhere in src, in both themes", () => {
        const light = block('[data-theme="light"]');
        const dark = block('[data-theme="dark"]');
        const used = new Set<string>();
        for (const file of sourceFiles(SRC)) {
            for (const match of readFileSync(file, "utf8").matchAll(/var\((--c-[\w-]+)/g)) used.add(match[ 1 ]);
        }
        const missing = [ ...used ].filter((token) => !light.includes(`${token}:`) || !dark.includes(`${token}:`)).sort();

        expect(missing).toEqual([]);
    });

    it("never gives a --c-* token a hex fallback", () => {
        const offenders: string[] = [];
        for (const file of sourceFiles(SRC)) {
            for (const match of readFileSync(file, "utf8").matchAll(/var\(--c-[\w-]+,\s*#[0-9a-fA-F]{3,8}\)/g)) offenders.push(`${file}: ${match[ 0 ]}`);
        }

        expect(offenders).toEqual([]);
    });

    it("keeps hex colors out of the bulk info title", () => {
        expect(block(".bulk-info__title")).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    });
});
