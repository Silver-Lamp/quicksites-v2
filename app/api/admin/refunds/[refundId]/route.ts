// /app/api/admin/refunds/[refundId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { issueRefund } from '@/lib/refunds';

export const runtime='nodejs'; export const dynamic='force-dynamic';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Assume you have your own auth middleware to assert admin/merchant ownership.

export async function PATCH(req: NextRequest, { params }:{ params:{ refundId:string } }) {
  const body = await req.json();
  const { action, approvedCents, note } = body; // 'approve'|'deny'|'execute'
  const { data: r } = await db.from('refunds').select('*').eq('id', params.refundId).maybeSingle();
  if (!r) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (action === 'approve') {
    await db.from('refunds').update({ status: 'approved', approved_cents: approvedCents ?? r.requested_cents, notes: note || null })
      .eq('id', r.id);
    await db.from('refund_events').insert({ refund_id: r.id, actor_role: 'admin', action: 'approve', detail: note || '' });
    return NextResponse.json({ ok: true });
  }

  if (action === 'deny') {
    await db.from('refunds').update({ status: 'denied', notes: note || null }).eq('id', r.id);
    await db.from('refund_events').insert({ refund_id: r.id, actor_role: 'admin', action: 'deny', detail: note || '' });
    return NextResponse.json({ ok: true });
  }

  if (action === 'execute') {
    if (r.status !== 'approved') return NextResponse.json({ error: 'Must be approved first' }, { status: 400 });
    const amount = r.approved_cents ?? r.requested_cents;
    const idempotencyKey = `refund-${r.id}`;
    try {
      await db.from('refunds').update({ status: 'processing' }).eq('id', r.id);
      const { providerRefundId } = await issueRefund({
        provider: r.payment_provider as any,
        paymentId: r.provider_payment_id!,
        amountCents: amount,
        idempotencyKey
      });
      await db.from('refunds').update({ status: 'refunded', provider_refund_id: providerRefundId }).eq('id', r.id);
      await db.from('refund_events').insert({ refund_id: r.id, actor_role: 'system', action: 'execute', detail: providerRefundId });
      // Optionally: mark support ticket resolved
      await db.from('support_tickets').update({ status: 'refunded' }).eq('order_id', r.order_id);
      // Optionally: increment stock back (restock_on_refund flag)
      return NextResponse.json({ ok: true, providerRefundId });
    } catch (e:any) {
      await db.from('refunds').update({ status: 'failed', notes: String(e?.message || e) }).eq('id', r.id);
      await db.from('refund_events').insert({ refund_id: r.id, actor_role: 'system', action: 'fail', detail: String(e?.message || e) });
      return NextResponse.json({ error: 'Refund failed' }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
}
