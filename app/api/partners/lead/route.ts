// app/api/partners/lead/route.ts
//
// EMAIL CAPTURE ON THE PARTNER EARNINGS CALCULATOR.
//
// `/partners/calculator` is the most qualified page on the marketing site: nobody models their
// residual on a GMV they made up. Until now it produced a number, the visitor closed the tab,
// and we learned nothing — the page could not tell an interested reseller from a bounce.
//
// ⚠️ THE NUMBERS COME WITH THE LEAD, AND THAT IS THE POINT. The email alone is a name on a list;
// the email beside "40 merchants, $18k average monthly GMV" is a conversation opener that needs
// no discovery call. They are stored in `notes` as plain text rather than new columns, because
// this is the first consumer and inventing schema for one caller is how tables rot.
//
// ⚠️ IT ASKS, IT DOES NOT GATE. The calculator keeps working without an email — the result is
// visible before the form and stays visible whatever happens to it. A door that hides a number
// the visitor already earned measures how badly they want it, not whether the offer is good, and
// it would poison the one signal this page produces. Same rule as the `cook_intent` probe.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimitOr429 } from '@/lib/api/rateLimitGuard';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
  { auth: { persistSession: false } },
);

/** Same shape as the claim flow's check — deliberately permissive, it is not an auth boundary. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanNumber(v: unknown, max: number): number | null {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(Math.round(n), max);
}

/** Bound a free-text field before it reaches the DB; never trust a client string's length. */
function cleanText(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

export async function POST(req: Request) {
  // Public, service-role, body-derived — throttle per IP like every other lead endpoint.
  const limited = await rateLimitOr429(req, 'partner_lead', 10, 3600);
  if (limited) return limited;

  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const email = cleanText(body.email, 200).toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Enter a valid email.' }, { status: 400 });
  }

  const merchants = cleanNumber(body.merchants, 100_000);
  const avgGmv = cleanNumber(body.avgGmv, 100_000_000);
  const monthly = cleanNumber(body.monthly, 100_000_000);
  const company = cleanText(body.company, 200);
  const name = cleanText(body.name, 200);

  // What they modelled, in words, so a reply can open with their own numbers.
  const parts = [
    merchants !== null ? `${merchants} merchants` : null,
    avgGmv !== null ? `$${avgGmv.toLocaleString()} avg monthly GMV each` : null,
    monthly !== null ? `modelled $${monthly.toLocaleString()}/mo residual` : null,
  ].filter(Boolean);
  const notes = `Partner calculator${parts.length ? ` — ${parts.join(', ')}` : ''}`;

  // ⚠️ Idempotent on email for THIS source. A visitor who re-runs the calculator with different
  // numbers should update their row, not mint a second lead — a duplicate here looks like two
  // interested resellers and would overstate the only demand signal the page has.
  const { data: existing } = await admin
    .from('leads')
    .select('id')
    .eq('email', email)
    .eq('source', 'partner_calculator')
    .limit(1);

  const row = {
    email,
    ...(company ? { business_name: company } : {}),
    ...(name ? { contact_name: name } : {}),
    outreach_status: 'new',
    source: 'partner_calculator',
    notes,
  };

  if (existing?.[0]?.id) {
    await admin.from('leads').update(row).eq('id', existing[0].id);
    return NextResponse.json({ ok: true, updated: true });
  }

  const { error } = await admin.from('leads').insert(row);
  if (error) {
    // Never echo a Postgres message to a public caller.
    console.error('[partners/lead] insert failed', error.message);
    return NextResponse.json({ error: 'Could not save that — try again.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, updated: false });
}
