// app/api/rebuild/route.ts
//
// "AI rebuild" lead magnet: a prospect (or reseller demoing to a prospect) pastes a
// client's existing website URL; we scrape it, regenerate a fresh QuickSites draft
// grounded in their real content, and hand back the editor URL. The heavy sell is
// that a reseller can turn "migrate my clients" anxiety into a 30-second wow.
//
// Flow: flag/authz gate → per-IP rate limit → scrape (SSRF-guarded) → one metered
// AI call to infer the spec → assemble + insert the draft (service role) → return
// { id, slug, editorUrl, summary }. Abuse-gated the same way guest build is: guest
// AI cap + per-IP draft rate limit + the global LLM budget guard inside meterLLMCall.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSupabase } from '@/lib/supabase/server';
import { checkRateLimit, clientIp } from '@/lib/rateLimit';
import { enforceGuestAiLimit, guestLimitBody } from '@/lib/ai/guestGuard';
import { guestBuildEnabled } from '@/lib/flags/guestBuild';
import { scrapeSite, scrapeMenuPages, ScrapeError } from '@/lib/rebuild/scrapeSite';
import { inferSiteSpec } from '@/lib/rebuild/inferSiteSpec';
import { buildRebuildTemplate, wireCatalogIntoTemplate } from '@/lib/rebuild/assembleDraft';
import { importShopifyProducts } from '@/lib/rebuild/importShopify';
import { productsFromScrape } from '@/lib/rebuild/importJsonLd';
import { provisionShopifyCatalog } from '@/lib/commerce/shopifyCatalog';
import { generateRebuildHero, rebuildHeroEnabled } from '@/lib/rebuild/generateHero';
import { captureServer } from '@/lib/analytics/posthog-server';
import { EVENTS } from '@/lib/analytics/events';

