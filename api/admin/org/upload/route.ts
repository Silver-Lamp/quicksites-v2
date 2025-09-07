// app/api/admin/org/upload/route.ts
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

const BUCKET =
  (process.env.NEXT_PUBLIC_ORG_ASSETS_BUCKET || '').trim() || 'org-assets';

function j(data: any, init?: number | ResponseInit) {
  const resInit = typeof init === 'number' ? { status: init } : init;
  return NextResponse.json(data, resInit);
}

const ALLOWED = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
  'image/x-icon',
]);
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

function extFor(mime: string, filename?: string) {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/svg+xml') return 'svg';
  if (mime === 'image/x-icon') return 'ico';
  const fallback = filename?.split('.').pop()?.toLowerCase();
  return fallback || 'png';
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

    const type = file.type || 'application/octet-stream';
    const size = file.size ?? 0;
    if (!ALLOWED.has(type)) return j({ error: `unsupported type: ${type}` }, 415);
    if (size > MAX_BYTES) return j({ error: 'file too large (max 5MB)' }, 413);

    const ext = extFor(type, (file as any)?.name);
    const key = `orgs/${org_id}/${org_slug}-${tag}-${Date.now()}.${ext}`;

    const ab = await file.arrayBuffer();
    const buf = Buffer.from(ab);

    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(key, buf, {
        contentType: type,
        upsert: true,
        cacheControl: '3600',
      });

    if (error) return j({ error: error.message }, 500);

    // Prefer signed URL (private bucket); fall back to public if bucket is public
    let url: string | null = null;
    try {
      const { data: signed } = await supabaseAdmin.storage
        .from(BUCKET)
        .createSignedUrl(data.path, 60 * 60 * 24 * 365); // 1 year
      url = signed?.signedUrl ?? null;
    } catch {
      // ignore
    }
    if (!url) {
      const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(data.path);
      url = pub.publicUrl;
    }

    return j({ ok: true, path: data.path, url, contentType: type, bytes: size });
  } catch (e: any) {
    return j({ error: e?.message || 'upload failed' }, 500);
  }
}
