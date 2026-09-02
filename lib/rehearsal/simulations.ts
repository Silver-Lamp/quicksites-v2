// lib/rehearsal/simulations.ts
//
// A fixed script of practice turns, run against the live engine and recorded.
//
// ⚠️ THE FALSE-POSITIVE SCENARIOS ARE THE POINT, NOT THE PADDING.
// It is easy to check that a coach flags a promise. What decides whether anyone keeps using it is
// whether it stays quiet on an honest line — a coach that flags a correct answer trains a rep to
// ignore it, which is worse than no coach, and it is the failure nobody tests for because the
// output looks like diligence.
//
// So the set is deliberately half-and-half: three lines that break a rule and two that break
// none. `expectedRuleId: null` means "we expect silence here", and silence is a result.
//
// ⚠️ Our expectation is not ground truth. A mismatch is a thing to look at — the transcript is
// how you find out whether the engine missed something or our expectation was wrong.
import { randomUUID } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { GEO_DOMAIN_RENTAL_LANE as LANE } from '@/lib/sales/lanes/geoDomainRental';
import { runPracticeTurn, type TranscriptTurn } from '@/lib/rehearsal/turn';

export type Scenario = {
  key: string;
  label: string;
  /** What this scenario is trying to find out. Shown on the page. */
  tests: string;
  archetypeId: string;
  transcript: TranscriptTurn[];
  repSaid: string;
  /** The rule we expect to fire, or null if we expect the engine to stay quiet. */
  expectedRuleId: string | null;
};

export const SCENARIOS: Scenario[] = [
  {
    key: 'promise_ranking',
    label: 'Promises a ranking',
    tests: 'The flagship rule. Does the engine catch the one thing the brief is strict about?',
    archetypeId: 'burned-by-seo',
    transcript: [
      { who: 'rep', text: "Hi, is this the owner? It'll take a minute and it's not a website pitch." },
      { who: 'prospect', text: 'I paid an SEO guy for a year and got nothing out of it.' },
    ],
    repSaid:
      "I hear you, but this is different — this'll get you on page one for towing in Renton inside a month, guaranteed.",
    expectedRuleId: 'no_ranking_promise',
  },
  {
    key: 'invented_urgency',
    label: 'Invents a competing buyer',
    tests: 'A subtler rule than the ranking one, and the most tempting lie on a slow call.',
    archetypeId: 'towing-no-website',
    transcript: [{ who: 'prospect', text: "I'd have to think about it." }],
    repSaid:
      "Sure — only thing is I've got another towing company in Renton looking at this exact domain right now, and the price goes up Friday.",
    expectedRuleId: 'no_invented_urgency',
  },
  {
    key: 'claims_on_their_behalf',
    label: 'Offers to invent their credentials',
    tests:
      'The rule that reads mildest and matters most: putting claims on a real business that it never made.',
    archetypeId: 'has-a-site-nephew-built',
    transcript: [{ who: 'prospect', text: "What would even go on it? I've got a site already." }],
    repSaid:
      "We'll write it for you — licensed and insured, we respond within the hour, a few five-star reviews to fill it out.",
    expectedRuleId: 'no_claims_on_their_behalf',
  },
  {
    key: 'honest_open',
    label: 'The scripted open, said honestly',
    tests:
      'FALSE POSITIVE CHECK. A coach that flags a correct line teaches a rep to ignore it. Silence is the pass here.',
    archetypeId: 'towing-no-website',
    transcript: [],
    repSaid:
      "Is this the owner? This'll take a minute and it's not a website pitch — do you have a browser in front of you? Type in renton-towing.com. That one's ours, and nobody has it yet.",
    expectedRuleId: null,
  },
  {
    key: 'honest_ranking_answer',
    label: 'Answers "does it rank?" honestly',
    tests:
      'FALSE POSITIVE CHECK, and the hard one: the honest answer to the ranking question mentions page one as a PRICE fact. Does the engine tell the difference?',
    archetypeId: 'burned-by-seo',
    transcript: [{ who: 'prospect', text: 'Does it come up on Google?' }],
    repSaid:
      "Not yet — it's new, and I'm not going to promise you it will. What I can tell you is it's ninety-nine now and three-ninety-nine once one of these reaches page one, and if you're in at ninety-nine you stay there.",
    expectedRuleId: null,
  },
];

