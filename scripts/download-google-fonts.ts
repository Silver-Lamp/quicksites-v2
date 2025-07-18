// scripts/download-google-fonts.ts
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { mkdirp } from 'mkdirp';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question: string): Promise<string> {
  return new Promise((res) => rl.question(question, res));
}

async function main() {
  console.log('🧩 Google Fonts Downloader');
  const fontName = await ask('Enter font name (e.g. Inter, Roboto Slab): ');
  const weights = await ask('Enter weights (comma-separated, e.g. 400,700): ');
  const weightArray = weights.split(',').map((w) => w.trim());

  const familyParam = fontName.replace(/ /g, '+') + ':wght@' + weightArray.join(';');
  const cssUrl = `https://fonts.googleapis.com/css2?family=${familyParam}&display=swap`;

  console.log(`🎯 Fetching CSS from: ${cssUrl}`);
  const css = await fetch(cssUrl).then((res) => res.text());

  const publicFontsDir = path.resolve(process.cwd(), 'public/fonts');
  mkdirp.sync(publicFontsDir);

  const matches = Array.from(css.matchAll(/url\((https:\/\/[^)]+\.woff2)\).*?font-weight:\s*(\d+)/g));
  const fontFaces: string[] = [];

  for (const [, woff2Url, weight] of matches) {
    const safeName = fontName.replace(/ /g, '');
    const filename = `${safeName}-${weight}.woff2`;
    const filepath = path.join(publicFontsDir, filename);

    console.log(`⬇️  Downloading ${filename}...`);
    const buffer = await fetch(woff2Url).then((res) => res.buffer());
    fs.writeFileSync(filepath, buffer);

    const face = `@font-face {
  font-family: '${fontName}';
  font-weight: ${weight};
  font-display: swap;
  src: url('/fonts/${filename}') format('woff2');
}`;
    fontFaces.push(face);
  }

  const cssOutputPath = path.resolve(process.cwd(), 'styles/fonts.css');
  fs.writeFileSync(cssOutputPath, fontFaces.join('\n\n'));
  console.log(`✅ Font files in /public/fonts/, CSS in /styles/fonts.css`);
  rl.close();
}

main();
