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
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { exportBanner, injectStyle, inlineCssAssets, inlineImages } from '@/lib/sites/exportSite';
import { menuSiteUrl, menuEnabled } from '@/lib/menu/deliveredMenu';

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
    .select('id, slug, owner_id, published, custom_domain, claim_source, data')
    .eq('id', params.id)
    .maybeSingle();

  if (!tpl) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // ⚠️ OWNER-ONLY WAS RIGHT AND ALSO LOCKED OUT THE ONLY PEOPLE WHO COULD USE IT. Every
  // listing-import draft has `owner_id = null` — the importer sets it only when handed an
  // operator id, and it never was — so `null !== you` refused everybody, including the admin who
  // built the site. The check was correct about claimed sites and wrong about the 127 drafts that
  // are the entire reason the feature exists.
  //
  // An unclaimed draft WE built is ours until somebody takes it: that is the same premise as the
  // claim flow, the watermark and the suppressed copyright. A claimed site is not, and stays
  // owner-only — an admin reading a customer's site out of the product is a different act with a
  // different justification, and this route is not where that gets decided.
  const ownerId = (tpl as any).owner_id as string | null;
  const claimSrc = String((tpl as any).claim_source ?? '');
  const isOwner = !!ownerId && ownerId === gate.user.id;
  const isUnclaimedOperatorDraft =
    !ownerId && (claimSrc === 'listing_import' || claimSrc === 'operator_draft');
  const admin = isUnclaimedOperatorDraft ? await getAdminUser() : null;

  if (!isOwner && !(isUnclaimedOperatorDraft && admin)) {
    return NextResponse.json(
      {
        error: ownerId
          ? 'Not yours to export'
          : 'This draft has no owner yet — an operator can export it, or claim it first.',
      },
      { status: 403 },
    );
  }

  // ⚠️ THE PUBLIC URL IS NOT ALWAYS THE quicksites.ai SUBDOMAIN, and getting this wrong produced
  // a clean 200 of the WRONG PAGE. A listing-import draft lives on delivered.menu; on
  // `<slug>.quicksites.ai` it serves our 404 ("This page moved, or never existed"). The first
  // version fetched that, wrapped it, and would have handed a restaurant owner our error page as
  // the artifact proving they own their site — the download button's entire purpose, inverted,
  // with no error anywhere.
  const slug = String((tpl as any).slug ?? '');
  const claimSource = String((tpl as any).claim_source ?? '');
  const onMenuHost = menuEnabled() && (claimSource === 'listing_import' || claimSource === 'claimed');
  const pageUrl = (tpl as any).custom_domain
    ? `https://${(tpl as any).custom_domain}/`
    : onMenuHost
      ? `${menuSiteUrl(slug)}/`
      : `https://${slug}.quicksites.ai/`;

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

  // ⚠️ CHECK IT IS THEIR PAGE BEFORE HANDING IT OVER. A 200 is not proof we fetched the right
  // thing — our 404 page and our marketing homepage both return 200 on the wrong host. The
  // business's own name appearing in the document is the cheapest available evidence that this is
  // the site and not something of ours wearing an HTTP success code.
  const expectName = String(
    (tpl as any)?.data?.meta?.business_name ?? (tpl as any)?.data?.meta?.siteTitle ?? '',
  ).trim();
  if (expectName && !html.toLowerCase().includes(expectName.toLowerCase())) {
    return NextResponse.json(
      {
        error:
          `Read ${pageUrl} but it does not look like your site — "${expectName}" is not on the page. ` +
          `Refusing to hand you a file that is not yours.`,
      },
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

  // ⚠️ THE REFERENCE IN THE DOCUMENT IS WHAT GETS REPLACED, NOT THE URL WE FETCHED. The first
  // version absolutised every src to fetch it and then substituted the ABSOLUTE string — which
  // does not appear anywhere in the HTML, because the page writes relative paths
  // (`/api/public/place-photo?ref=…`, `/_next/static/media/layers.png`). Every fetch succeeded,
  // every replacement missed, and the file downloaded with zero inlined images and no errors:
  // a clean success producing a page with the restaurant's photo missing.
  //
  // Relative URLs also had to be collected at all — the old regex required `https?:`, so the
  // CSS backgrounds were never even attempted.
  const cssRefs = [...cssText.matchAll(/url\((["']?)([^"')]+)\1\)/g)]
    .map((m) => m[2])
    .filter((u) => u && !u.startsWith('data:'));
  const imgRefs = $('img[src]')
    .map((_, el) => $(el).attr('src'))
    .get()
    .filter((v): v is string => !!v && !v.startsWith('data:'));

  const map: Record<string, string> = {};
  for (const ref of [...new Set([...cssRefs, ...imgRefs])]) {
    if (total > MAX_TOTAL_BYTES) { failed.push(`${ref} (budget)`); continue; }
    let absolute: string;
    try {
      absolute = new URL(ref, pageUrl).toString();
    } catch {
      failed.push(`${ref} (unparseable)`);
      continue;
    }
    const got = await fetchAsDataUri(absolute);
    // Keyed on the reference AS WRITTEN, so the substitution can find it.
    if (got.uri) { map[ref] = got.uri; total += got.bytes; } else { failed.push(`${ref} (${got.error})`); }
  }

  // Drop the now-inlined <link>s, then embed CSS and images.
  $('link[rel="stylesheet"]').remove();
  $('script').remove(); // their file needs no JS from us, and dead scripts point at our routes
  // Preloads point at chunks this file no longer has.
  $('link[rel="preload"]').remove();

  // ⚠️ OUR CHROME, REMOVED HERE BECAUSE THE PAGE CANNOT REMOVE IT FOR US. `?qs_export=1` was
  // supposed to let each component opt out — but the check reads `window.location`, and this route
  // fetches SERVER-RENDERED HTML, so it never ran. The exported file therefore carried the
  // "Hear this page" launcher and, far worse, a full-screen `Loading…` splash at z-9999 that
  // NOTHING COULD EVER DISMISS, because we strip the scripts that would have hidden it. The owner
  // opened their site and got a dark overlay, forever.
  //
  // This is a selector over OUR OWN attribute, not a guess at their markup — the objection that
  // sent me to the client-side check in the first place does not apply to a marker we put there.
  // The client check stays as a belt for real browsers; this is the one that runs.
  const chrome = $('[data-qs-chrome]').length;
  $('[data-qs-chrome]').remove();
  // Belt: the splash predates the marker on any page not yet redeployed.
  $('[data-qs="loading-splash"]').remove();

  // ⚠️ AN EMBEDDED MAP CANNOT BE MADE SELF-CONTAINED, so it becomes a link rather than an empty
  // grey box. Left as an iframe it would be the one visibly broken thing on a page we handed
  // somebody as "yours, works anywhere" — and it would have quietly falsified the banner two lines
  // below, which promises no internet connection is needed.
  let mapsReplaced = 0;
  $('iframe[src*="maps."], iframe[src*="google.com/maps"]').each((_, el) => {
    const src = $(el).attr('src') || '';
    $(el).replaceWith(
      `<p style="margin:1rem 0"><a href="${src.replace(/&output=embed/, '')}" target="_blank" rel="noopener">Open the map</a></p>`,
    );
    mapsReplaced += 1;
  });

  let out = $.html();
  if (cssText) out = injectStyle(out, inlineCssAssets(cssText, map));
  out = inlineImages(out, map);
  // ⚠️ The banner promises "needs no internet connection". That is only true once the map is gone
  // and every image is embedded — so anything still outstanding is stated next to the promise
  // rather than left for the owner to discover when they open it on a plane.
  out = exportBanner(pageUrl, new Date().toISOString()) + out;
  if (mapsReplaced || failed.length) {
    out = out.replace(
      '-->',
      `  ${mapsReplaced ? `The embedded map became a link — a live map cannot work offline.\n` : ''}` +
        `${failed.length ? `  ${failed.length} asset(s) could not be embedded; they are listed at the end of this file.\n` : ''}` +
        `-->`,
    );
  }

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
