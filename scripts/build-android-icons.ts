/**
 * Android launcher (mipmap-*) and splash drawables.
 *
 * Always uses the full figure of the Acharya. Pure-white background
 * for the launcher and adaptive-icon background; maroon plate for the
 * splash. The adaptive-icon background drawable in
 * res/values/colors.xml has been updated to white separately.
 */

import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';

const SRC_IMAGE = path.join(process.cwd(), 'assets', 'source', 'shankaracharya.jpg');
const ANDROID_RES = path.join(process.cwd(), 'android', 'app', 'src', 'main', 'res');

interface Target {
  dir: string;
  size: number;
}

const LAUNCHER_TARGETS: Target[] = [
  { dir: 'mipmap-mdpi', size: 48 },
  { dir: 'mipmap-hdpi', size: 72 },
  { dir: 'mipmap-xhdpi', size: 96 },
  { dir: 'mipmap-xxhdpi', size: 144 },
  { dir: 'mipmap-xxxhdpi', size: 192 },
];

const FOREGROUND_TARGETS: Target[] = [
  { dir: 'mipmap-mdpi', size: 108 },
  { dir: 'mipmap-hdpi', size: 162 },
  { dir: 'mipmap-xhdpi', size: 216 },
  { dir: 'mipmap-xxhdpi', size: 324 },
  { dir: 'mipmap-xxxhdpi', size: 432 },
];

const SPLASH_TARGETS: Target[] = [
  { dir: 'drawable-port-mdpi', size: 320 },
  { dir: 'drawable-port-hdpi', size: 480 },
  { dir: 'drawable-port-xhdpi', size: 720 },
  { dir: 'drawable-port-xxhdpi', size: 960 },
  { dir: 'drawable-port-xxxhdpi', size: 1280 },
  { dir: 'drawable-land-mdpi', size: 480 },
  { dir: 'drawable-land-hdpi', size: 800 },
  { dir: 'drawable-land-xhdpi', size: 1280 },
  { dir: 'drawable-land-xxhdpi', size: 1600 },
  { dir: 'drawable-land-xxxhdpi', size: 1920 },
];

async function buildSvg(opts: {
  size: number;
  bg: 'white' | 'maroon' | null;
  cornerRadius: number;
  imageInsetPct: number;
}): Promise<string> {
  const buf = await fs.readFile(SRC_IMAGE);
  const b64 = buf.toString('base64');
  const inset = Math.round(opts.size * opts.imageInsetPct);
  const inner = opts.size - inset * 2;
  const fill = opts.bg === 'white' ? '#ffffff' : opts.bg === 'maroon' ? '#6b3410' : null;
  const bgRect =
    fill === null
      ? ''
      : `<rect width="${opts.size}" height="${opts.size}" rx="${opts.cornerRadius}" fill="${fill}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${opts.size} ${opts.size}">
  ${bgRect}
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
  const launcherSvg = await buildSvg({
    size: 1024,
    bg: 'white',
    cornerRadius: 96,
    imageInsetPct: 0.04,
  });
  // Adaptive foreground: transparent plate, deeper inset so the full
  // figure survives Android's circular/squircle clipping. The launcher
  // background drawable is white via @color/ic_launcher_background.
  const foregroundSvg = await buildSvg({
    size: 1024,
    bg: null,
    cornerRadius: 0,
    imageInsetPct: 0.16,
  });
  const splashSvg = await buildSvg({
    size: 1024,
    bg: 'maroon',
    cornerRadius: 0,
    imageInsetPct: 0.22,
  });

  for (const t of LAUNCHER_TARGETS) {
    await writePng(launcherSvg, t.size, path.join(ANDROID_RES, t.dir, 'ic_launcher.png'));
    await writePng(launcherSvg, t.size, path.join(ANDROID_RES, t.dir, 'ic_launcher_round.png'));
  }
  for (const t of FOREGROUND_TARGETS) {
    await writePng(foregroundSvg, t.size, path.join(ANDROID_RES, t.dir, 'ic_launcher_foreground.png'));
  }
  for (const t of SPLASH_TARGETS) {
    await writePng(splashSvg, t.size, path.join(ANDROID_RES, t.dir, 'splash.png'));
  }
  // eslint-disable-next-line no-console
  console.log('Wrote Android icons + splash screens (full figure on white).');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
