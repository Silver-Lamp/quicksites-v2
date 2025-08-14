import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: NextRequest) {
  const key = req.headers.get('x-cron-key');
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const MAX = 200;

  // Pull PENDING first, then FAILED with few attempts
  const { data: pending } = await db
    .from('email_outbox')
    .select('*')
    .in('status', ['pending', 'failed'])
    .lt('attempts', 5)
    .order('created_at', { ascending: true })
    .limit(MAX);

  if (!pending?.length) return NextResponse.json({ ok: true, sent: 0 });

  const { sendEmail } = await import('@/lib/email');

  let sent = 0;
  for (const msg of pending) {
    try {
      await sendEmail({ to: msg.to_email, subject: msg.subject, html: msg.html });
      await db.from('email_outbox').update({
        status: 'sent', attempts: (msg.attempts ?? 0) + 1, error: null, sent_at: new Date().toISOString()
      }).eq('id', msg.id);

      if (msg.subscription_id) {
        await db.from('waitlist_subscriptions')
          .update({ status: 'notified', notified_at: new Date().toISOString() })
          .eq('id', msg.subscription_id)
          .neq('status', 'unsubscribed');
      }
      sent += 1;
    } catch (e:any) {
      await db.from('email_outbox').update({
        status: 'failed', attempts: (msg.attempts ?? 0) + 1, error: String(e?.message || e)
      }).eq('id', msg.id);
    }
  }

  return NextResponse.json({ ok: true, sent });
}
