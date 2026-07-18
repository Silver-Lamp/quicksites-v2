// app/api/cron/partner-audio-usage-sync/route.ts
//
// Nightly pull of HiveJournal's partner audio usage feed into the partner_audio_usage
// ledger (per-agent attribution + tier-billing reconciliation). Cron-authorized. No-ops
// unless PARTNER_AUDIO_PROVISIONING_ENABLED is on and the endpoint is live.
// See crosstalk/contracts/partner-provisioning.md §2 (billing rollup — PROPOSED).

import { NextResponse } from 'next/server';
import { runCron } from '@/lib/cron/record';
import { isCronAuthorized } from '@/lib/cron/auth';
import { partnerAudioEnabled } from '@/lib/partners/audioProvisioning/config';
import { syncPartnerUsage } from '@/lib/partners/audioProvisioning/usageFeed';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(req: Request): Promise<Response> {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return runCron('partner-audio-usage-sync', async () => {
    if (!partnerAudioEnabled()) {
      return NextResponse.json({ ok: true, skipped: 'flag_off' });
    }
    const summary = await syncPartnerUsage();
    return NextResponse.json({ ok: true, ...summary });
  });
}
