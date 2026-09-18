// app/api/admin/ppl/accounts/[id]/route.ts
//
// GET   → one account with its recent ledger.
// PATCH → operator edits: price, thresholds, contact, pause/resume, or a manual ledger post
//         (a dispute credit or an adjustment). A credit against a call_sid records which lead it
//         reverses; approving a dispute is `{ credit: { call_sid, memo } }`.
// POST  → { action: 'deposit_link', deposit_cents } mints a fresh Checkout link.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/requireUser';
import { getPplAccount, listLedger, postLedger, updatePplAccount } from '@/lib/ppl/accounts';
import { billingPortalUrl, createDepositCheckout } from '@/lib/ppl/billing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Patch = z.object({
  cpl_cents: z.number().int().positive().max(100_000).optional(),
  min_billable_seconds: z.number().int().min(0).max(600).optional(),
  reload_threshold_cents: z.number().int().min(0).optional(),
  reload_amount_cents: z.number().int().positive().max(1_000_000).optional(),
  auto_reload: z.boolean().optional(),
  contact_email: z.string().email().nullable().optional(),
  contact_phone: z
    .string()
    .regex(/^\+[1-9]\d{7,14}$/)
    .nullable()
    .optional(),
  status: z.enum(['active', 'paused', 'closed']).optional(),
  credit: z
    .object({
      amount_cents: z.number().int().positive().max(1_000_000).optional(),
      call_sid: z.string().optional(),
      kind: z.enum(['dispute_credit', 'adjustment']).default('dispute_credit'),
      memo: z.string().max(500).optional(),
    })
    .optional(),
});

const Action = z.object({
  action: z.literal('deposit_link'),
  deposit_cents: z.number().int().min(100).max(1_000_000),
});

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;
  const { id } = await ctx.params;
  const account = await getPplAccount(id);
  if (!account) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const ledger = await listLedger(id);
  return NextResponse.json({ account, ledger, portal_url: await billingPortalUrl(account) });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;
  const { id } = await ctx.params;
  const account = await getPplAccount(id);
  if (!account) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: 'invalid body', issues: parsed.error.issues },
      { status: 400 }
    );
  const { credit, status, ...fields } = parsed.data;

  const patch: Parameters<typeof updatePplAccount>[1] = { ...fields };
  if (status) {
    patch.status = status;
    patch.paused_reason = status === 'paused' ? 'operator' : null;
    patch.paused_at = status === 'paused' ? new Date().toISOString() : null;
  }
  if (Object.keys(patch).length) await updatePplAccount(id, patch);

  let posted = null;
  if (credit) {
    // Default credit = one lead at the account's price (the common case: an approved dispute).
    posted = await postLedger({
      account_id: id,
      kind: credit.kind,
      amount_cents: credit.amount_cents ?? account.cpl_cents,
      call_sid: credit.call_sid ?? null,
      memo: credit.memo ?? (credit.kind === 'dispute_credit' ? 'Dispute approved' : 'Adjustment'),
      created_by: gate.user.id,
    });
  }
  return NextResponse.json({ ok: true, account: await getPplAccount(id), posted });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;
  const { id } = await ctx.params;
  const account = await getPplAccount(id);
  if (!account) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const parsed = Action.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: 'invalid body', issues: parsed.error.issues },
      { status: 400 }
    );
  const checkout = await createDepositCheckout(account, parsed.data.deposit_cents);
  return NextResponse.json({ checkout_url: checkout.url });
}
