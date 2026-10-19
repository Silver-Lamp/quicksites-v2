// app/admin/texts/page.tsx — every text thread with a business, and a place to write back.
//
// Owner, 2026-10-18: "let's add a UI so I can send from the browser". Threads are grouped by
// campaign (the business the forward-to belongs to), newest activity first, both directions;
// a composer per thread and a "new text" to any tracked line. Every send goes through the one
// operator route (reason 'operator_text', STOP honoured) and the one sender, so it is recorded
// and emailed like every other text. Admin only (the admin layout gates; the page re-checks).
import { redirect } from 'next/navigation';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { formatUsPhone } from '@/lib/phone/formatUs';
import TextsClient, { type Thread, type ThreadMessage, type LineOption } from './texts-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Texts — QuickSites admin', robots: { index: false, follow: false } };

export default async function TextsPage() {
  const admin = await getAdminUser();
  if (!admin) redirect('/');

  const [{ data: msgs }, { data: camps }] = await Promise.all([
    supabaseAdmin.from('sms_messages').select('id, received_at, from_number, to_number, body, direction, kind, reason, ok, error, geo_campaign_id, business_name').order('received_at', { ascending: false }).limit(600),
    supabaseAdmin.from('geo_industry_campaigns').select('id, domain, city, region, forward_to, forward_to_name, pitch_texted_at, pitch_result').not('tracking_number', 'is', null).not('forward_to', 'is', null).order('domain'),
  ]);
  const campById = new Map((camps ?? []).map((c) => [c.id, c]));

  // Group by campaign, else by the other party's number.
  const threads = new Map<string, Thread>();
  for (const m of msgs ?? []) {
    const other = m.direction === 'in' ? m.from_number : m.to_number;
    const key = m.geo_campaign_id ?? `num:${other ?? 'unknown'}`;
    const c = m.geo_campaign_id ? campById.get(m.geo_campaign_id) : null;
    const t = threads.get(key) ?? {
      key,
      campaignId: m.geo_campaign_id ?? null,
      business: c?.forward_to_name ?? m.business_name ?? null,
      domain: c?.domain ?? null,
      number: c?.forward_to ?? other ?? null,
      numberDisplay: formatUsPhone(c?.forward_to ?? other ?? null),
      lastAt: m.received_at,
      unansweredInbound: false,
      messages: [] as ThreadMessage[],
    };
    t.messages.push({ id: m.id, at: m.received_at, body: m.body, direction: m.direction as 'in' | 'out', kind: m.kind, reason: m.reason, ok: m.ok, error: m.error });
    threads.set(key, t);
  }
  for (const t of threads.values()) {
    t.messages.sort((a, b) => a.at.localeCompare(b.at));
    const last = t.messages[t.messages.length - 1];
    t.unansweredInbound = !!last && last.direction === 'in' && last.kind === 'reply';
  }
  const list = Array.from(threads.values()).sort((a, b) => Number(b.unansweredInbound) - Number(a.unansweredInbound) || b.lastAt.localeCompare(a.lastAt));

  const lines: LineOption[] = (camps ?? []).map((c) => ({ campaignId: c.id, label: `${c.forward_to_name || formatUsPhone(c.forward_to)} — ${c.domain}`, domain: c.domain, business: c.forward_to_name, number: formatUsPhone(c.forward_to), pitched: !!c.pitch_texted_at }));

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 text-foreground">
      <h1 className="text-2xl font-semibold">Texts</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Every text between this system and a business, both directions, by thread. Write back here; it goes from the same number they already know, is recorded, and emails you a copy. STOP is honoured. No text is ever sent to a caller.
      </p>
      <TextsClient threads={list} lines={lines} />
    </main>
  );
}
