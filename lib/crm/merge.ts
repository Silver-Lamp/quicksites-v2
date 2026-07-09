// lib/crm/merge.ts
//
// Server-side customer merge (CRM_PLAN.md Phase 2). Validates that the survivor +
// every loser belong to the given merchant, then folds the losers into the survivor
// via the merge_customers RPC (repoints orders/campaign sends, sums rollups, unions
// tags, deletes losers). `svc` is a service-role client — customers is deny-default
// RLS, so both the pre-check read and the RPC run service-role; the caller is
// responsible for the merchant-owner authorization gate.

export type MergeResult = { ok: true; survivorId: string; merged: number };
export type MergeError = { ok: false; error: string; status: number };

const MAX_LOSERS = 50; // a single merge folds at most this many rows

export async function mergeCustomers(
  svc: any,
  opts: { merchantId: string; survivorId: string; loserIds: string[] }
): Promise<MergeResult | MergeError> {
  const { merchantId, survivorId } = opts;
  if (!merchantId || !survivorId)
    return { ok: false, error: 'merchant and survivor required', status: 400 };

  // De-dupe + drop the survivor from the loser set.
  const losers = Array.from(new Set((opts.loserIds || []).filter((id) => id && id !== survivorId)));
  if (losers.length === 0)
    return { ok: false, error: 'no distinct customers to merge', status: 400 };
  if (losers.length > MAX_LOSERS)
    return { ok: false, error: `merge is capped at ${MAX_LOSERS} rows`, status: 400 };

  // Confirm every id (survivor + losers) is a customer of THIS merchant before writing.
  const ids = [survivorId, ...losers];
  const { data: rows, error: readErr } = await svc
    .from('customers')
    .select('id, merchant_id')
    .in('id', ids);
  if (readErr) return { ok: false, error: readErr.message, status: 400 };
  const found = (rows ?? []) as { id: string; merchant_id: string }[];
  if (found.length !== ids.length || found.some((r) => r.merchant_id !== merchantId)) {
    return { ok: false, error: 'one or more customers not found for this merchant', status: 404 };
  }

  const { data, error } = await svc.rpc('merge_customers', {
    p_merchant: merchantId,
    p_survivor: survivorId,
    p_losers: losers,
  });
  if (error) return { ok: false, error: error.message, status: 400 };

  return { ok: true, survivorId: (data as string) ?? survivorId, merged: losers.length };
}
