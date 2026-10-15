// lib/ppl/callerScreenDb.ts — the DB half of caller screening (pure rules: lib/ppl/callerScreen.ts).
import { supabaseAdmin } from '@/lib/supabase/admin';
import { screenKey } from '@/lib/ppl/callerScreen';

export type ScreenRow = {
  number: string;
  reason: 'vendor_voicemail' | 'operator';
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

/** Put a number on the list (or re-activate a released one). Idempotent on an active row. */
export async function screenNumber(input: { number: string; reason: ScreenRow['reason']; evidence?: string | null; sourceCallId?: string | null; createdBy?: string | null }): Promise<{ ok: true; key: string; created: boolean } | { ok: false; error: string }> {
  const key = screenKey(input.number);
  if (!key) return { ok: false, error: 'number_invalid' };
  const existing = await activeScreen(key);
  if (existing) return { ok: true, key, created: false };
  const { error } = await supabaseAdmin.from('caller_screens').upsert(
    {
      number: key,
      reason: input.reason,
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
  return { ok: true, key, created: true };
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
