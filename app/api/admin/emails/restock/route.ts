import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email';
import { Database } from '@/types/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function assertAdmin() {
  const supa = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return { code: 401 as const, error: 'Not signed in' };
  const { data: admin } = await supa.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle();
  if (!admin) return { code: 403 as const, error: 'Forbidden' };
  return { code: 200 as const, supa };
}

async function resolveMealId({ supa, meal_id, meal_slug, email }:{
  supa: ReturnType<typeof createRouteHandlerClient<Database>>;
  meal_id?: string; meal_slug?: string; email?: string;
}): Promise<string | null> {
  if (meal_id) return meal_id;
  if (meal_slug) {
    const { data } = await supa.from('meals').select('id').eq('slug', meal_slug).maybeSingle();
    return data?.id ?? null;
  }
  if (email) {
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const u = list?.users?.find(x => x.email?.toLowerCase() === email.toLowerCase());
    if (!u) return null;
    const { data: chef } = await supa.from('chefs').select('id').eq('user_id', u.id).maybeSingle();
    if (!chef) return null;
    const { data: meal } = await supa.from('meals').select('id').eq('chef_id', chef.id).order('created_at', { ascending: false }).maybeSingle();
    return meal?.id ?? null;
  }
  return null;
}

export async function POST(req: NextRequest) {
  const gate = await assertAdmin();
  if (gate.code !== 200) return NextResponse.json({ error: gate.error }, { status: gate.code });
  const supa = gate.supa!;

  const { meal_id, meal_slug, email, limit = 50 } = await req.json();
  const id = await resolveMealId({ supa, meal_id, meal_slug, email });
  if (!id) return NextResponse.json({ error: 'meal not found' }, { status: 404 });

  // Load pending outbox first; if none, generate from active waitlist on the fly
  const { data: pending } = await supa
    .from('email_outbox')
    .select('id, to_email, subject, html')
    .eq('meal_id', id)
    .eq('status', 'pending')
    .limit(Math.max(1, Math.min(500, Number(limit))));

  let sent = 0, failed = 0;

  if (pending?.length) {
    for (const row of pending) {
      const r = await sendEmail({ to: row.to_email, subject: row.subject, html: row.html });
      if (r.ok) {
        sent++;
        await supa.from('email_outbox').update({ status: 'sent', sent_at: new Date().toISOString() } as any).eq('id', row.id);
      } else {
        failed++;
        await supa.from('email_outbox').update({ status: 'failed', error_message: String((r as any).error || 'send failed') } as any).eq('id', row.id);
      }
    }
    return NextResponse.json({ ok: true, meal_id: id, sent, failed });
  }

  // If queue is empty, synthesize from active waitlist and send immediately
  const { data: subs } = await supa
    .from('waitlist_subscriptions')
    .select('id, email, token')
    .eq('meal_id', id)
    .in('status', ['active','queued'])
    .limit(Math.max(1, Math.min(500, Number(limit))));

  if (!subs?.length) return NextResponse.json({ ok: true, meal_id: id, sent: 0, note: 'no subscribers' });

  // Need meal title/slug for email template
  const { data: meal } = await supa.from('meals').select('title, slug').eq('id', id).maybeSingle();
  const baseUrl = process.env.APP_BASE_URL || '';
  const mealUrl = meal?.slug ? `${baseUrl}/meals/${meal.slug}` : `${baseUrl}/meal/${id}`;

  for (const s of subs) {
    const subject = `${meal?.title ?? 'Your meal'} is back in stock`;
    const html = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;">
        <h2>${meal?.title ?? 'The meal'} is back in stock!</h2>
        <p><a href="${mealUrl}" style="display:inline-block;padding:10px 14px;background:#111;color:#fff;border-radius:6px;text-decoration:none;">
          Order now
        </a></p>
        <p style="color:#555;font-size:12px;margin-top:24px">
          Don’t want these? <a href="${baseUrl}/unsubscribe?token=${s.token}">Unsubscribe</a>.
        </p>
      </div>`;
    const r = await sendEmail({ to: s.email, subject, html });
    if (r.ok) {
      sent++;
      await supa.from('waitlist_subscriptions').update({ status: 'notified' }).eq('id', s.id);
    } else {
      failed++;
    }
  }

  return NextResponse.json({ ok: true, meal_id: id, sent, failed });
}
