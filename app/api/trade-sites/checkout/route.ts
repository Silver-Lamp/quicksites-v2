// app/api/trade-sites/checkout/route.ts
//
// Self-serve checkout for the custom-domain tier of a claimed trade site. The plan's own words:
// "it is a claim link and a card on file or it is nothing" — no rep, no operator-minted link.
//
// Owner-gated (the person who claimed the site), flag-gated (TRADE_SITE_BILLING_ENABLED), and the
// domain is checked BEFORE money changes hands: taken, premium, or over our per-year ceiling all
// stop here with a reason, because a subscription for a domain we then cannot buy is the failure
// this rail must never produce.
import { NextResponse } from 'next/server';
import { requireTemplateOwner } from '@/lib/auth/requireTemplateOwner';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getServerSupabase } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe/server';
import { checkAvailability } from '@/lib/domains/registrar';
import { publicBaseUrl } from '@/lib/outreach/competitionPoster';
import {
  tradeSiteBillingEnabled,
  tradeSiteDomainPriceCents,
  tradeSiteMaxDomainPriceUsd,
  normalizeApexDomain,
  TRADE_SITE_META_TEMPLATE,
  TRADE_SITE_META_DOMAIN,
} from '@/lib/tradeSites/config';
import { recordCheckoutCreated } from '@/lib/tradeSites/subscriptions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const templateId = String(body.templateId ?? '');
  if (!templateId) return NextResponse.json({ error: 'templateId is required.' }, { status: 400 });

  const gate = await requireTemplateOwner(templateId);
  if (!gate.ok) return gate.response;

  if (!tradeSiteBillingEnabled()) {
    return NextResponse.json({ error: 'Custom domains are not for sale yet.', code: 'disabled' }, { status: 403 });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Payments are not configured.', code: 'not_configured' }, { status: 501 });
  }

  const apex = normalizeApexDomain(String(body.domain ?? ''));
  if (!apex) {
    return NextResponse.json({ error: 'Enter a domain like smithtowing.com (no www, no path).', code: 'invalid_domain' }, { status: 400 });
  }

  const { data: tpl } = await supabaseAdmin
    .from('templates')
    .select('id, business_name, template_name, custom_domain')
    .eq('id', templateId)
    .maybeSingle();
  if (!tpl) return NextResponse.json({ error: 'Site not found.' }, { status: 404 });
  if ((tpl as any).custom_domain) {
    return NextResponse.json({ error: 'This site already has a custom domain.', code: 'already_has_domain' }, { status: 409 });
  }

  // Availability + price ceiling, when the registrar is configured. An errored check is UNKNOWN,
  // not taken (registrar.ts) — we let the checkout proceed and provisioning re-checks.
  if (process.env.VERCEL_TOKEN) {
    const avail = await checkAvailability(apex).catch(() => null);
    if (avail && !avail.error) {
      if (!avail.available) {
        return NextResponse.json({ error: `${apex} is already registered. Try another name.`, code: 'unavailable' }, { status: 409 });
      }
      if (avail.premium || (typeof avail.priceUsd === 'number' && avail.priceUsd > tradeSiteMaxDomainPriceUsd())) {
        return NextResponse.json(
          { error: `${apex} is a premium name we can’t include at this price. Try a .com without a short or common word.`, code: 'premium', priceUsd: avail.priceUsd },
          { status: 409 },
        );
      }
    }
  }

  const { data: u } = await (await getServerSupabase()).auth.getUser();
  const email = u?.user?.email ?? undefined;
  const name = (tpl as any).business_name || (tpl as any).template_name || 'your site';
  const origin = publicBaseUrl();

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: email,
      client_reference_id: templateId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: tradeSiteDomainPriceCents(),
            recurring: { interval: 'month' },
            product_data: { name: `${apex} — custom domain for ${name}` },
          },
        },
      ],
      metadata: { [TRADE_SITE_META_TEMPLATE]: templateId, [TRADE_SITE_META_DOMAIN]: apex, user_id: gate.userId },
      subscription_data: { metadata: { [TRADE_SITE_META_TEMPLATE]: templateId, [TRADE_SITE_META_DOMAIN]: apex } },
      success_url: `${origin}/welcome/${templateId}?upgraded=1`,
      cancel_url: `${origin}/welcome/${templateId}?canceled=1`,
    });
    await recordCheckoutCreated({ templateId, ownerId: gate.userId, domain: apex });
    return NextResponse.json({ ok: true, url: session.url });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Could not start checkout.' }, { status: 502 });
  }
}
