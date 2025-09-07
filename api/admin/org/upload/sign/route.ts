// app/api/admin/org/upload/sign/route.ts
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server/supabaseAdmin';

const BUCKET =
  (process.env.NEXT_PUBLIC_ORG_ASSETS_BUCKET || '').trim() || 'org-assets';

function j(data: any, init?: number | ResponseInit) {
  const resInit = typeof init === 'number' ? { status: init } : init;
  return NextResponse.json(data, resInit);
}

/**
 * Try to derive the storage object "key" inside the bucket from a full URL.
 * Works with both public URLs:
 *   .../storage/v1/object/public/<bucket>/<key>
 * and signed URLs:
 *   .../storage/v1/object/sign/<bucket>/<key>?token=...
 */
function deriveKeyFromUrl(bucket: string, url: string): string | null {
  try {
    const u = new URL(url);
    // Split + decode to be safe with %2F
    const parts = u.pathname.split('/').map(decodeURIComponent);
    const i = parts.findIndex((p) => p === bucket);
    if (i >= 0 && i + 1 < parts.length) {
      // everything after the bucket is the object key
      return parts.slice(i + 1).join('/').replace(/^\/+/, '');
    }
    return null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const bucket = (url.searchParams.get('bucket') || BUCKET).trim();
    const expires = Math.max(
      60, // min 1 minute
      Math.min(60 * 60 * 24 * 366, Number(url.searchParams.get('expires') || 60 * 60 * 24 * 30)) // default 30d
    );

    // Accept either ?path=orgs/<id>/file.png OR ?url=<full supabase url>
    const pathParam = (url.searchParams.get('path') || '').trim();
    const urlParam = (url.searchParams.get('url') || '').trim();

    let key = pathParam || '';
    if (!key && urlParam) {
      const derived = deriveKeyFromUrl(bucket, urlParam);
      if (derived) key = derived;
    }

    if (!key) {
      return j(
        { error: 'Provide ?path=orgs/<id>/file or ?url=<supabase-storage-url>' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUrl(key, expires);

    if (error) return j({ error: error.message }, { status: 500 });

    return j({
      ok: true,
      bucket,
      key,
      url: data?.signedUrl || null,
      expires,
    });
  } catch (e: any) {
    return j({ error: e?.message || 'sign failed' }, { status: 500 });
  }
}