export type SimulationRow = {
  run_id: string;
  scenario_key: string;
  scenario_label: string;
  tests: string;
  archetype_id: string;
  transcript: TranscriptTurn[];
  rep_said: string;
  expected_rule_id: string | null;
  status: 'ok' | 'error';
  error: string | null;
  prospect_line: string | null;
  objection_id: string | null;
  call_state: string | null;
  coaching: string | null;
  honesty_flags: unknown[];
  flags_dropped: number | null;
  isolating: boolean[] | null;
  would_keep_listening: string | null;
  cost_cents: number | null;
  latency_ms: number | null;
};

/**
 * Runs the set sequentially and records every turn, errors included.
 *
 * Sequential on purpose: five parallel calls against a partner API to save eight seconds is a
 * way to discover a rate limit with real money, and nothing here is waiting on the result.
 */
export async function runSimulationSet(opts?: { only?: string[] }): Promise<{
  runId: string;
  rows: SimulationRow[];
}> {
  const runId = randomUUID();
  const scenarios = opts?.only?.length
    ? SCENARIOS.filter((s) => opts.only!.includes(s.key))
    : SCENARIOS;
  const rows: SimulationRow[] = [];

  for (const s of scenarios) {
    const outcome = await runPracticeTurn({
      repSaid: s.repSaid,
      archetypeId: s.archetypeId,
      transcript: s.transcript,
    });

    const base = {
      run_id: runId,
      scenario_key: s.key,
      scenario_label: s.label,
      tests: s.tests,
      archetype_id: s.archetypeId,
      transcript: s.transcript,
      rep_said: s.repSaid,
      expected_rule_id: s.expectedRuleId,
    };

    if (!outcome.ok) {
      rows.push({
        ...base,
        status: 'error',
        error: outcome.error,
        prospect_line: null,
        objection_id: null,
        call_state: null,
        coaching: null,
        honesty_flags: [],
        flags_dropped: null,
        isolating: null,
        would_keep_listening: null,
        cost_cents: null,
        latency_ms: outcome.latencyMs,
      });
      continue;
    }

    const r = outcome.result;
    rows.push({
      ...base,
      status: 'ok',
      error: null,
      prospect_line: r.prospect_line ?? null,
      objection_id: r.objection_id ?? null,
      call_state: r.call_state ?? null,
      coaching: r.coaching ?? null,
      honesty_flags: r.honesty_flags ?? [],
      flags_dropped: typeof r.flags_dropped === 'number' ? r.flags_dropped : null,
      isolating: outcome.isolating,
      would_keep_listening: r.would_keep_listening ?? null,
      // The engine reports fractional cents; anything else is unknown, never zero.
      cost_cents:
        typeof r.usage?.cost_cents === 'number' && Number.isFinite(r.usage.cost_cents)
          ? r.usage.cost_cents
          : null,
      latency_ms: outcome.latencyMs,
    });
  }

  if (rows.length) {
    const { error } = await (supabaseAdmin as any).from('rehearsal_simulations').insert(rows);
    if (error) throw new Error(`simulations ran but could not be recorded: ${error.message}`);
  }
  return { runId, rows };
}

/** The most recent run, newest first. */
export async function loadLatestRun(): Promise<SimulationRow[]> {
  try {
    const { data } = await (supabaseAdmin as any)
      .from('rehearsal_simulations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);
    const runId = data?.[0]?.run_id;
    if (!runId) return [];
    const { data: rows } = await (supabaseAdmin as any)
      .from('rehearsal_simulations')
      .select('*')
      .eq('run_id', runId)
      .order('created_at', { ascending: true });
    return (rows || []) as SimulationRow[];
  } catch {
    return [];
  }
}

/** Where the lane's rules live, for the page to name them. */
export const RULE_LABEL: Record<string, string> = Object.fromEntries(
  LANE.honestyRules.map((r) => [r.id, r.rule])
);
