// lib/outreach/prospectOutreach.ts
//
// What has already happened to a prospect, for the surfaces that let a person act on it (the
// Evolve page's operator strip, the rep tables): the last text and DM we logged, and the latest
// real Evolve postcard. Owner, 2026-10-11: "click a button and add a note for 'texted them' …
// see if a postcard has been sent, and send a postcard from these areas as well."
//
// ⚠️ A touch is a RECORD, not a tally: the body stored is the message that was actually sent
// (lib/outreach/touches.ts#validateTouch refuses a summary). The buttons therefore post the
// exact draft they offered, and `textedAt` means "a text with this body was logged", nothing
// about delivery.
import { supabaseAdmin } from '@/lib/supabase/admin';

export type CardMark = { created_at: string; status: string; expected_delivery_date: string | null; delivered_at: string | null; returned_at: string | null; scans: number };
export type OutreachMarks = { textedAt: string | null; dmAt: string | null; card: CardMark | null };

const fmt = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '?' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

/** Pure: one line for a row — "mailed Oct 10 · in transit · 0 scans", or null when none was sent. */
export function postcardStatusLine(card: CardMark | null | undefined): string | null {
  if (!card) return null;
  const parts = [`mailed ${fmt(card.created_at)}`];
  if (card.returned_at) parts.push('returned');
  else if (card.delivered_at) parts.push(`delivered ${fmt(card.delivered_at)}`);
  else if (card.expected_delivery_date) parts.push(`arrives ~${fmt(card.expected_delivery_date)}`);
  else parts.push(card.status === 'created' || card.status === 'mailed' ? 'in transit' : card.status);
  parts.push(`${card.scans ?? 0} scan${card.scans === 1 ? '' : 's'}`);
  return parts.join(' · ');
}

/** Pure: the marks line for a row — "texted Oct 11 · DM Oct 11", or null. */
export function touchesLine(m: Pick<OutreachMarks, 'textedAt' | 'dmAt'>): string | null {
  const parts: string[] = [];
  if (m.textedAt) parts.push(`texted ${fmt(m.textedAt)}`);
  if (m.dmAt) parts.push(`DM ${fmt(m.dmAt)}`);
  return parts.length ? parts.join(' · ') : null;
}

/** Latest sms/dm touch and latest real Evolve card for each prospect id. */
export async function loadOutreachMarks(prospectIds: string[]): Promise<Map<string, OutreachMarks>> {
  const out = new Map<string, OutreachMarks>();
  const ids = Array.from(new Set(prospectIds.filter(Boolean)));
  if (!ids.length) return out;
  for (const id of ids) out.set(id, { textedAt: null, dmAt: null, card: null });
  const [{ data: touches }, { data: cards }] = await Promise.all([
    (supabaseAdmin as any).from('outreach_touches').select('prospect_id, channel, occurred_at').in('prospect_id', ids).eq('direction', 'outbound').in('channel', ['sms', 'dm']).order('occurred_at', { ascending: false }),
    (supabaseAdmin as any).from('postcard_mailings').select('prospect_id, created_at, status, expected_delivery_date, delivered_at, returned_at, scans').eq('kind', 'evolve').neq('status', 'test').in('prospect_id', ids).order('created_at', { ascending: false }),
  ]);
  for (const t of (touches ?? []) as Array<{ prospect_id: string; channel: string; occurred_at: string }>) {
    const m = out.get(t.prospect_id)!;
    if (t.channel === 'sms' && !m.textedAt) m.textedAt = t.occurred_at;
    if (t.channel === 'dm' && !m.dmAt) m.dmAt = t.occurred_at;
  }
  for (const c of (cards ?? []) as Array<CardMark & { prospect_id: string }>) {
    const m = out.get(c.prospect_id)!;
    if (!m.card) m.card = { created_at: c.created_at, status: c.status, expected_delivery_date: c.expected_delivery_date, delivered_at: c.delivered_at, returned_at: c.returned_at, scans: c.scans ?? 0 };
  }
  return out;
}
