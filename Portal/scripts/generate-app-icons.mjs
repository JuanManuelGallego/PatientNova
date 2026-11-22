// Builds the web app manifest icons in public/icons from the app icon (src/app/icon.png).
// Run from Portal/: `node scripts/generate-app-icons.mjs`. Uses the sharp that Next already installs.
//
// The source mark is only 128px, so the 512px icons are upscaled: replace src/app/icon.png with a larger
// (or vector-exported) mark and rerun to sharpen them.
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const requireFromNext = createRequire(createRequire(import.meta.url).resolve("next/package.json"));
const sharp = requireFromNext("sharp");

const SOURCE = join(root, "src/app/icon.png");
const OUT = join(root, "public/icons");
// theme.colors.surface: the mark sits on the same white as the app's top bar.
const BACKGROUND = "#ffffff";

/**
 * `any` icons keep the mark on a transparent canvas with a little air around it; maskable ones fill the canvas
 * with the background and keep the mark inside the central 80% safe zone that launchers never crop.
 */
const VARIANTS = [
    { file: "icon-192.png", size: 192, mark: 0.84, background: null },
    { file: "icon-512.png", size: 512, mark: 0.84, background: null },
    { file: "icon-maskable-192.png", size: 192, mark: 0.6, background: BACKGROUND },
    { file: "icon-maskable-512.png", size: 512, mark: 0.6, background: BACKGROUND },
];

mkdirSync(OUT, { recursive: true });
const trimmed = await sharp(SOURCE).trim().toBuffer();

for (const { file, size, mark, background } of VARIANTS) {
    const box = Math.round(size * mark);
    const logo = await sharp(trimmed)
        .resize(box, box, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: "lanczos3" })
        .toBuffer();
    await sharp({
        create: { width: size, height: size, channels: 4, background: background ?? { r: 0, g: 0, b: 0, alpha: 0 } },
    })
        .composite([ { input: logo, gravity: "center" } ])
        .png({ compressionLevel: 9 })
        .toFile(join(OUT, file));
    console.log(`public/icons/${file} ${size}x${size}`);
}
