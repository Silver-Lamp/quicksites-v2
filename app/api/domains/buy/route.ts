// app/api/domains/buy/route.ts
//
// Admin-gated, flag-gated domain purchase via the Vercel registrar. Buys the
// domain, then attaches apex + www to the project (DNS auto-managed by Vercel).
//
// Spends real money, so it is double-gated:
//   1. getAdminUser()                       — only platform admins
//   2. VERCEL_DOMAIN_REGISTER_ENABLED=1     — explicit opt-in kill-switch
// plus a complete DOMAIN_REGISTRANT_* (or NAMECHEAP_REGISTRANT_*) contact.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { purchaseDomain } from '@/lib/domains/registrar';

export async function POST(req: Request) {
  try {
    if (!(await getAdminUser())) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }

    const registerEnabled =
      process.env.VERCEL_DOMAIN_REGISTER_ENABLED === '1' ||
      process.env.VERCEL_DOMAIN_REGISTER_ENABLED === 'true';
    if (!registerEnabled) {
      return NextResponse.json(
        { ok: false, error: 'registration_disabled', detail: 'Set VERCEL_DOMAIN_REGISTER_ENABLED=1 to enable purchases.' },
        { status: 403 }
      );
    }
    if (!process.env.VERCEL_TOKEN) {
      return NextResponse.json({ ok: false, error: 'Missing VERCEL_TOKEN env' }, { status: 500 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      domain?: string;
      expectedPriceUsd?: number;
      renew?: boolean;
      attach?: boolean;
    };
    const domain = String(body.domain || '').trim();
    if (!domain) {
      return NextResponse.json({ ok: false, error: 'domain required' }, { status: 400 });
    }

    const result = await purchaseDomain(domain, {
      expectedPriceUsd: typeof body.expectedPriceUsd === 'number' ? body.expectedPriceUsd : null,
      renew: body.renew,
      attach: body.attach,
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.reason || 'purchase failed', result }, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
      domain: result.domain,
      purchased: result.purchased,
      attached: result.attached,
      priceUsd: result.priceUsd,
      // Hand the panel the same shape the connect flow uses, so it can drop
      // straight into "verify" without re-attaching.
      next: { verifyEndpoint: '/api/domains/verify', method: 'POST', body: { domain: `www.${result.domain}` } },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'buy failed';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
