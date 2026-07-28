// app/api/persona-findings/route.ts
//
// Receiver for cross-mesh persona testing (crosstalk/contracts/persona-testing.md, Phase 0).
// HiveJournal runs a backstoried, cost-capped browsing persona against a PUBLIC QuickSites
// surface with a first-time-visitor goal, then POSTs what it actually experienced here.
//
// The bug class this targets: *merged, looked correct, silently wasn't* — nine instances
// across the mesh in a day, every one green on typecheck, tests and review. Playwright
// asserts what you told it to check; a persona notices what you didn't think to.
//
// ── THREE RULES, ALL LOAD-BEARING ────────────────────────────────────────────────────────
//
// 1. **Findings land at `status:'triage'`, never `'open'`.** A persona finding is a CLAIM
//    until a human agrees. `open` reads as confirmed work, so one bad session would flood the
//    real queue and it would stop being trusted — the cry-wolf failure the mesh hit three
//    times in a day, just slower. The DB enforces this: migration 20260808 added 'triage' to
//    admin_tasks_status_check, and this route hard-codes it rather than trusting the payload.
//
// 2. **Attribution is written into the record, not painted on a UI.** `source` carries
//    `persona-browse:<persona_id>` and the task body opens with the honesty note. Same
//    standard as audio (`voice_basis`) and imagery (rule 9): an AI-generated artifact is
//    labeled as such at creation. A finding that reads like a human bug report and isn't is
//    the same dishonesty, in a new medium.
//
// 3. **`honesty_note` is surfaced, never stripped.** The contract fixes its wording; we
//    render it verbatim and fall back to our own copy if a payload omits it.
//
// Auth: a shared secret in `X-Persona-Findings-Secret`, compared in constant time.
// FAIL CLOSED — if `PERSONA_FINDINGS_SECRET` is unset the route 503s rather than accepting
// anonymous writes. HJ degrades gracefully (logs, no error) when it can't post.

import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { rateLimitOr429 } from '@/lib/api/rateLimitGuard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FALLBACK_HONESTY_NOTE =
  'AI persona observation — behaves as a real person would; not a human tester.';

type Issue = {
  kind?: string;
  detail?: string;
  url?: string;
  severity?: 'low' | 'med' | 'high';
  // How the persona came by this issue (HJ #1660). `encountered` = friction it hit directly;
  // `searched_not_found` = an ABSENCE it looked for and didn't find. The second is weaker
  // evidence — "I couldn't find X" is indistinguishable from "I didn't look" — so we label it
  // in the record rather than letting both read identically to whoever triages it.
  evidence?: 'encountered' | 'searched_not_found';
};

/** Render the evidence class, but only when it's the weak one — noise otherwise. */
function evidenceTag(e: Issue['evidence']): string {
  return e === 'searched_not_found' ? ' _(searched for, not found)_' : '';
}

/** Constant-time compare so the secret can't be recovered by timing the response. */
function secretOk(provided: string | null): boolean {
  const expected = process.env.PERSONA_FINDINGS_SECRET || '';
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** high > med > low; a blocked/error outcome raises the floor. */
export function priorityFor(issues: Issue[], outcome?: string): 'low' | 'medium' | 'high' {
  if (issues.some((i) => i.severity === 'high')) return 'high';
  if (outcome === 'blocked' || outcome === 'error') return 'high';
  if (issues.some((i) => i.severity === 'med')) return 'medium';
  return 'low';
}

export async function POST(req: Request) {
  // Fail closed: no secret configured means this endpoint is not open for business.
  if (!process.env.PERSONA_FINDINGS_SECRET) {
    return NextResponse.json({ ok: false, error: 'receiver_not_configured' }, { status: 503 });
  }
  if (!secretOk(req.headers.get('x-persona-findings-secret'))) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  // Even an authenticated partner gets a ceiling — a runaway loop on their side must not be
  // able to fill our task table.
  const limited = await rateLimitOr429(req, 'persona-findings', 60, 3600);
  if (limited) return limited;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const personaId = String(body?.persona?.id ?? '').trim();
  const personaName = String(body?.persona?.display_name ?? 'unknown persona').trim();
  const goal = String(body?.goal ?? '').trim();
  const url = String(body?.url ?? '').trim();
  const outcome = String(body?.outcome ?? '').trim();
  const summary = String(body?.summary ?? '').trim();
  const issues: Issue[] = Array.isArray(body?.issues) ? body.issues.slice(0, 50) : [];

  if (!goal || !url || !summary) {
    return NextResponse.json(
      { ok: false, error: 'goal, url and summary are required' },
      { status: 400 },
    );
  }

  // Rule 3: surface the honesty note verbatim; supply our own if the payload omits it.
  const honesty = String(body?.honesty_note ?? '').trim() || FALLBACK_HONESTY_NOTE;

  const outcomeLabel =
    outcome === 'achieved' ? '✅ achieved'
    : outcome === 'gave_up' ? '🚪 gave up'
    : outcome === 'blocked' ? '⛔ blocked'
    : outcome === 'error' ? '💥 error'
    : outcome || 'unknown';

  const details = [
    `⚠️ ${honesty}`,
    '',
    `**Persona:** ${personaName}${personaId ? ` (${personaId})` : ''}`,
    `**Goal:** ${goal}`,
    `**Surface:** ${url}`,
    `**Outcome:** ${outcomeLabel}`,
    '',
    '**What happened**',
    summary,
    ...(issues.length
      ? [
          '',
          `**Issues reported (${issues.length})**`,
          ...issues.map(
            (i) =>
              `- [${i.severity ?? 'low'}] ${i.kind ?? 'other'}${evidenceTag(i.evidence)} — ${i.detail ?? '(no detail)'}` +
              (i.url && i.url !== url ? ` (${i.url})` : ''),
          ),
        ]
      : ['', '_No specific issues reported._']),
    '',
    `_session: ${Number(body?.steps) || 0} steps, ${Number(body?.cost_cents) || 0}¢ — a CLAIM awaiting human confirmation, not confirmed work._`,
  ].join('\n');

  const title = `[persona] ${personaName}: ${goal}`.slice(0, 180);

  const { data, error } = await supabaseAdmin
    .from('admin_tasks')
    .insert({
      title,
      details,
      // Rule 1: hard-coded, never taken from the payload. A partner cannot file directly
      // into the real work queue even by sending status:'open'.
      status: 'triage',
      priority: priorityFor(issues, outcome),
      category: 'persona-testing',
      // Rule 2: provenance in the record.
      source: personaId ? `persona-browse:${personaId}` : 'persona-browse',
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, task_id: data?.id, status: 'triage' });
}
