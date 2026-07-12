// app/api/domains/search/route.ts
//
// Admin-gated domain availability + price search. Returns the exact match (when
// the query is a full domain) plus alternate-TLD suggestions, each with price.
// Read-only: never registers anything.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { suggestDomains, readRegistrantContact, getRegistrar } from '@/lib/domains/registrar';

export async function POST(req: Request) {
  try {
    if (!(await getAdminUser())) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }
    if (!process.env.VERCEL_TOKEN) {
      return NextResponse.json({ ok: false, error: 'Missing VERCEL_TOKEN env' }, { status: 500 });
    }

    const body = (await req.json().catch(() => ({}))) as { query?: string };
    const query = String(body.query || '').trim();
    if (!query) {
      return NextResponse.json({ ok: false, error: 'query required' }, { status: 400 });
    }

    const results = await suggestDomains(query);

    // Surface whether the purchase path is even usable, so the UI can disable
    // "Buy" up-front instead of failing at click time.
    const registerEnabled =
      process.env.VERCEL_DOMAIN_REGISTER_ENABLED === '1' ||
      process.env.VERCEL_DOMAIN_REGISTER_ENABLED === 'true';
    const registrant = readRegistrantContact();

    return NextResponse.json({
      ok: true,
      provider: getRegistrar(),
      results,
      purchase: {
        enabled: registerEnabled && registrant.ok,
        registerFlag: registerEnabled,
        contactReady: registrant.ok,
        missingContact: registrant.ok ? [] : registrant.missing,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'search failed';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
