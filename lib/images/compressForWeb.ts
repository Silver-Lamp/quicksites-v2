// lib/images/compressForWeb.ts
//
// ⚠️ gpt-image-1 ALWAYS RETURNS PNG, AND A PAINTING IS THE WORST CASE FOR PNG.
//
// PNG is lossless and built for flat colour and sharp edges. A painterly image is the opposite:
// every pixel differs slightly from its neighbour, so there is nothing to compress and the file
// stays enormous. The first painted hero measured **2,447 KB** at 1536×1024 — for the top of a
// page whose whole purpose is a customer standing outside on a phone, on cellular, deciding
// whether to buy a $3 lemonade. The image loading slowly is the product failing.
//
// This is the same lesson already recorded once for the 404 page (2054 KB → 35 KB): the fix is
// to CONVERT, not to rename. Writing `.webp` on PNG bytes changes the filename and nothing else,
// and it is a convincing fix precisely because the URL then looks right.
//
// Two instruments, because they answer different questions:
//   • the eye tells you whether the picture is right
//   • `file` (or the byte count) tells you what the format actually is
// Neither substitutes for the other. An image can look perfect and still be a 2.4 MB PNG.

import sharp from 'sharp';

export type CompressedImage = {
  buffer: Buffer;
  contentType: string;
  /** File extension WITHOUT the dot — the caller builds the storage path from this. */
  ext: string;
  bytes: number;
};

/**
 * Convert a generated PNG to web-weight WebP.
 *
 * WebP over JPEG because these are paintings: smooth gradients band visibly under JPEG's
 * chroma subsampling, and WebP holds them at a smaller size. Universal support since 2020.
 *
 * Falls back to the original bytes on any failure — a heavy hero is worse than a light one and
 * far better than no hero (rule 7: never make the page worse).
 */
export async function compressForWeb(png: Buffer, opts: { quality?: number } = {}): Promise<CompressedImage> {
  const quality = opts.quality ?? 82;
  try {
    const buffer = await sharp(png).webp({ quality, effort: 4 }).toBuffer();
    // A "compression" that grew the file is not one. Keep whichever is actually smaller.
    if (buffer.length >= png.length) {
      return { buffer: png, contentType: 'image/png', ext: 'png', bytes: png.length };
    }
    return { buffer, contentType: 'image/webp', ext: 'webp', bytes: buffer.length };
  } catch {
    return { buffer: png, contentType: 'image/png', ext: 'png', bytes: png.length };
  }
}
