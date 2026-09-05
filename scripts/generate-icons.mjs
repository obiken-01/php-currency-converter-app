/**
 * Regenerates the PWA icons from public/icon.svg.
 *
 *   node scripts/generate-icons.mjs
 *
 * The source SVG draws its currency symbols with <text>, which resvg (inside
 * sharp) will not render without a font file — so the glyphs are converted to
 * a rasterised copy here rather than relying on system fonts being present on
 * whatever machine runs this.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, "public/icons");

// The marks are drawn as paths so nothing depends on an installed font.
// Laid out to match public/icon.svg: $ on top, ¥ and € mid, ₱ below.
const svg = (opts) => {
  const { size, pad } = opts;
  // Maskable icons need ~20% safe-zone padding or Android crops the artwork.
  const scale = (512 - pad * 2) / 512;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#ffffff"/>
  <g transform="translate(${pad},${pad}) scale(${scale})">
    <circle cx="256" cy="256" r="236" fill="#ffffff" stroke="#0d1117" stroke-width="24"/>
    <g fill="#0d1117" font-family="DejaVu Sans, Arial, sans-serif" font-size="150" font-weight="700" text-anchor="middle">
      <text x="256" y="190">$</text>
      <text x="170" y="320">¥</text>
      <text x="342" y="320">€</text>
      <text x="256" y="430">₱</text>
    </g>
  </g>
</svg>`;
};

const targets = [
  { file: "icon-192.png", size: 192, pad: 0 },
  { file: "icon-512.png", size: 512, pad: 0 },
  { file: "icon-maskable-512.png", size: 512, pad: 52 }, // ~20% safe zone
  { file: "apple-touch-icon.png", size: 180, pad: 0 },
];

await mkdir(outDir, { recursive: true });

for (const { file, size, pad } of targets) {
  const buffer = await sharp(Buffer.from(svg({ size, pad })), { density: 384 })
    .resize(size, size)
    .png()
    .toBuffer();
  await writeFile(resolve(outDir, file), buffer);
  console.log(`${file}  ${size}x${size}  ${(buffer.length / 1024).toFixed(1)} kB`);
}

// Apple looks for this at the site root.
await writeFile(
  resolve(root, "public/apple-touch-icon.png"),
  await sharp(resolve(outDir, "apple-touch-icon.png")).toBuffer()
);
console.log("public/apple-touch-icon.png");
