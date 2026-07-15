// scripts/backfill-media-assets.ts
//
// Seed the media_assets registry from images already baked into existing
// templates. Hero images have always been fire-and-forget (URL saved only inside
// the block JSON), so the library would otherwise start empty. This walks each
// template's data blob for hero/image URLs and records them with the template's
// org_id / owner_id / industry.
//
//   npm run backfill:media            # dry run — scan + report, writes nothing
//   npm run backfill:media -- --apply # actually upsert into media_assets
//   npm run backfill:media -- --apply --limit 500
//
// Idempotent: upserts on `url` with ignoreDuplicates, so re-running never dupes.

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

// supabase-js pulls in realtime, which needs a WebSocket global on Node < 22.
if (typeof (globalThis as any).WebSocket === 'undefined') {
  try {
    // @ts-expect-error - `ws` ships no bundled types; runtime-only polyfill for Node 20
    const ws = (await import('ws')).default;
    (globalThis as any).WebSocket = ws;
  } catch {
    /* ignore */
  }
}

import { createClient } from '@supabase/supabase-js';
import { resolveIndustryKey } from '@/lib/industries';

const PAGE = 200;
// Map known image-bearing keys → asset kind. More specific kinds (logo/favicon)
// win over hero when the same URL is somehow reached via multiple keys.
const KEY_KIND: Record<string, 'hero' | 'logo' | 'favicon'> = {
  image_url: 'hero',
  heroimage: 'hero',
  backgroundimage: 'hero',
  image: 'hero',
  logo_url: 'logo',
  logourl: 'logo',
  favicon_url: 'favicon',
  faviconurl: 'favicon',
};
const KIND_RANK: Record<string, number> = { hero: 0, favicon: 1, logo: 2 };

/** Recursively collect http(s) image URLs mapped to their asset kind. */
function collectImageUrls(node: any, out: Map<string, 'hero' | 'logo' | 'favicon'>) {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const v of node) collectImageUrls(v, out);
    return;
  }
  if (typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      const kind = KEY_KIND[k.toLowerCase()];
      if (typeof v === 'string' && kind && /^https?:\/\//i.test(v)) {
        const prev = out.get(v);
        if (!prev || KIND_RANK[kind] > KIND_RANK[prev]) out.set(v, kind);
      } else if (v && typeof v === 'object') {
        collectImageUrls(v, out);
      }
    }
  }
}

async function main() {
  const apply = process.argv.includes('--apply');
  const limitArg = process.argv.indexOf('--limit');
  const limit = limitArg >= 0 ? Math.max(0, parseInt(process.argv[limitArg + 1] || '0', 10)) : 0;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in env.');
    process.exit(1);
  }
  const db = createClient(url, key, { auth: { persistSession: false } });

  console.log(`\n▶ Backfilling media_assets from templates (${apply ? 'APPLY' : 'DRY RUN'}${limit ? `, limit ${limit}` : ''})…\n`);

  const stats = { templates: 0, images: 0, inserted: 0, errors: 0 };
  let cursor: string | null = null;

  for (;;) {
    if (limit && stats.inserted >= limit) break;

    let q = db
      .from('templates')
      .select('id, org_id, owner_id, industry, data')
      .order('id', { ascending: true })
      .limit(PAGE);
    if (cursor) q = q.gt('id', cursor);

    const { data: rows, error } = await q;
    if (error) { console.error('❌ template query failed:', error.message); process.exit(1); }
    if (!rows || rows.length === 0) break;
    cursor = (rows[rows.length - 1] as any).id;

    for (const t of rows as any[]) {
      stats.templates++;
      const urls = new Map<string, 'hero' | 'logo' | 'favicon'>();
      // meta.logo_url / meta.favicon_url are the canonical branding fields; the
      // recursive walk below also catches block-content copies.
      collectImageUrls(t.data, urls);
      if (urls.size === 0) continue;

      const rawIndustry = t.industry ?? t?.data?.meta?.identity?.industry ?? t?.data?.meta?.industry ?? null;
      const industry = rawIndustry ? resolveIndustryKey(rawIndustry) : null;

      const rowsToInsert = [...urls.entries()].map(([u, kind]) => ({
        template_id: t.id,
        org_id: t.org_id ?? null,
        owner_id: t.owner_id ?? null,
        industry,
        url: u,
        kind,
        source: 'uploaded', // origin unknown for pre-existing images
      }));
      stats.images += rowsToInsert.length;

      if (apply) {
        const { error: upErr, count } = await db
          .from('media_assets')
          .upsert(rowsToInsert, { onConflict: 'url', ignoreDuplicates: true, count: 'exact' });
        if (upErr) { stats.errors++; console.error(`  ⚠ ${t.id}: ${upErr.message}`); }
        else stats.inserted += count ?? 0;
      }
    }
  }

  console.log(
    `\n✅ Done. templates scanned=${stats.templates}, image URLs found=${stats.images}, ` +
      `inserted=${apply ? stats.inserted : '(dry run)'}, errors=${stats.errors}\n`
  );
  if (!apply) console.log('Re-run with `-- --apply` to write.\n');
}

main().catch((e) => { console.error(e); process.exit(1); });
