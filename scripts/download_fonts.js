const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://fonts.openmaptiles.org';
const FONTS_DIR = path.join(__dirname, '..', 'public', 'fonts');

const FONT_STACKS = [
  'Noto Sans Regular',
  'Noto Sans Bold'
];

// Ranges covering Latin + Cyrillic (for Ukrainian text)
const RANGES = [
  '0-255',
  '256-511',
  '1024-1279'
];

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(destPath)) {
      resolve();
      return;
    }

    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const file = fs.createWriteStream(destPath);

    const request = https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        fs.unlinkSync(destPath);
        downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        file.close();
        if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
        reject(new Error(`HTTP ${response.statusCode} for ${url}`));
        return;
      }

      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    });

    request.on('error', (err) => {
      if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
      reject(err);
    });

    file.on('error', (err) => {
      if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
      reject(err);
    });
  });
}

async function downloadFonts() {
  console.log('Downloading MapLibre fonts for offline use...');

  for (const font of FONT_STACKS) {
    const encodedFont = encodeURIComponent(font);
    const fontDir = path.join(FONTS_DIR, font);

    if (!fs.existsSync(fontDir)) {
      fs.mkdirSync(fontDir, { recursive: true });
    }

    for (const range of RANGES) {
      const url = `${BASE_URL}/${encodedFont}/${range}.pbf`;
      const destPath = path.join(fontDir, `${range}.pbf`);

      if (fs.existsSync(destPath)) {
        console.log(`  [skip] ${font}/${range}.pbf already exists`);
        continue;
      }

      try {
        console.log(`  Downloading ${font}/${range}.pbf...`);
        await downloadFile(url, destPath);
        console.log(`  [ok] ${font}/${range}.pbf`);
      } catch (err) {
        console.warn(`  [warn] Failed to download ${font}/${range}.pbf: ${err.message}`);
      }
    }
  }

  console.log('Font download complete.');
}

downloadFonts().catch((err) => {
  console.warn('Font download failed:', err.message);
  console.warn('Fonts will need to be downloaded manually for offline text rendering.');
});
