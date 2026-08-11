// app/api/sites/[id]/export/route.ts
//
// "Download my site" — one self-contained HTML file the owner keeps.
//
// ⚠️ THIS IS THE ANSWER TO THE QUESTION A COLD PROSPECT IS ACTUALLY ASKING. Not "how experienced
// are you" but "what happens to my site if you disappear". A credential answers that badly; a
// download button answers it in a way that survives us being small, new, and one person. It is
// also the only honest response to the lock-in that "free" makes people hunt for — the catch they
// are looking for IS lock-in, and the way to disprove it is to remove it, not to promise.
//
// ⚠️ AND IT HAD TO STOP BEING A PROMISE THAT RAN THROUGH US. The capability already existed as
// `scripts/export-site.ts`, so "you can host it anywhere" was true in the sense that an operator
// would do it for you. That is the same shape as the lock-in it was meant to disprove. A button
// they press without asking is a fact; an offer to email a zip is a dependency with good manners.
//
// Serverless, so no browser: the published page server-renders (#733/#734), which means a plain
// fetch returns the same HTML a visitor gets. `?qs_export=1` tells the page to drop OUR controls —
// the component knows what belongs to us, where a regex over their markup would be guessing.

import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { requireUser } from '@/lib/auth/requireUser';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { exportBanner, injectStyle, inlineCssAssets, inlineImages } from '@/lib/sites/exportSite';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // fetching and inlining a page of images is not instant

/** Cap so one export cannot pull an unbounded payload into memory. */
const MAX_ASSET_BYTES = 4 * 1024 * 1024;
const MAX_TOTAL_BYTES = 24 * 1024 * 1024;

async function fetchAsDataUri(url: string): Promise<{ uri?: string; bytes: number; error?: string }> {
  try {
    const res = await fetch(url);
    if (!res.ok) return { bytes: 0, error: `${res.status}` };
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > MAX_ASSET_BYTES) return { bytes: 0, error: 'too large' };
    const type = res.headers.get('content-type')?.split(';')[0] || 'application/octet-stream';
    return { uri: `data:${type};base64,${buf.toString('base64')}`, bytes: buf.byteLength };
  } catch (e: any) {
    return { bytes: 0, error: e?.message || 'fetch failed' };
  }
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;

  const { data: tpl } = await supabaseAdmin
    .from('templates')
    .select('id, slug, owner_id, published, custom_domain, data')
    .eq('id', params.id)
    .maybeSingle();

  if (!tpl) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  // ⚠️ Owner only. This walks away with the whole rendered site; "it is yours" is exactly the
  // sentence that makes checking whose it is non-negotiable.
  if ((tpl as any).owner_id !== gate.user.id) {
    return NextResponse.json({ error: 'Not yours to export' }, { status: 403 });
  }

  const host = (tpl as any).custom_domain || `${(tpl as any).slug}.quicksites.ai`;
  const pageUrl = `https://${host}/`;

  let html: string;
  try {
    const res = await fetch(`${pageUrl}?qs_export=1`, { headers: { 'user-agent': 'QuickSitesExport/1' } });
    if (!res.ok) throw new Error(`site returned ${res.status}`);
    html = await res.text();
  } catch (e: any) {
    // ⚠️ Say which step failed. "Export failed" on the button whose whole job is to prove we are
    // not holding their site hostage is the worst possible error message.
    return NextResponse.json(
      { error: `Could not read ${pageUrl}: ${e?.message ?? 'unreachable'}` },
      { status: 502 },
    );
  }

  const $ = cheerio.load(html);
  let total = 0;
  const failed: string[] = [];

  // Stylesheets first — CSS carries background images, so it must be resolved before images.
  const cssHrefs = $('link[rel="stylesheet"]')
    .map((_, el) => $(el).attr('href'))
    .get()
    .filter(Boolean)
    .map((h) => new URL(String(h), pageUrl).toString());

  let cssText = '';
  for (const href of cssHrefs) {
    try {
      const res = await fetch(href);
      if (!res.ok) { failed.push(href); continue; }
      cssText += `\n/* ${href} */\n${await res.text()}`;
    } catch {
      failed.push(href);
    }
  }

  // Assets referenced from the CSS we just gathered.
  const cssUrls = [...cssText.matchAll(/url\((["']?)(https?:[^"')]+)\1\)/g)].map((m) => m[2]);
  const imgSrcs = $('img[src]')
    .map((_, el) => $(el).attr('src'))
    .get()
    .filter((s) => s && !s.startsWith('data:'))
    .map((s) => new URL(String(s), pageUrl).toString());

  const map: Record<string, string> = {};
  for (const url of [...new Set([...cssUrls, ...imgSrcs])]) {
    if (total > MAX_TOTAL_BYTES) { failed.push(`${url} (budget)`); continue; }
    const got = await fetchAsDataUri(url);
    if (got.uri) { map[url] = got.uri; total += got.bytes; } else { failed.push(`${url} (${got.error})`); }
  }

  // Drop the now-inlined <link>s, then embed CSS and images.
  $('link[rel="stylesheet"]').remove();
  $('script').remove(); // their file needs no JS from us, and dead scripts point at our routes

  let out = $.html();
  if (cssText) out = injectStyle(out, inlineCssAssets(cssText, map));
  out = inlineImages(out, map);
  out = exportBanner(pageUrl, new Date().toISOString()) + out;

  // ⚠️ Anything we could not fetch is NAMED in the file rather than silently missing. A hole in a
  // page you were told is complete is worse than a hole you were told about — same rule as the
  // Verbatim parser reporting what a résumé did not yield.
  if (failed.length) {
    out += `\n<!-- ${failed.length} asset(s) could not be embedded and still point at the web:\n${failed.join('\n')}\n-->\n`;
  }

  const filename = `${(tpl as any).slug || 'site'}.html`;
  return new NextResponse(out, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  });
}
