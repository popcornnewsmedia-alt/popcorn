import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';

// The favicon SVG uses viewBox="10 14 80 80" over a 100×100 artboard with a
// rounded-corner clip path. For the iOS app icon we want:
//   • Solid 1024×1024 (iOS rounds corners itself — no transparency)
//   • RGB, no alpha channel (iOS requires this)
//   • Content scaled identically to the favicon

const SRC  = '/Users/bharatarora/Desktop/Popcorn/artifacts/pulse-news/public/favicon.svg';
const DEST = '/Users/bharatarora/Desktop/Popcorn/artifacts/pulse-news/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png';

const svg = await readFile(SRC, 'utf8');

// Render at a higher internal resolution (2048px), then downsample to 1024 to
// keep edges clean on the large puff circles.
const png = await sharp(Buffer.from(svg), { density: 600 })
  .resize(1024, 1024, { fit: 'cover' })
  .flatten({ background: '#053980' }) // strip alpha, use splash dark-blue as bg
  .png({ compressionLevel: 9 })
  .toBuffer();

await writeFile(DEST, png);
console.log(`Wrote ${DEST} (${png.length} bytes)`);
