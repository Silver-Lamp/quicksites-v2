import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

const inputDir = './public/screenshots';

async function generateThumbnails() {
  const files = await fs.readdir(inputDir);
  const pngs = files.filter(
    (f) => f.endsWith('.png') && !f.endsWith('.thumb.png')
  );

  for (const file of pngs) {
    const inputPath = path.join(inputDir, file);
    const thumbPath = inputPath.replace('.png', '.thumb.png');

    await sharp(inputPath).resize(300, 180, { fit: 'cover' }).toFile(thumbPath);

    console.log(`Generated thumbnail: ${thumbPath}`);
  }
}

generateThumbnails();
