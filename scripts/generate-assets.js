#!/usr/bin/env node

const sharp = require('sharp');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, '..', 'assets');

// SVG for the hexagonal Signet logo (centered at origin, on a 40x40 conceptual viewBox)
// Outer hex: stroke outline, Inner hex: filled
function makeLogoSVG({ scale, offsetX, offsetY, strokeWidth = 2, innerOpacity = 0.9 }) {
  return `
    <g transform="translate(${offsetX},${offsetY}) scale(${scale})">
      <path d="M0 -16L13.86 -8V8L0 16L-13.86 8V-8Z" stroke="white" stroke-width="${strokeWidth}" fill="none"/>
      <path d="M0 -10L8.66 -5V5L0 10L-8.66 5V-5Z" fill="white" fill-opacity="${innerOpacity}"/>
    </g>
  `;
}

// 1. icon.png - 1024x1024, red gradient background, white hex logo
function iconSVG() {
  const size = 1024;
  const logo = makeLogoSVG({ scale: 14, offsetX: size / 2, offsetY: size / 2, strokeWidth: 2, innerOpacity: 0.9 });
  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#E31337"/>
      <stop offset="50%" stop-color="#FF2D50"/>
      <stop offset="100%" stop-color="#B80F2C"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#bg)"/>
  ${logo}
</svg>`;
}

// 2. splash-icon.png - 200x200, #1A1128 background, white hex logo
function splashIconSVG() {
  const size = 200;
  const logo = makeLogoSVG({ scale: 2.8, offsetX: size / 2, offsetY: size / 2, strokeWidth: 2.5, innerOpacity: 0.9 });
  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#1A1128"/>
  ${logo}
</svg>`;
}

// 3. favicon.png - 48x48, red gradient background, white hex logo
function faviconSVG() {
  const size = 48;
  const logo = makeLogoSVG({ scale: 0.65, offsetX: size / 2, offsetY: size / 2, strokeWidth: 3, innerOpacity: 0.95 });
  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#E31337"/>
      <stop offset="50%" stop-color="#FF2D50"/>
      <stop offset="100%" stop-color="#B80F2C"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#bg)"/>
  ${logo}
</svg>`;
}

// 4. android-icon-foreground.png - 512x512, transparent bg, white hex logo with safe zone padding
function androidForegroundSVG() {
  const size = 512;
  // Android adaptive icons use a 108dp grid with 72dp safe zone (66.7%)
  // Scale the logo to fit within the safe zone
  const logo = makeLogoSVG({ scale: 7, offsetX: size / 2, offsetY: size / 2, strokeWidth: 2, innerOpacity: 0.9 });
  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  ${logo}
</svg>`;
}

// 5. android-icon-background.png - 512x512, solid #E31337 red
function androidBackgroundSVG() {
  const size = 512;
  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#E31337"/>
</svg>`;
}

// 6. android-icon-monochrome.png - 512x512, transparent bg, white hex logo silhouette
function androidMonochromeSVG() {
  const size = 512;
  const logo = makeLogoSVG({ scale: 7, offsetX: size / 2, offsetY: size / 2, strokeWidth: 2, innerOpacity: 1.0 });
  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  ${logo}
</svg>`;
}

async function generateAsset(name, svgString) {
  const outputPath = path.join(ASSETS_DIR, name);
  await sharp(Buffer.from(svgString))
    .png()
    .toFile(outputPath);
  console.log(`  Generated: ${name}`);
}

async function main() {
  console.log('Generating Signet brand assets...\n');

  await generateAsset('icon.png', iconSVG());
  await generateAsset('splash-icon.png', splashIconSVG());
  await generateAsset('favicon.png', faviconSVG());
  await generateAsset('android-icon-foreground.png', androidForegroundSVG());
  await generateAsset('android-icon-background.png', androidBackgroundSVG());
  await generateAsset('android-icon-monochrome.png', androidMonochromeSVG());

  console.log('\nAll assets generated successfully!');
}

main().catch((err) => {
  console.error('Error generating assets:', err);
  process.exit(1);
});
