import sharp from 'sharp';

export async function optimizeFaviconUpload(file: File): Promise<Blob | null> {
  const buffer = await file.arrayBuffer();
  try {
    const resized = await sharp(Buffer.from(buffer))
      .resize(64, 64)
      .png()
      .toBuffer();
    return new Blob([resized], { type: 'image/png' });
  } catch (err) {
    console.error('Favicon optimization failed:', err);
    return null;
  }
}
