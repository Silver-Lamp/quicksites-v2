// app/api/admin/restaurant-domains/buy-apex/route.ts
//
// One-click buy for a restaurant apex domain from the Location Domains cockpit.
// Spends real money — double-gated (admin + VERCEL_DOMAIN_REGISTER_ENABLED, enforced
// inside purchaseDomain's caller contract) — and, unlike the generic /api/domains/buy,
// records the purchase in the owned_domains ledger immediately so the area card flips
// to "domain owned" on the next load (the Vercel sync would catch it later anyway).
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireUser';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { purchaseDomain } from '@/lib/domains/registrar';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function flagEnabled(): boolean {
  return (
    process.env.VERCEL_DOMAIN_REGISTER_ENABLED === '1' ||
    process.env.VERCEL_DOMAIN_REGISTER_ENABLED === 'true'
  );
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  if (!flagEnabled()) {
    return NextResponse.json(
      { error: 'registration_disabled', detail: 'Set VERCEL_DOMAIN_REGISTER_ENABLED=1 to enable purchases.' },
      { status: 403 },
    );
  }
  if (!process.env.VERCEL_TOKEN) {
    return NextResponse.json({ error: 'Missing VERCEL_TOKEN env' }, { status: 500 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const domain = typeof body.domain === 'string' ? body.domain.trim().toLowerCase() : '';
  if (!domain) return NextResponse.json({ error: 'domain is required.' }, { status: 400 });

  const result = await purchaseDomain(domain, {
    expectedPriceUsd: typeof body.expectedPriceUsd === 'number' ? body.expectedPriceUsd : null,
  });
  if (!result.ok || !result.purchased) {
    return NextResponse.json({ error: result.reason || 'Purchase failed.', priceUsd: result.priceUsd }, { status: 502 });
  }

  // Ledger upsert (best-effort): the cockpit reads owned_domains, so record it now
  // rather than waiting for the next Vercel inventory sync.
  try {
    await (supabaseAdmin as any).from('owned_domains').upsert(
      {
        domain: result.domain,
        source: 'vercel',
        registrar: 'vercel',
        auto_renew: true,
        ...(typeof result.priceUsd === 'number' ? { renewal_cents: Math.round(result.priceUsd * 100) } : {}),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'domain' },
    );
  } catch {
    /* the periodic Vercel sync will pick it up */
  }

  return NextResponse.json({
    ok: true,
    domain: result.domain,
    purchased: result.purchased,
    attached: result.attached,
    priceUsd: result.priceUsd,
  });
}
