// app/api/admin/prospects/geo-campaign/sync-status-callbacks/route.ts
//
// Backfill: point every campaign's tracking number at the parent-call status callback
// (`/api/twilio/geo/<id>/status`). New numbers get it at purchase/attach; the eleven that
// existed before 2026-10-05 did not. Idempotent — re-running changes nothing already set.
//
// Twilio credentials are write-only in Vercel, so this is a click on /admin/ppl, not a script.
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireUser';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { syncNumberStatusCallback, twilioConfigured } from '@/lib/outreach/callTracking';
import { publicBaseUrl } from '@/lib/outreach/competitionPoster';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;
  if (!twilioConfigured()) {
    return NextResponse.json({ error: 'Twilio is not configured in this environment.' }, { status: 503 });
  }
  const { data, error } = await supabaseAdmin
    .from('geo_industry_campaigns')
    .select('id, domain, tracking_number, tracking_number_sid')
    .not('tracking_number_sid', 'is', null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const base = publicBaseUrl();
  const results: Array<{ domain: string | null; number: string | null; ok: boolean; changed?: boolean; error?: string }> = [];
  for (const c of data ?? []) {
    const voiceUrl = `${base}/api/twilio/geo/${c.id}`;
    try {
      const r = await syncNumberStatusCallback({ sid: c.tracking_number_sid as string, voiceUrl });
      results.push({ domain: c.domain, number: c.tracking_number, ok: true, changed: r.previous !== r.statusCallback });
    } catch (e: unknown) {
      results.push({ domain: c.domain, number: c.tracking_number, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return NextResponse.json({
    ok: results.every((r) => r.ok),
    total: results.length,
    changed: results.filter((r) => r.changed).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  });
}
