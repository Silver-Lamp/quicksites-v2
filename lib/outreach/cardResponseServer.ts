// lib/outreach/cardResponseServer.ts — fetch the rows lib/outreach/cardResponse.ts aggregates.
import { supabaseAdmin } from '@/lib/supabase/admin';
import { computeCardResponse, type CardMailingRow, type CardProspectRow, type CardResponse } from '@/lib/outreach/cardResponse';

const EMPTY: CardResponse = {
  mailed: 0, arrived: 0, delivered: 0, returned: 0, visited: 0, visits: 0, claimed: 0, preDeliveryVisited: 0,
  firstVisitAt: null, lastVisitAt: null, byMetro: [], byDay: [],
};

export async function loadCardResponse(today = new Date().toISOString().slice(0, 10)): Promise<CardResponse> {
  const db = supabaseAdmin as any;
  const { data: mailings } = await db
    .from('postcard_mailings')
    .select('prospect_id, created_at, status, expected_delivery_date, delivered_at, returned_at')
    .neq('status', 'test')
    .not('prospect_id', 'is', null)
    .limit(5000);
  const rows = (mailings ?? []) as CardMailingRow[];
  if (!rows.length) return EMPTY;
  const ids = [...new Set(rows.map((m) => m.prospect_id!))];
  const { data: prospects } = await db
    .from('outreach_prospects')
    .select('id, city, region, claim_link_visits, claim_link_visited_at, claimed_at')
    .in('id', ids);
  return computeCardResponse(rows, (prospects ?? []) as CardProspectRow[], today);
}