/** Host-only (no path/query) so analytics never carries a full prospect URL. */
function hostOnly(u: string): string | null {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Scrape (~1-12s) + one chat call (~2-4s), well under the limit but give headroom.
export const maxDuration = 60;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!;
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

function uuid(): string {
  return globalThis.crypto?.randomUUID?.() ?? `id_${Math.random().toString(36).slice(2)}${Date.now()}`;
}

export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.', code: 'bad_request' }, { status: 400 });
  }
  const url = String(body?.url || '').trim();
  if (!url) {
    return NextResponse.json({ error: 'Please provide a website URL.', code: 'bad_request' }, { status: 400 });
  }

  // Resolve the caller's session (real or anonymous/guest).
  let ownerId: string | null = null;
  let isAnonymous = false;
  try {
    const ssr = await getServerSupabase();
    const { data: { user } } = await ssr.auth.getUser();
    ownerId = user?.id ?? null;
    isAnonymous = !!user?.is_anonymous;
  } catch {
    /* no session */
  }

  // The anonymous path only exists when guest build is on. Real (signed-in) users
  // can always rebuild. This keeps the public lead magnet behind the same flag that
  // gates guest drafts, without blocking authenticated agencies.
  if (!ownerId) {
    return NextResponse.json(
      { error: 'Start a session before rebuilding.', code: 'no_session' },
      { status: 401 },
    );
  }
  if (isAnonymous && !guestBuildEnabled()) {
    return NextResponse.json({ error: 'Guest rebuild is not available.', code: 'disabled' }, { status: 403 });
  }

  // Per-IP throttle so a bot can't spin up unlimited AI-backed drafts. Reuses the
  // guest-draft budget knob; only enforced for the anonymous path.
  if (isAnonymous) {
    const limit = Number(process.env.GUEST_DRAFT_HOURLY_LIMIT_PER_IP ?? '10') || 0;
    const rl = await checkRateLimit(`rebuild:${clientIp(req)}`, limit, 3600);
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Too many rebuilds from this network. Sign up to keep going.', code: 'rate_limited' },
        { status: 429 },
      );
    }
  }

  // Per-guest AI-call cap (no-op for real users).
  try {
    const ssr = await getServerSupabase();
    const { data: { user } } = await ssr.auth.getUser();
    const guard = await enforceGuestAiLimit(user, 'rebuild');
    if (!guard.ok) return NextResponse.json(guestLimitBody(guard.limit), { status: 429 });
  } catch {
    /* if the session read fails here we already have ownerId; proceed */
  }

  // 1) Scrape the prospect's current site (SSRF-guarded inside scrapeSite).
  let scraped;
  try {
    scraped = await scrapeSite(url);
  } catch (e) {
    if (e instanceof ScrapeError) {
      const status = e.code === 'blocked_host' || e.code === 'invalid_url' ? 400 : 422;
      return NextResponse.json({ error: e.message, code: e.code }, { status });
    }
    return NextResponse.json({ error: 'Could not read that site.', code: 'scrape_failed' }, { status: 422 });
  }

  // Funnel: a real rebuild attempt began (scrape succeeded → we'll spend an AI call).
  void captureServer(EVENTS.REBUILD_STARTED, { host: hostOnly(scraped.finalUrl), is_anonymous: isAnonymous }, ownerId);

  // 1b) If the site looks like it has a menu (restaurant), follow a few menu
  //     subpages so the AI can reconstruct the real menu. Best-effort.
  // 1c) If it's a Shopify store, pull the REAL catalog (title/price/images/variants)
  //     straight from /products.json — deterministic, no AI. Both best-effort.
  const [menuPages, products] = await Promise.all([
    scrapeMenuPages(scraped).catch(() => []),
    importShopifyProducts(scraped.finalUrl).catch(() => []),
  ]);

  // 2) One metered AI call → structured rebuild spec (incl. a menu when food).
  let spec;
  try {
    spec = await inferSiteSpec(scraped, ownerId, menuPages);
  } catch (e: any) {
    // meterLLMCall throws LLMBudgetExceededError when the budget guard trips.
    const msg = e?.name === 'LLMBudgetExceededError' ? 'AI is busy right now — try again shortly.' : 'Could not generate the site.';
    return NextResponse.json({ error: msg, code: 'ai_failed' }, { status: 503 });
  }
  // Real products override the AI's generic services brochure with a live storefront.
  // Shopify (/products.json) is exact; for every other cart we fall back to schema.org
  // Product JSON-LD / OpenGraph product meta parsed from the page.
  const importedProducts = products.length ? products : productsFromScrape(scraped);
  if (importedProducts.length) spec.products = importedProducts;

  // 2b) Optionally generate a fresh, on-brand hero (flag-gated; best-effort). Falls
  //     back to the scraped og:image so a failure never breaks the rebuild.
  let heroImage = scraped.heroImage;
  if (rebuildHeroEnabled()) {
    const fresh = await generateRebuildHero(spec, ownerId);
    if (fresh) heroImage = fresh;
  }

  // 3) Assemble + insert the draft (service role; INSERT isn't guarded). Stamp
  //    ownership so it auto-claims when a guest upgrades (same uid → owner_id).
  const tpl = buildRebuildTemplate({ spec, heroImage, sourceUrl: scraped.finalUrl });

  // 3a) Real products → create catalog_items under the owner's merchant and wire the
  //     storefront (productIds + meta.ecom.merchant_id) so "Add to Cart" → checkout
  //     works. Done pre-insert so the wired data lands in one write (templates UPDATEs
  //     are trigger-guarded). Non-fatal: on failure we ship a display-only draft.
  let commerce: { merchantId: string; productsImported: number } | null = null;
  if (spec.products?.length) {
    try {
      const res = await provisionShopifyCatalog({
        ownerId,
        businessName: spec.businessName,
        siteSlug: tpl.slug,
        products: spec.products,
      });
      if (res.created > 0) {
        wireCatalogIntoTemplate(tpl.data, res.merchantId, res.idByHandle);
        commerce = { merchantId: res.merchantId, productsImported: res.created };
      }
    } catch (e) {
      console.error('[rebuild] shopify catalog provisioning failed', e);
    }
  }

  let insertedId: string | null = null;
  let slug = tpl.slug;
  for (let attempt = 0; attempt < 3 && !insertedId; attempt++) {
    const row: any = {
      id: uuid(),
      template_name: attempt === 0 ? tpl.template_name : `${tpl.template_name} ${attempt + 1}`,
      slug,
      data: tpl.data,
      color_mode: tpl.color_mode,
      header_block: tpl.header_block,
      footer_block: tpl.footer_block,
      is_site: false,
      industry: tpl.industry,
      business_name: tpl.business_name,
      owner_id: ownerId,
      claim_source: isAnonymous ? 'guest_build' : 'ai_rebuild',
    };
    const { data, error } = await admin.from('templates').insert(row).select('id, slug').single();
    if (!error && data) {
      insertedId = data.id;
      slug = data.slug;
      break;
    }
    if (error && `${error.code}` === '23505') {
      slug = `${tpl.slug}-${Math.random().toString(36).slice(2, 5)}`;
      continue;
    }
    return NextResponse.json({ error: error?.message || 'Could not save the draft.', code: 'insert_failed' }, { status: 500 });
  }
  if (!insertedId) {
    return NextResponse.json({ error: 'Could not allocate a unique draft.', code: 'insert_failed' }, { status: 500 });
  }

  // Funnel: a draft was generated from the prospect's site.
  void captureServer(
    EVENTS.REBUILD_COMPLETED,
    { host: hostOnly(scraped.finalUrl), industry: spec.industryKey, is_anonymous: isAnonymous, template_id: insertedId },
    ownerId,
  );

  return NextResponse.json({
    ok: true,
    id: insertedId,
    slug,
    editorUrl: `/admin/templates/${insertedId}`,
    summary: {
      businessName: spec.businessName,
      industryLabel: spec.industryLabel,
      services: spec.services,
      sourceUrl: scraped.finalUrl,
      heroImage,
      // When a real storefront was imported: how many products, the merchant, and
      // whether the owner still needs to connect Stripe to accept payouts. The client
      // can deep-link the owner into Connect onboarding (POST /api/connect/onboard).
      ...(commerce
        ? {
            productsImported: commerce.productsImported,
            merchantId: commerce.merchantId,
            needsPayoutSetup: !isAnonymous, // anon can't onboard until they sign up
          }
        : {}),
    },
  });
}
