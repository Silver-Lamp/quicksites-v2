// lib/outreach/touches.ts
//
// Outreach history: record what was sent, read it back, and work out who is waiting on a reply.
//
// ⚠️ THE "AWAITING REPLY" RULE IS COMPUTED, NEVER STORED. A stored flag is a second copy of a fact
// the touches already contain, and it goes stale the moment someone logs a reply without
// remembering to clear it. Derive it: the newest touch is outbound, and nothing inbound came
// after. That cannot disagree with the history because it IS the history.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type TouchDirection = 'outbound' | 'inbound';

export type OutreachTouch = {
  id: string;
  template_id: string | null;
  prospect_id: string | null;
  subject_label: string | null;
  direction: TouchDirection;
  channel: string;
  body: string;
  attachment_url: string | null;
  attachment_name: string | null;
  occurred_at: string;
  actor_id: string | null;
};

export type TouchSubject = {
  templateId?: string | null;
  prospectId?: string | null;
  subjectLabel?: string | null;
};

function db(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/** A touch with no body is not a record of anything. Enforced here as well as in the DB. */
export function validateTouch(input: { body?: string; channel?: string; direction?: string }): string | null {
  if (!input.body || !input.body.trim()) return 'Paste what was actually sent — a summary is not a record.';
  if (!input.channel || !input.channel.trim()) return 'Which channel was this?';
  if (input.direction !== 'outbound' && input.direction !== 'inbound') return 'Direction must be outbound or inbound.';
  return null;
}

export async function recordTouch(
  subject: TouchSubject,
  input: {
    direction: TouchDirection;
    channel: string;
    body: string;
    attachmentUrl?: string | null;
    attachmentName?: string | null;
    occurredAt?: string | null;
    actorId?: string | null;
  },
): Promise<OutreachTouch | null> {
  const s = db();
  if (!s) return null;
  const { data, error } = await s
    .from('outreach_touches')
    .insert({
      template_id: subject.templateId ?? null,
      prospect_id: subject.prospectId ?? null,
      subject_label: subject.subjectLabel ?? null,
      direction: input.direction,
      channel: input.channel.trim(),
      body: input.body,
      attachment_url: input.attachmentUrl ?? null,
      attachment_name: input.attachmentName ?? null,
      // Falls back to now, but an operator logging yesterday's call can say so.
      occurred_at: input.occurredAt || new Date().toISOString(),
      actor_id: input.actorId ?? null,
    })
    .select('*')
    .single();
  if (error) return null;
  return data as OutreachTouch;
}

/** History for one subject, newest first. */
export async function listTouches(subject: TouchSubject, limit = 100): Promise<OutreachTouch[]> {
  const s = db();
  if (!s) return [];
  let q = s.from('outreach_touches').select('*').order('occurred_at', { ascending: false }).limit(limit);
  if (subject.templateId) q = q.eq('template_id', subject.templateId);
  else if (subject.prospectId) q = q.eq('prospect_id', subject.prospectId);
  else if (subject.subjectLabel) q = q.eq('subject_label', subject.subjectLabel);
  else return [];
  const { data } = await q;
  return (data as OutreachTouch[]) ?? [];
}

/** Everything, newest first — the standalone log. */
export async function listAllTouches(limit = 300): Promise<OutreachTouch[]> {
  const s = db();
  if (!s) return [];
  const { data } = await s
    .from('outreach_touches')
    .select('*')
    .order('occurred_at', { ascending: false })
    .limit(limit);
  return (data as OutreachTouch[]) ?? [];
}

export type AwaitingReply = {
  subjectKey: string;
  label: string;
  lastOutbound: OutreachTouch;
  daysWaiting: number;
};

/**
 * Who was contacted and hasn't answered.
 *
 * ⚠️ SILENCE IS NOT A "NO", AND THIS MUST NOT PRETEND OTHERWISE. It reports how long since we
 * spoke last — nothing about intent. A prospect who has not replied in nine days may be busy, on
 * a roof, or uninterested, and the difference is not in this table. Naming the field `daysWaiting`
 * rather than `stale` or `ignored` is deliberate.
 */
export function awaitingReply(touches: OutreachTouch[], now = Date.now()): AwaitingReply[] {
  const bySubject = new Map<string, OutreachTouch[]>();
  for (const t of touches) {
    const key = t.template_id ?? t.prospect_id ?? t.subject_label ?? 'unknown';
    const list = bySubject.get(key) ?? [];
    list.push(t);
    bySubject.set(key, list);
  }

  const out: AwaitingReply[] = [];
  for (const [key, list] of bySubject) {
    const sorted = [...list].sort(
      (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
    );
    const newest = sorted[0];
    if (!newest || newest.direction !== 'outbound') continue; // they answered last — ball is ours
    out.push({
      subjectKey: key,
      label: newest.subject_label || newest.template_id || newest.prospect_id || key,
      lastOutbound: newest,
      daysWaiting: Math.floor((now - new Date(newest.occurred_at).getTime()) / 86_400_000),
    });
  }
  return out.sort((a, b) => b.daysWaiting - a.daysWaiting);
}
