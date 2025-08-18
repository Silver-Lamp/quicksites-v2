// lib/favicon/optimizeFavicon.ts
import sharp from 'sharp';

function bufferToArrayBuffer(buf: Uint8Array): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

export async function optimizeFaviconUpload(file: File): Promise<Blob | null> {
  const buffer = await file.arrayBuffer();
  try {
    const resizedBuf = await sharp(Buffer.from(buffer))
      .resize(64, 64)
      .png()
      .toBuffer(); // Buffer (Uint8Array)

    // Convert to ArrayBuffer so TS is happy with BlobPart
    return new Blob([bufferToArrayBuffer(resizedBuf)], { type: 'image/png' });
  } catch (err) {
    console.error('Favicon optimization failed:', err);
    return null;
  }
}
