// lib/outreach/lobSafeImage.ts
//
// Lob prints PNG and JPEG. Nothing else.
//
// ⚠️ The sender headshot was a WebP (the upload field accepts image/webp and image/avif, and the
// browser uploads the bytes as-is), so every postcard proof showed a broken-image circle where
// the operator's face belongs — on the one surface we cannot correct after it prints. Lob's own
// creative-formatting page lists exactly two raster formats (PNG, JPEG) and says a URL it cannot
// render fails the piece. Neither the picker nor the profile save checked the format; the card
// renderer emitted whatever URL it was handed.
//
// Two guards, both needed: the profile SAVE converts anything else to PNG in storage and stores the
// PNG's URL (so the fix is durable and the preview shows what prints), and the card RENDER refuses
// a URL that is not PNG/JPEG (so a stale profile, an env fallback, or a library pick can never put a
// broken image on paper — a missing face beats a broken icon).
import { createHash } from 'node:crypto';

/** A URL Lob can render: .png / .jpg / .jpeg (query string allowed), or a PNG/JPEG data URL. */
export function isLobSafeImageUrl(url: string | null | undefined): boolean {
  const s = String(url ?? '').trim();
  if (!s) return false;
  if (/^data:image\/(png|jpe?g);base64,/i.test(s)) return true;
  if (!/^https?:\/\//i.test(s)) return false; // relative or file: — Lob fetches from its own servers
  return /\.(png|jpe?g)(\?[^#]*)?(#.*)?$/i.test(s);
}

/** Deterministic storage path for the PNG copy of a source URL, so re-saving overwrites in place. */
export function lobSafeCopyPath(sourceUrl: string, kind: string): string {
  const hash = createHash('sha1').update(sourceUrl).digest('hex').slice(0, 16);
  return `sender-profile/lob/${kind}/${hash}.png`;
}

export type EnsureResult = { url: string; converted: boolean };

/**
 * Return a URL Lob can render for `url`: the same URL when it already is, else a PNG copy uploaded
 * to storage (upsert, deterministic path). Throws with a plain-English reason on failure — the
 * caller is the profile save, and a save that silently kept a WebP would recreate the bug.
 */
export async function ensureLobSafeImageUrl(url: string, kind: 'headshot' | 'signature'): Promise<EnsureResult> {
  const s = String(url ?? '').trim();
  if (isLobSafeImageUrl(s)) return { url: s, converted: false };
  if (!/^https?:\/\//i.test(s)) throw new Error(`The ${kind} must be an absolute https URL — Lob fetches it from its own servers.`);

  const res = await fetch(s, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Could not fetch the ${kind} to convert it (${res.status}).`);
  const input = Buffer.from(await res.arrayBuffer());

  const sharp = (await import('sharp')).default;
  let png: Buffer;
  try {
    png = await sharp(input).png().toBuffer();
  } catch (e: any) {
    throw new Error(`The ${kind} is not an image Lob can print and could not be converted to PNG: ${e?.message || 'decode failed'}.`);
  }

  const { supabaseAdmin } = await import('@/lib/supabase/admin');
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'templates';
  const path = lobSafeCopyPath(s, kind);
  const { error } = await supabaseAdmin.storage.from(bucket).upload(path, png, { contentType: 'image/png', upsert: true });
  if (error) throw new Error(`Could not store the PNG copy of the ${kind}: ${error.message}`);
  const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
  if (!data?.publicUrl) throw new Error(`Stored the PNG copy of the ${kind} but got no public URL back.`);
  return { url: data.publicUrl, converted: true };
}
