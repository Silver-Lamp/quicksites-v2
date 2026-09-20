// app/api/admin/ppl/accounts/route.ts
//
// GET  → every pay-per-call account (operator view).
// POST → create one for a geo campaign, switch the campaign to pricing_model='ppl', and return a
//        deposit Checkout link to send the business. Creating the account does NOT connect calls:
//        status stays 'pending' until the first deposit lands via the webhook.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/requireUser';
import { getGeoCampaign, setCampaignPricing } from '@/lib/outreach/geoCampaigns';
import { createPplAccount, getPplAccountByCampaign, listPplAccounts } from '@/lib/ppl/accounts';
import { createDepositCheckout, pplEnabled } from '@/lib/ppl/billing';
import { PPL_DEFAULTS } from '@/lib/ppl/rules';
import { statementUrl } from '@/lib/ppl/statementToken';
import { publicBaseUrl } from '@/lib/outreach/competitionPoster';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  geo_campaign_id: z.string().uuid(),
  business_name: z.string().min(1).max(120),
  contact_email: z.string().email().optional().nullable(),
  contact_phone: z
    .string()
    .regex(/^\+[1-9]\d{7,14}$/, 'E.164 phone')
    .optional()
    .nullable(),
  cpl_cents: z.number().int().positive().max(100_000).optional(),
  min_billable_seconds: z.number().int().min(0).max(600).optional(),
  reload_threshold_cents: z.number().int().min(0).optional(),
  reload_amount_cents: z.number().int().positive().max(1_000_000).optional(),
  auto_reload: z.boolean().optional(),
  /** Initial deposit for the Checkout link. */
  deposit_cents: z.number().int().min(100).max(1_000_000).optional(),
});

export async function GET() {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;
  const accounts = await listPplAccounts();
  return NextResponse.json({ enabled: pplEnabled(), accounts });
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: 'invalid body', issues: parsed.error.issues },
      { status: 400 }
    );
  const b = parsed.data;

  const campaign = await getGeoCampaign(b.geo_campaign_id).catch(() => null);
  if (!campaign) return NextResponse.json({ error: 'campaign not found' }, { status: 404 });
  if (!campaign.tracking_number) {
    return NextResponse.json(
      { error: 'campaign has no tracking number — provision one first' },
      { status: 409 }
    );
  }
  if (await getPplAccountByCampaign(campaign.id)) {
    return NextResponse.json({ error: 'campaign already has a ppl account' }, { status: 409 });
  }

  const account = await createPplAccount({
    geo_campaign_id: campaign.id,
    business_name: b.business_name,
    contact_email: b.contact_email ?? null,
    contact_phone: b.contact_phone ?? campaign.forward_to ?? null,
    cpl_cents: b.cpl_cents,
    min_billable_seconds: b.min_billable_seconds,
    reload_threshold_cents: b.reload_threshold_cents,
    reload_amount_cents: b.reload_amount_cents,
    auto_reload: b.auto_reload,
  });
  await setCampaignPricing(campaign.id, {
    pricing_model: 'ppl',
    price_cents: account.cpl_cents,
    locked_rate_cents: null,
    billing_interval: 'per_lead',
  });

  const deposit = b.deposit_cents ?? PPL_DEFAULTS.reloadAmountCents;
  const checkout = await createDepositCheckout(account, deposit);
  return NextResponse.json({
    account,
    deposit_cents: deposit,
    checkout_url: checkout.url,
    statement_url: statementUrl(account.id, publicBaseUrl()),
  });
}
