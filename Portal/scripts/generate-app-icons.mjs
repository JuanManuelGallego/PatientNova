import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const requireFromNext = createRequire(createRequire(import.meta.url).resolve("next/package.json"));
const sharp = requireFromNext("sharp");

const SOURCE = join(root, "src/app/icon.png");
const OUT = join(root, "public/icons");
const BACKGROUND = "#ffffff";

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
