/**
 * Removes black background from badge PNGs by making near-black pixels transparent.
 * Run: npm run badges:remove-black-bg
 * When adding new badges with black backgrounds, add the filename to BADGE_FILES below.
 */

import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BADGES_DIR = path.join(__dirname, '..', 'assets', 'badges');

const BADGE_FILES = [
  'grand-slam-legend.png',
  '40-club.png',
  '50-club.png',
  'trophy-hunter.png',
  'champion-of-the-water.png',
  'century-angler.png',
  'species-collector.png',
  'hall-of-fame.png',
  'viral-catch.png',
  'crowd-favorite.png',
];

/** Pixels darker than this (per channel) become transparent. 0–255. */
const BLACK_THRESHOLD = 35;

async function removeBlackBg(fileName) {
  const inputPath = path.join(BADGES_DIR, fileName);
  const tempPath = path.join(BADGES_DIR, fileName.replace('.png', '.tmp.png'));

  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  for (let i = 0; i < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r <= BLACK_THRESHOLD && g <= BLACK_THRESHOLD && b <= BLACK_THRESHOLD) {
      data[i + 3] = 0;
    }
  }

  await sharp(data, {
    raw: { width, height, channels: 4 },
  })
    .png()
    .toFile(tempPath);

  fs.renameSync(tempPath, inputPath);
  console.log('  ✓', fileName);
}

async function main() {
  console.log('Removing black background from badges...\n');
  for (const file of BADGE_FILES) {
    try {
      await removeBlackBg(file);
    } catch (err) {
      console.error('  ✗', file, err.message);
    }
  }
  console.log('\nDone. Badges now have transparent backgrounds.');
}

main();
