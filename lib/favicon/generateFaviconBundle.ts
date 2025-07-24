import sharp from 'sharp';

export async function generateFaviconBundle(file: File): Promise<{ ico: Blob; sizes: Record<string, Blob> } | null> {
  const buffer = await file.arrayBuffer();
  const base = sharp(Buffer.from(buffer));

  try {
    const sizes = [16, 32, 48, 64];
    const pngs: Buffer[] = [];

    const resized: Record<string, Blob> = {};
    for (const size of sizes) {
      const resizedBuf = await base.clone().resize(size, size).png().toBuffer();
      pngs.push(resizedBuf);
      resized[size] = new Blob([resizedBuf], { type: 'image/png' });
    }

    // const icoBuffer = await sharp({ create: { width: 64, height: 64, channels: 4, background: 'transparent' } })
    //   .composite([{ input: pngs[2] }])
    //   .resize(64, 64)
    //   .toFormat('ico')
    //   .toBuffer();

    return {
      // ico: new Blob([icoBuffer], { type: 'image/x-icon' }),
      ico: new Blob([pngs[2]], { type: 'image/png' }),
      sizes: resized,
    };
  } catch (err) {
    console.error('Error generating favicon bundle:', err);
    return null;
  }
}
