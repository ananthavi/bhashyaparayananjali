/**
 * PWA / web icon pipeline.
 *
 * Always uses the full figure of the Acharya at
 * `assets/source/shankaracharya.jpg`. Background is solid white, with
 * `xMidYMid meet` so the entire portrait is visible (letterboxed
 * vertically when the source is taller than the icon's square — which
 * it is). The maskable variant adds extra inset so the figure stays
 * inside Android's adaptive-icon safe zone after circular / squircle
 * clipping.
 */

import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';

const SRC_IMAGE = path.join(process.cwd(), 'assets', 'source', 'shankaracharya.jpg');

async function makeSvg(opts: {
  size: number;
  cornerRadius: number;
  imageInsetPct: number;
  bg: 'white' | 'maroon';
}): Promise<string> {
  const buf = await fs.readFile(SRC_IMAGE);
  const b64 = buf.toString('base64');
  const inset = Math.round(opts.size * opts.imageInsetPct);
  const inner = opts.size - inset * 2;
  const fill = opts.bg === 'white' ? '#ffffff' : '#6b3410';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${opts.size} ${opts.size}">
  <rect width="${opts.size}" height="${opts.size}" rx="${opts.cornerRadius}" fill="${fill}"/>
  <image x="${inset}" y="${inset}" width="${inner}" height="${inner}"
         preserveAspectRatio="xMidYMid meet"
         href="data:image/jpeg;base64,${b64}"/>
</svg>`;
}

async function writePng(svg: string, size: number, filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(filePath);
}

async function main(): Promise<void> {
  const outDir = path.join(process.cwd(), 'public', 'icons');
  await fs.mkdir(outDir, { recursive: true });

  // Normal launcher: pure white, gentle 3% inset so the figure breathes.
  const normalSvg = await makeSvg({
    size: 1024,
    cornerRadius: 192,
    imageInsetPct: 0.03,
    bg: 'white',
  });
  // Maskable: pure white plate too (so the launcher remains "white"
  // even after Android crops to a circle), with deeper inset so the
  // full figure survives clipping.
  const maskableSvg = await makeSvg({
    size: 1024,
    cornerRadius: 0,
    imageInsetPct: 0.16,
    bg: 'white',
  });

  const jobs = [
    { name: 'icon-192.png', size: 192, src: normalSvg },
    { name: 'icon-512.png', size: 512, src: normalSvg },
    { name: 'icon-maskable-512.png', size: 512, src: maskableSvg },
    { name: 'apple-touch-icon.png', size: 180, src: normalSvg },
  ];

  for (const j of jobs) {
    await writePng(j.src, j.size, path.join(outDir, j.name));
    // eslint-disable-next-line no-console
    console.log('wrote', j.name);
  }

  await fs.writeFile(path.join(process.cwd(), 'public', 'favicon.svg'), normalSvg, 'utf8');
  // eslint-disable-next-line no-console
  console.log('updated public/favicon.svg');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
