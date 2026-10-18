// Called from next.config.ts (`compiler.runAfterProductionCompile`), i.e. inside `next build` and
// before Vercel collects the output: uploads the client source maps to Sentry, then deletes every
// .map file so the maps are never served publicly.
// Debug IDs come from Turbopack (`turbopack.debugIds`), so they are part of each chunk's content
// hash; never rewrite chunks here (e.g. `sentry-cli sourcemaps inject`): the file name would stay the
// same and the CDN would keep serving the previously cached, unmodified copy.
// Without SENTRY_AUTH_TOKEN the upload is skipped locally but fails a Vercel production build, so a
// missing secret cannot silently ship unreadable stack traces.
import { execFileSync } from "node:child_process";
import { readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

function sentryCli(...args) {
    execFileSync("sentry-cli", args, { stdio: "inherit", shell: process.platform === "win32" });
}

function deleteMaps(dir) {
    let count = 0;
    for (const entry of readdirSync(dir, { withFileTypes: true, recursive: true })) {
        if (entry.isFile() && entry.name.endsWith(".map")) {
            rmSync(join(entry.parentPath, entry.name));
            count++;
        }
    }
    return count;
}

/** @param {string} distDir Next's build output directory (`.next`). */
export function uploadSourceMaps(distDir) {
    const staticDir = join(distDir, "static");
    if (process.env.SENTRY_AUTH_TOKEN) {
        process.env.SENTRY_ORG ||= "juanmanuelgallego";
        process.env.SENTRY_PROJECT ||= "patientnova-portal";
        sentryCli("sourcemaps", "upload", staticDir);
    } else if (process.env.VERCEL_ENV === "production") {
        throw new Error("SENTRY_AUTH_TOKEN is not set: refusing a production build without source maps in Sentry.");
    } else {
        console.warn("SENTRY_AUTH_TOKEN not set: skipping Sentry source map upload.");
    }
    console.log(`Deleted ${deleteMaps(staticDir)} source map files from ${staticDir}.`);
}
