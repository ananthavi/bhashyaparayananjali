/**
 * iOS app-icon + splash generator. Capacitor 8's iOS template uses a
 * single 1024×1024 universal AppIcon and a 2732×2732 splash image
 * (sized for the largest iPad Pro and downscaled by the system for
 * everything smaller).
 *
 * Source is the same Acharya portrait used for Android / web. White
 * background, full figure with a small inset.
 */

import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';

const SRC_IMAGE = path.join(process.cwd(), 'assets', 'source', 'shankaracharya.jpg');
const ICONSET = path.join(
  process.cwd(),
  'ios',
  'App',
  'App',
  'Assets.xcassets',
  'AppIcon.appiconset',
);
const SPLASH = path.join(
  process.cwd(),
  'ios',
  'App',
  'App',
  'Assets.xcassets',
  'Splash.imageset',
);

async function makeSvg(opts: {
  size: number;
  bg: 'white' | 'maroon';
  imageInsetPct: number;
  cornerRadius?: number;
}): Promise<string> {
  const buf = await fs.readFile(SRC_IMAGE);
  const b64 = buf.toString('base64');
  const inset = Math.round(opts.size * opts.imageInsetPct);
  const inner = opts.size - inset * 2;
  const fill = opts.bg === 'white' ? '#ffffff' : '#6b3410';
  const r = opts.cornerRadius ?? 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${opts.size} ${opts.size}">
  <rect width="${opts.size}" height="${opts.size}" rx="${r}" fill="${fill}"/>
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
  const iconSvg = await makeSvg({ size: 1024, bg: 'white', imageInsetPct: 0.04 });
  // iOS doesn't apply its own corner clip to the AppIcon master — Apple
  // does that at render time. So we keep `cornerRadius: 0` and let the
  // OS produce the squircle.
  await writePng(iconSvg, 1024, path.join(ICONSET, 'AppIcon-512@2x.png'));
  // eslint-disable-next-line no-console
  console.log('wrote AppIcon-512@2x.png (1024×1024)');

  // Splash uses a maroon plate at full bleed; the figure floats centered
  // and at ~25% inset so it doesn't get cropped on tall iPhones.
  const splashSvg = await makeSvg({ size: 2732, bg: 'maroon', imageInsetPct: 0.28 });
  for (const name of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
    await writePng(splashSvg, 2732, path.join(SPLASH, name));
    // eslint-disable-next-line no-console
    console.log('wrote', name);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
