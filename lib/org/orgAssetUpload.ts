// lib/org/orgAssetUpload.ts
//
// Org logo / favicon upload: decode, bound, transcode, store. Shared by the platform-admin
// route (app/api/admin/org/upload) and the partner self-serve route (app/api/partners/brand/logo)
// so both produce identical assets in the same bucket under the same key shape.
import sharp from 'sharp';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const ORG_ASSETS_BUCKET = (process.env.NEXT_PUBLIC_ORG_ASSETS_BUCKET || '').trim() || 'logos';

// 5MB after transform; incoming body size is controlled via next.config (serverActions.bodySizeLimit).
const MAX_OUT_BYTES = 5 * 1024 * 1024;

export const ALLOWED_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
  'image/x-icon',
  'image/heic',
  'image/heif',
]);

function extFor(mime: string, filename?: string) {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/svg+xml') return 'svg';
  if (mime === 'image/x-icon') return 'ico';
  if (mime === 'image/heic' || mime === 'image/heif') return 'heic';
  return (filename?.split('.').pop() || 'png').toLowerCase();
}

async function processImage(file: File, tag: string) {
  const type = file.type || 'application/octet-stream';
  // Pass-through for vector/ico
  if (type === 'image/svg+xml' || type === 'image/x-icon') {
    const buf = Buffer.from(await file.arrayBuffer());
    return { buffer: buf, contentType: type, ext: extFor(type, (file as any)?.name) };
  }
  const input = Buffer.from(await file.arrayBuffer());
  const maxWidth = tag === 'favicon' ? 256 : 1024;
  // sharp v0.32/0.33+: 'failOn' is a string; 'failOnError' is ignored by newer sharp (harmless).
  const sharpOpts: any = { failOn: 'none', failOnError: false };
  let img = sharp(input, sharpOpts).rotate();
  const meta = await img.metadata();
  if ((meta.width ?? 0) > maxWidth) img = img.resize({ width: maxWidth, withoutEnlargement: true });
  if (tag === 'favicon') {
    const buffer = await img.png({ compressionLevel: 9 }).toBuffer();
    return { buffer, contentType: 'image/png', ext: 'png' };
  }
  const buffer = await img.webp({ quality: 82, effort: 4 }).toBuffer();
  return { buffer, contentType: 'image/webp', ext: 'webp' };
}

export type OrgAssetResult = { url: string; path: string; contentType: string; bytes: number };

/**
 * Store one org asset. Throws with a user-readable message on an unsupported type or an
 * oversized result; the caller maps that to a 4xx.
 */
export async function uploadOrgAsset(file: File, opts: { orgId: string; orgSlug: string; tag: string }): Promise<OrgAssetResult> {
  const inType = file.type || 'application/octet-stream';
  if (!ALLOWED_IMAGE_TYPES.has(inType)) throw new Error(`unsupported type: ${inType}`);
  const { buffer, contentType, ext } = await processImage(file, opts.tag);
  if (buffer.byteLength > MAX_OUT_BYTES) throw new Error('output too large after processing (>5MB). Try a smaller image.');

  const key = `orgs/${opts.orgId}/${opts.orgSlug}-${opts.tag}-${Date.now()}.${ext}`;
  const { data, error } = await supabaseAdmin.storage
    .from(ORG_ASSETS_BUCKET)
    .upload(key, buffer, { contentType, cacheControl: '86400', upsert: true });
  if (error) throw new Error(error.message);

  // Prefer a signed URL (private bucket); fall back to public if the bucket is public.
  let url: string | null = null;
  try {
    const { data: signed } = await supabaseAdmin.storage.from(ORG_ASSETS_BUCKET).createSignedUrl(data.path, 60 * 60 * 24 * 365);
    url = signed?.signedUrl ?? null;
  } catch {
    /* fall through */
  }
  if (!url) url = supabaseAdmin.storage.from(ORG_ASSETS_BUCKET).getPublicUrl(data.path).data.publicUrl;
  return { url, path: data.path, contentType, bytes: buffer.byteLength };
}
