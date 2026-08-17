// app/api/og/[slug]/image/route.ts
//
// A social/preview image for one published site.
//
// ⚠️ THREE BUGS LIVED HERE AT ONCE, and only the first was visible. Found because the LemonYum
// page embeds this route to show a real stand, and the image rendered as a broken-image icon on
// lemonyum.com (2026-08-17).
//
//  1. IT LIED ABOUT THE FORMAT. The cache path was `snapshots/<slug>.svg` and every response was
//     stamped `Content-Type: image/svg+xml` from that filename. The cached object contained PNG
//     bytes. The browser trusted the header, tried to parse PNG as XML, and gave up. Every layer
//     looked healthy: HTTP 200, plausible type, 32KB of real bytes, no CORS, no CSP, byte-identical
//     across hosts. Only `file` and the first eight bytes could see it.
//
//  2. IT QUERIED A COLUMN THAT DOES NOT EXIST. `published_sites` has no `slug` — its columns are
//     id, domain, branding_profile_id, published_at, status, is_public, og_image_url, snapshot_id,
//     template_id. So `.eq('slug', slug)` errored on every request, the error was discarded
//     (`const { data: site }`), branding silently never loaded, and the title fell back to the raw
//     slug. A caller reading the code would reasonably believe branding worked.
//
//  3. ITS WRITE-BACK COULD NEVER MATCH. `update({ og_image_url }).eq('slug', slug)` on the same
//     table updated zero rows, forever, silently.
//
// The through-line is that all three failed quietly. Fixes below keep that from recurring by
// deriving facts from the thing itself: the content type from the BYTES (lib/og/imageContentType),
// and the row from `template_id` resolved through `templates.slug`, which is where a slug actually
// lives (CLAUDE.md §8: `templates` is the live content model).

import { renderOgImage } from '@/lib/og/renderOgImage';
import { createClient } from '@supabase/supabase-js';
import { sniffImageContentType, extensionForContentType } from '@/lib/og/imageContentType';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const BUCKET = 'og-cache';

/** Cache-Control shared by every success path, so a fix to one does not skew the others. */
const CACHE = 'public, max-age=86400';

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!slug) return new Response('Missing slug', { status: 400 });

  // ── Cached? Serve it, but TYPE IT FROM ITS BYTES ────────────────────────────────────────────
  //
  // Both extensions are checked because the poisoned `.svg` objects already exist in the bucket
  // and are perfectly good PNGs — they just need to be described honestly. Deleting them would
  // also work and would throw away a valid image to fix a header.
  for (const ext of ['svg', 'png'] as const) {
    const { data: cached } = await supabase.storage.from(BUCKET).download(`snapshots/${slug}.${ext}`);
    if (!cached) continue;

    const buf = new Uint8Array(await cached.arrayBuffer());
    const sniffed = sniffImageContentType(buf);
    if (!sniffed) {
      // Unrecognised bytes: fall through and re-render rather than assert a type. Guessing here
      // is the original bug.
      break;
    }
    return new Response(buf, { headers: { 'Content-Type': sniffed, 'Cache-Control': CACHE } });
  }

  // ── Resolve the site. The slug lives on `templates`, not on `published_sites`. ───────────────
  const { data: tpl } = await supabase.from('templates').select('id').eq('slug', slug).maybeSingle();

  let branding: any = null;
  if (tpl?.id) {
    const { data: site } = await supabase
      .from('published_sites')
      .select('template_id, branding_profiles(name, theme, brand, logo_url)')
      .eq('template_id', (tpl as any).id)
      .maybeSingle();
    branding = (site as any)?.branding_profiles ?? null;
  }

  const rendered = await renderOgImage({
    title: branding?.name || slug,
    content: `${slug}.quicksites.ai`,
    theme: branding?.theme || 'dark',
    brand: branding?.brand || 'green',
    logo_url: branding?.logo_url,
  });

  // ⚠️ Read the renderer as BYTES, not text. `await res.text()` on a PNG mangles it — which is a
  // plausible origin for the poisoned cache, since the old code did exactly that and then wrote
  // the result as an `.svg`.
  const bytes = new Uint8Array(await rendered.arrayBuffer());
  const contentType = sniffImageContentType(bytes) ?? rendered.headers.get('content-type') ?? 'application/octet-stream';
  const path = `snapshots/${slug}.${extensionForContentType(contentType)}`;

  // Best-effort cache + write-back. Neither may block the image: a visitor asking for a picture
  // should get one even when storage or the DB is unhappy.
  try {
    await supabase.storage.from(BUCKET).upload(path, bytes, { contentType, upsert: true });
    if (tpl?.id) {
      const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
      await supabase.from('published_sites').update({ og_image_url: publicUrl }).eq('template_id', (tpl as any).id);
    }
  } catch {
    /* the image is already rendered; caching is a bonus */
  }

  return new Response(bytes, { headers: { 'Content-Type': contentType, 'Cache-Control': CACHE } });
}
