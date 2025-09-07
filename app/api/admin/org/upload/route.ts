// app/api/admin/org/upload/route.ts
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { supabaseAdmin } from '@/lib/server/supabaseAdmin';

const BUCKET = (process.env.NEXT_PUBLIC_ORG_ASSETS_BUCKET || '').trim() || 'logos';

// 5MB after transform; incoming body size is controlled via next.config (serverActions.bodySizeLimit).
const MAX_OUT_BYTES = 5 * 1024 * 1024;

function j(data: any, init?: number | ResponseInit) {
  const resInit = typeof init === 'number' ? { status: init } : init;
  return NextResponse.json(data, resInit);
}

const ALLOWED_IN = new Set([
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

// Decode anything else with sharp (incl. HEIC/HEIF if libvips supports it)
const input = Buffer.from(await file.arrayBuffer());
const maxWidth = tag === 'favicon' ? 256 : 1024;

// ✅ sharp v0.32/0.33+ compatible options:
//   - 'failOn' expects a string ('none' | 'truncated' | 'error' | 'warning')
//   - 'failOnError' is ignored by newer sharp, but harmless as fallback
const sharpOpts: any = { failOn: 'none', failOnError: false };

// auto-orient
let img = sharp(input, sharpOpts).rotate();

const meta = await img.metadata();
if ((meta.width ?? 0) > maxWidth) {
  img = img.resize({ width: maxWidth, withoutEnlargement: true });
}

  if (tag === 'favicon') {
    const buffer = await img.png({ compressionLevel: 9 }).toBuffer();
    return { buffer, contentType: 'image/png', ext: 'png' };
  } else {
    // default: webp
    const buffer = await img.webp({ quality: 82, effort: 4 }).toBuffer();
    return { buffer, contentType: 'image/webp', ext: 'webp' };
  }
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    const org_id = String(form.get('org_id') || '').trim();
    const org_slug = String(form.get('org_slug') || '').trim();
    const tag = String(form.get('tag') || 'logo').trim();

    if (!file) return j({ error: 'file required' }, 400);
    if (!org_id || !org_slug) return j({ error: 'org_id and org_slug required' }, 400);

    const inType = file.type || 'application/octet-stream';
    if (!ALLOWED_IN.has(inType)) {
      return j({ error: `unsupported type: ${inType}` }, 415);
    }

    // Transform
    const { buffer, contentType, ext } = await processImage(file, tag);
    if (buffer.byteLength > MAX_OUT_BYTES) {
      return j({ error: 'output too large after processing (>5MB). Try a smaller image.' }, 413);
    }

    const key = `orgs/${org_id}/${org_slug}-${tag}-${Date.now()}.${ext}`;

    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(key, buffer, {
        contentType,
        cacheControl: '86400',
        upsert: true,
      });

    if (error) return j({ error: error.message }, 500);

    // Prefer signed URL (private bucket). Fall back to public if bucket is public.
    let url: string | null = null;
    try {
      const { data: signed } = await supabaseAdmin.storage
        .from(BUCKET)
        .createSignedUrl(data.path, 60 * 60 * 24 * 365); // 1 year
      url = signed?.signedUrl ?? null;
    } catch {}
    if (!url) {
      const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(data.path);
      url = pub.publicUrl;
    }

    return j({
      ok: true,
      url,
      path: data.path,
      contentType,
      bytes: buffer.byteLength,
      originalType: inType,
    });
  } catch (e: any) {
    return j({ error: e?.message || 'upload failed' }, 500);
  }
}
