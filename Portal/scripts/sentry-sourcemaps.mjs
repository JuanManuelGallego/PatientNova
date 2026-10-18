// Runs after `next build`: injects Debug IDs into the client chunks, uploads their source maps to
// Sentry, then deletes every .map file so the maps are never served publicly.
// Without SENTRY_AUTH_TOKEN the upload is skipped locally but fails a Vercel production build, so a
// missing secret cannot silently ship unreadable stack traces.
import { execFileSync } from "node:child_process";
import { readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const STATIC_DIR = ".next/static";

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

if (process.env.SENTRY_AUTH_TOKEN) {
    process.env.SENTRY_ORG ||= "juanmanuelgallego";
    process.env.SENTRY_PROJECT ||= "patientnova-portal";
    sentryCli("sourcemaps", "inject", STATIC_DIR);
    sentryCli("sourcemaps", "upload", STATIC_DIR);
} else if (process.env.VERCEL_ENV === "production") {
    console.error("SENTRY_AUTH_TOKEN is not set: refusing a production build without source maps in Sentry.");
    process.exit(1);
} else {
    console.warn("SENTRY_AUTH_TOKEN not set: skipping Sentry source map upload.");
}

console.log(`Deleted ${deleteMaps(STATIC_DIR)} source map files from ${STATIC_DIR}.`);
