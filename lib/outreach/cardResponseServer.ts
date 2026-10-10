// lib/outreach/cardResponseServer.ts
//
// Load the postcard response funnel (lib/outreach/cardResponse.ts) from the live tables, per
// card kind. `kind` null → every real card (the pre-2026-10-10 behaviour); the ops dashboard
// asks for 'trade_claim' and 'evolve' separately, because a response rate is per card.
import { supabaseAdmin } from '@/lib/supabase/admin';
import { computeCardResponse, type CardMailingRow, type CardProspectRow, type CardResponse } from '@/lib/outreach/cardResponse';

export const EMPTY_CARD_RESPONSE: CardResponse = {
  mailed: 0, arrived: 0, delivered: 0, returned: 0, visited: 0, visits: 0, claimed: 0, preDeliveryVisited: 0,
  firstVisitAt: null, lastVisitAt: null, byMetro: [], byDay: [],
};

export async function loadCardResponse(today = new Date().toISOString().slice(0, 10), kind: string | null = null): Promise<CardResponse> {
  const db = supabaseAdmin as any;
  let q = db
    .from('postcard_mailings')
    .select('prospect_id, kind, created_at, status, expected_delivery_date, delivered_at, returned_at')
    .neq('status', 'test')
    .not('prospect_id', 'is', null)
    .limit(5000);
  if (kind) q = q.eq('kind', kind);
  const { data: mailings } = await q;
  const rows = (mailings ?? []) as CardMailingRow[];
  if (!rows.length) return EMPTY_CARD_RESPONSE;
  const ids = [...new Set(rows.map((m) => m.prospect_id!))];
  const { data: prospects } = await db
    .from('outreach_prospects')
    .select('id, city, region, claim_link_visits, claim_link_visited_at, claimed_at')
    .in('id', ids);
  return computeCardResponse(rows, (prospects ?? []) as CardProspectRow[], today, kind);
}
