// lib/outreach/mail/returnsList.ts
//
// The working list for someone holding a stack of returned postcards.
//
// ⚠️ IT MATCHES ON WHAT IS PRINTED ON THE CARD. `postcard_mailings.to_name` / `to_address` are
// the name and address Lob actually printed, which is what the operator is reading off the
// envelope in their hand. The prospect's CURRENT address may already have been corrected, so
// searching against that would fail to find exactly the card they are holding.
import { supabaseAdmin } from '@/lib/supabase/admin';

export type ReturnRow = {
  id: string;
  prospect_id: string | null;
  /** Which card (trade_claim / competition / evolve / guest). */
  kind: string | null;
  to_name: string | null;
  to_address: string | null;
  created_at: string;
  expected_delivery_date: string | null;
  returned_at: string | null;
  return_reason: string | null;
  status: string;
  /** From the prospect, for context and for re-sending. */
  business_name: string | null;
  city: string | null;
  region: string | null;
  current_address: string | null;
  closed_at: string | null;
  closed_reason: string | null;
  phone: string | null;
};

export type ReturnsList = {
  /** Mailed, not yet marked returned — the pile the operator is working against. */
  open: ReturnRow[];
  /** Already marked, newest first. Kept visible so a mis-click can be corrected. */
  returned: ReturnRow[];
};

export async function loadReturnsList(limit = 400): Promise<ReturnsList> {
  const { data: mailings, error } = await supabaseAdmin
    .from('postcard_mailings')
    .select(
      'id, prospect_id, kind, to_name, to_address, created_at, expected_delivery_date, returned_at, return_reason, status',
    )
    // ⚠️ Test rows are excluded here rather than in the UI: they are indistinguishable from real
    // ones by eye, and marking a test card "out of business" would close a real prospect.
    .neq('status', 'test')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error || !mailings) return { open: [], returned: [] };

  const ids = [...new Set(mailings.map((m: any) => m.prospect_id).filter(Boolean))] as string[];
  const byId = new Map<string, any>();
  if (ids.length) {
    const { data: prospects } = await supabaseAdmin
      .from('outreach_prospects')
      .select('id, business_name, city, region, address, closed_at, closed_reason, phone')
      .in('id', ids);
    for (const p of prospects ?? []) byId.set((p as any).id, p);
  }

  const rows: ReturnRow[] = mailings.map((m: any) => {
    const p = m.prospect_id ? byId.get(m.prospect_id) : null;
    return {
      id: m.id,
      prospect_id: m.prospect_id,
      kind: m.kind ?? null,
      to_name: m.to_name,
      to_address: m.to_address,
      created_at: m.created_at,
      expected_delivery_date: m.expected_delivery_date,
      returned_at: m.returned_at,
      return_reason: m.return_reason,
      status: m.status,
      business_name: p?.business_name ?? null,
      city: p?.city ?? null,
      region: p?.region ?? null,
      current_address: p?.address ?? null,
      closed_at: p?.closed_at ?? null,
      closed_reason: p?.closed_reason ?? null,
      phone: p?.phone ?? null,
    };
  });

  return {
    open: rows.filter((r) => !r.returned_at),
    returned: rows.filter((r) => !!r.returned_at),
  };
}
