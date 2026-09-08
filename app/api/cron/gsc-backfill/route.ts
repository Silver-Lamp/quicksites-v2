// app/api/cron/gsc-backfill/route.ts
// Connect campaign domains to Search Console, a batch at a time (cron secret or admin).
//
// A domain that is not a GSC property cannot be measured, so its campaign keeps the `unranked`
// column default forever and every surface downstream shows that default as a finding. Exactly one
// of 100 campaigns was connected when this was written; connectDomainToGsc already ran on the two
// paths that CREATE a domain, but nothing ever went back for the ones that predate that wiring.
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runCron } from '@/lib/cron/record';
import { isCronAuthorized } from '@/lib/cron/auth';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { gscAutoConnectEnabled } from '@/lib/gsc/connectDomain';
import {
  pickBackfillCandidates, partitionByZone, connectOne, summarize, backfillFailed, type BackfillOutcome,
} from '@/lib/gsc/backfillGscProperties';
import { listVercelOwnedDomains } from '@/lib/domains/registrar';
import { isVercelDnsZone } from '@/lib/domains/vercel';
import { bareDomain } from '@/lib/gsc/connectDomain';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Small on purpose: each domain is a Google verification call plus a real DNS write. */
const BATCH = 10;

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
    { auth: { persistSession: false } },
  );
}

async function handle(req: NextRequest) {
  if (!isCronAuthorized(req) && !(await getAdminUser())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  return runCron('gsc-backfill', async () => {
    // Flag-gated like the two paths that already call connectDomainToGsc — it writes DNS records
    // on real zones and adds properties to a real Google account.
    if (!gscAutoConnectEnabled()) {
      return NextResponse.json({
        ok: true,
        skipped: 'disabled',
        detail: 'Set GSC_AUTO_CONNECT_ENABLED=1 to connect campaign domains automatically.',
      });
    }

    const db = admin();
    // The operator whose OAuth grant we act under. One grant covers every property that account
    // owns, which is why 22 token rows share 3 refresh tokens — no per-domain consent needed.
    const { data: tok } = await db.from('gsc_tokens').select('user_id').limit(1).maybeSingle();
    const userId = (tok as { user_id?: string } | null)?.user_id;
    if (!userId) {
      return NextResponse.json(
        { ok: false, error: 'No GSC token on file — an operator must connect Search Console once.' },
        { status: 500 },
      );
    }

    const [{ data: camps }, { data: props }] = await Promise.all([
      db.from('geo_industry_campaigns').select('id, domain').not('domain', 'is', null).limit(1000),
      db.from('gsc_tokens').select('domain'),
    ]);

    const connectedProps = ((props ?? []) as { domain: string }[]).map((p) => p.domain).filter(Boolean);
    const unconnected = pickBackfillCandidates((camps ?? []) as { id: string; domain: string }[], connectedProps, 100000);
    // Only a zone Vercel hosts can take the TXT. Domains elsewhere are named, not retried.
    const zones = await listVercelOwnedDomains();
    const { onVercel, offVercel: notListed } = partitionByZone(unconnected, zones ? new Set(zones.map((z) => z.domain)) : null);
    // ⚠️ Listed is not the same as writable: a domain registered through Vercel can sit in the
    // account list with no DNS zone. Probe the zone while picking, so the ten slots go to domains a
    // TXT can actually land on; the rest are named for the operator.
    const candidates: typeof onVercel = [];
    const noZone: string[] = [];
    for (const c of onVercel) {
      if (candidates.length >= BATCH) break;
      const zone = await isVercelDnsZone(bareDomain(c.domain));
      if (zone === false) noZone.push(c.domain);
      else candidates.push(c);
    }
    const offVercel = [...notListed, ...noZone.map((domain) => ({ id: '', domain }))];
    const totalUnconnected = onVercel.length - noZone.length;

    const outcomes: BackfillOutcome[] = [];
    for (const cand of candidates) {
      // Sequential on purpose: DNS writes against one zone provider, and a rate-limit here would
      // surface as a wall of identical failures that tell you nothing.
      outcomes.push(await connectOne(cand.domain, userId));
    }

    const summary = summarize(outcomes, Math.max(0, totalUnconnected - outcomes.length));
    const failed = backfillFailed(summary);
    return NextResponse.json(
      {
        ok: !failed,
        ...summary,
        // Named so an operator can move their nameservers (or register them) — the cron cannot.
        notOnVercelDns: offVercel.map((c) => c.domain),
        vercelZonesKnown: zones !== null,
        ...(failed
          ? { error: `Attempted ${summary.attempted} and connected none. First reason: ${outcomes[0]?.reason ?? 'unknown'}` }
          : {}),
      },
      { status: failed ? 500 : 200 },
    );
  });
}

export const GET = handle;
export const POST = handle;
