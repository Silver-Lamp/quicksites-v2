// app/api/billing/estimate/route.ts
//
// Redacted cloud bill in → savings RANGE out, and a row the site owner can follow up.
//
// ⚠️ THE SERVER RE-REDACTS BEFORE IT STORES. The browser already struck the identifying parts
// (lib/billing/redactBill.ts) and the person approved exactly what was sent. This runs the SAME
// detector again on arrival and strikes anything still present.
//
// That is not distrust of the client — it is what turns "we only keep the redacted version" from
// a policy into a property. A client can be old, edited, or bypassed with curl; the promise has
// to survive all three, because the row it produces is read by a HUMAN THIRD PARTY (the site
// owner) and kept for analytics indefinitely (owner decision, 2026-08-02).
//
// ⚠️ NO RAW TEXT IS EVER PERSISTED, and `bill_estimates` has no column for it. If you are adding
// one, read the migration header first — the absent column is the guardrail.
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, clientIp } from '@/lib/rateLimit';
import { findIdentifiers, redact, summarise } from '@/lib/billing/redactBill';
import { estimateSavings } from '@/lib/billing/estimateSavings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_CHARS = 20_000;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}) as any);
  const submitted = String(body?.text ?? '').slice(0, MAX_CHARS);

  if (submitted.trim().length < 40) {
    return NextResponse.json(
      { error: 'Paste a bit more of the bill — line items and totals are what we read.', code: 'too_short' },
      { status: 400 },
    );
  }

  // A public endpoint that spends money on every call. Per-IP cap plus the global kill switch
  // below; the dollar guard in meterLLMCall is the backstop under both.
  const ip = clientIp(req);
  const limited = await checkRateLimit(
    `bill_estimate:${ip}`,
    Number(process.env.BILL_ESTIMATE_HOURLY_LIMIT_PER_IP || 5),
    3600,
  ).catch(() => ({ ok: true }) as any);
  if (!limited?.ok) {
    return NextResponse.json(
      { error: 'That’s a lot of estimates from one place. Try again in a bit.', code: 'rate_limited' },
      { status: 429 },
    );
  }

  if (process.env.BILL_ESTIMATE_ENABLED !== '1') {
    // Off by default: flipping this on starts billable model calls on a public surface.
    return NextResponse.json(
      { error: 'Estimates are not switched on yet.', code: 'disabled' },
      { status: 503 },
    );
  }

  // ⚠️ RE-REDACT. Never trust that what arrived is what the browser produced.
  const findings = findIdentifiers(submitted);
  const redacted = redact(submitted, findings);
  const counts = Object.fromEntries(summarise(findings).map((s) => [s.kind, s.count]));

  const estimate = await estimateSavings(redacted, null).catch(() => null);
  if (!estimate) {
    return NextResponse.json(
      { error: 'We couldn’t read enough from that to estimate anything.', code: 'unreadable' },
      { status: 422 },
    );
  }

  // Persist the REDACTED text only. `submitted` goes out of scope here and is never written.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (url && key) {
    const db = createClient(url, key, { auth: { persistSession: false } });
    await db
      .from('bill_estimates')
      .insert({
        template_id: typeof body?.templateId === 'string' ? body.templateId : null,
        redacted_text: redacted,
        redaction_counts: counts,
        estimate,
        contact_email: null, // asked for AFTER the estimate, never as a gate on seeing it
        model: 'gpt-4o-mini',
      } as any)
      .then(
        () => {},
        () => {}, // a failed write must not deny the person their estimate
      );
  }

  return NextResponse.json({ ok: true, estimate, redactedServerSide: findings.length });
}
