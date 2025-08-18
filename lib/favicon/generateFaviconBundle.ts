// lib/favicon/generateFaviconBundle.ts
import sharp from 'sharp';

/** Convert Node.js Buffer (Uint8Array<ArrayBufferLike>) -> ArrayBuffer (DOM-friendly) */
function bufferToArrayBuffer(buf: Uint8Array): ArrayBuffer {
  // Ensure we pass a slice that points only to the bytes we need
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

export async function generateFaviconBundle(
  file: File
): Promise<{ ico: Blob; sizes: Record<string, Blob> } | null> {
  const buffer = await file.arrayBuffer();
  const base = sharp(Buffer.from(buffer));

  try {
    const sizes = [16, 32, 48, 64] as const;

    const resized: Record<string, Blob> = {};
    const pngs: Uint8Array[] = [];

    for (const size of sizes) {
      const resizedBuf = await base.clone().resize(size, size).png().toBuffer(); // Buffer
      pngs.push(resizedBuf);
      // Convert Buffer -> ArrayBuffer to satisfy BlobPart typing
      resized[String(size)] = new Blob([bufferToArrayBuffer(resizedBuf)], {
        type: 'image/png',
      });
    }

    // If you later switch to real .ico generation, convert and wrap similarly:
    // const icoBuffer = await sharp(pngs[2]).toFormat('ico').toBuffer();
    // const ico = new Blob([bufferToArrayBuffer(icoBuffer)], { type: 'image/x-icon' });

    return {
      // For now we return PNG as "ico" placeholder
      ico: new Blob([bufferToArrayBuffer(pngs[2])], { type: 'image/png' }),
      sizes: resized,
    };
  } catch (err) {
    console.error('Error generating favicon bundle:', err);
    return null;
  }
}
