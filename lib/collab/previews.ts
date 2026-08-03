// lib/collab/previews.ts
//
// The stored screenshot for each layout in a collab, so the client can compare three options at a
// glance instead of opening three tabs. Captured by scripts/capture-collab-previews.ts.
//
// ⚠️ IT LISTS THE BUCKET RATHER THAN GUESSING URLS, AND THAT IS THE POINT. A URL built from a slug
// always exists as a string, so a missing capture becomes a broken image on a client's page —
// silently, and only for the option nobody re-captured. Listing tells us which ones are actually
// there, so an option with no preview renders as a plain card (correct) rather than a grey box
// with a torn-page icon (looks like our software is broken).
//
// ⚠️ IT RETURNS `capturedAt`, AND THE PAGE MUST SHOW IT. A screenshot is a claim about how a site
// looked at one moment; a variant edited after its capture will show the client something that is
// no longer true. Undated, that is indistinguishable from current. Dated, it is a stale photo —
// which anyone can reason about. Same rule as menu prices: date it or don't assert it.

import { createClient } from '@supabase/supabase-js';

const BUCKET = 'previews';
const FOLDER = 'collab';

export type Preview = { url: string; capturedAt: string | null };

/**
 * Map of slug → preview, for the slugs asked about. Slugs with no stored capture are simply
 * absent from the map; callers must handle that, not assume a URL.
 */
export async function getCollabPreviews(slugs: string[]): Promise<Record<string, Preview>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key || !slugs.length) return {};

  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await db.storage.from(BUCKET).list(FOLDER, { limit: 1000 });
  if (error || !data) return {};

  const wanted = new Set(slugs);
  const out: Record<string, Preview> = {};
  for (const file of data) {
    const slug = file.name.replace(/\.png$/i, '');
    if (!wanted.has(slug)) continue;
    const capturedAt = (file as any).updated_at ?? (file as any).created_at ?? null;
    const { data: pub } = db.storage.from(BUCKET).getPublicUrl(`${FOLDER}/${file.name}`);
    // Re-captures overwrite in place, so the URL is stable — which also means a CDN would keep
    // serving the old image. The capture time is the version.
    const v = capturedAt ? `?v=${encodeURIComponent(capturedAt)}` : '';
    out[slug] = { url: `${pub.publicUrl}${v}`, capturedAt };
  }
  return out;
}
