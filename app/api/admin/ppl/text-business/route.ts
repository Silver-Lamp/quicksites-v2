// POST /api/admin/ppl/text-business — an operator texts a campaign's forward-to business from the
// server (Twilio credentials live only there). Built 2026-10-16 to send V'Z Towing the real
// caller's number after two automatic texts had given them their own. Admin-only; the destination
// is always the campaign's current forward_to, never a number from the body.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/requireUser';
import { getGeoCampaign } from '@/lib/outreach/geoCampaigns';
import { sendSms } from '@/lib/sms/sendSms';
import { isOptedOut } from '@/lib/ppl/forwardNotice';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({ campaignId: z.string().uuid(), body: z.string().min(10).max(600) });

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid', issues: parsed.error.issues }, { status: 400 });
  const campaign = await getGeoCampaign(parsed.data.campaignId).catch(() => null);
  if (!campaign?.forward_to) return NextResponse.json({ error: 'no_forward_to' }, { status: 404 });
  // STOP is STOP, from the browser too.
  if (await isOptedOut(campaign.forward_to).catch(() => false)) return NextResponse.json({ error: 'opted_out', detail: 'This business replied STOP; nothing more goes to it by text.' }, { status: 409 });
  const res = await sendSms(campaign.forward_to, parsed.data.body, { reason: 'operator_text', campaignId: campaign.id });
  return NextResponse.json({ ok: res.ok, error: res.error ?? null, to: campaign.forward_to, domain: campaign.domain ?? null, by: gate.user.email ?? gate.user.id });
}
