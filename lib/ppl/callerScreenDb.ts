// lib/ppl/callerScreenDb.ts — the DB half of caller screening (pure rules: lib/ppl/callerScreen.ts).
import { supabaseAdmin } from '@/lib/supabase/admin';
import { REPEAT_WINDOW_DAYS, repeatPatternDecision, screenKey, type PriorCall, type ScreenMode } from '@/lib/ppl/callerScreen';

export type ScreenRow = {
  number: string;
  reason: 'vendor_voicemail' | 'operator' | 'repeat_pattern';
  /** 'screen' = offered voicemail; 'block' = rejected unanswered (migration 20260903). */
  mode: ScreenMode;
  evidence: string | null;
  source_call_id: string | null;
  created_by: string | null;
  created_at: string;
  released_at: string | null;
  released_by: string | null;
  release_note: string | null;
};

/** The active screen for a number, or null. ⚠️ Callers in the Twilio path wrap this in try/catch: a DB hiccup must never stop a forward. */
export async function activeScreen(number: string | null | undefined): Promise<ScreenRow | null> {
  const key = screenKey(number);
  if (!key) return null;
  const { data } = await supabaseAdmin.from('caller_screens').select('*').eq('number', key).is('released_at', null).maybeSingle();
  return (data as ScreenRow | null) ?? null;
}

/**
 * Put a number on the list (or re-activate a released one). Idempotent on an active row of the
 * same mode; an active SCREEN asked to become a BLOCK is upgraded in place (and a block asked to
 * become a screen is downgraded — a person changing their mind), with the new reason/evidence.
 */
export async function screenNumber(input: {
  number: string;
  reason: ScreenRow['reason'];
  mode?: ScreenMode;
  evidence?: string | null;
  sourceCallId?: string | null;
  createdBy?: string | null;
}): Promise<{ ok: true; key: string; created: boolean; mode: ScreenMode } | { ok: false; error: string }> {
  const key = screenKey(input.number);
  if (!key) return { ok: false, error: 'number_invalid' };
  const mode: ScreenMode = input.mode ?? 'screen';
  const existing = await activeScreen(key);
  if (existing) {
    if ((existing.mode ?? 'screen') === mode) return { ok: true, key, created: false, mode };
    const { error } = await supabaseAdmin
      .from('caller_screens')
      .update({ mode, reason: input.reason, evidence: (input.evidence ?? '').slice(0, 400) || existing.evidence, source_call_id: input.sourceCallId ?? existing.source_call_id, created_by: input.createdBy ?? existing.created_by })
      .eq('number', key)
      .is('released_at', null);
    if (error) return { ok: false, error: error.message };
    return { ok: true, key, created: false, mode };
  }
  const { error } = await supabaseAdmin.from('caller_screens').upsert(
    {
      number: key,
      reason: input.reason,
      mode,
      evidence: (input.evidence ?? '').slice(0, 400) || null,
      source_call_id: input.sourceCallId ?? null,
      created_by: input.createdBy ?? null,
      created_at: new Date().toISOString(),
      released_at: null,
      released_by: null,
      release_note: null,
    },
    { onConflict: 'number' },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true, key, created: true, mode };
}

/** This number's calls to any of our lines in the repeat window, oldest first (for repeatPatternDecision). */
export async function priorCallsFrom(number: string | null | undefined): Promise<PriorCall[]> {
  const key = screenKey(number);
  if (!key) return [];
  const since = new Date(Date.now() - REPEAT_WINDOW_DAYS * 86_400_000).toISOString();
  const { data } = await supabaseAdmin
    .from('call_logs')
    .select('to_number, call_status, call_duration, handling, recording_url, voicemail_speech, created_at')
    .eq('from_number', key)
    .gte('created_at', since)
    .order('created_at', { ascending: true })
    .limit(200);
  return (data ?? []) as PriorCall[];
}

/**
 * Block a number whose own call history proves a dialer (lib/ppl/callerScreen.ts#repeatPatternDecision).
 * Returns the verdict; writes only on `block`. ⚠️ Callers in the Twilio path wrap this in try/catch.
 */
export async function blockIfRepeatPattern(number: string | null | undefined, sourceCallId?: string | null) {
  const prior = await priorCallsFrom(number);
  const verdict = repeatPatternDecision(prior);
  if (!verdict.block) return verdict;
  const r = await screenNumber({ number: number ?? '', reason: 'repeat_pattern', mode: 'block', evidence: verdict.evidence, sourceCallId: sourceCallId ?? null });
  return r.ok ? verdict : { block: false as const, reason: 'too_few_calls' as const };
}

/** Lift a screen; the row stays, with who lifted it and why. */
export async function releaseNumber(input: { number: string; releasedBy?: string | null; note?: string | null }): Promise<{ ok: boolean; key: string | null }> {
  const key = screenKey(input.number);
  if (!key) return { ok: false, key: null };
  const { data, error } = await supabaseAdmin
    .from('caller_screens')
    .update({ released_at: new Date().toISOString(), released_by: input.releasedBy ?? null, release_note: (input.note ?? '').slice(0, 200) || null })
    .eq('number', key)
    .is('released_at', null)
    .select('number');
  return { ok: !error && !!data?.length, key };
}

export async function listScreens(): Promise<ScreenRow[]> {
  const { data } = await supabaseAdmin.from('caller_screens').select('*').order('created_at', { ascending: false }).limit(500);
  return (data ?? []) as ScreenRow[];
}
