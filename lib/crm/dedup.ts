// lib/crm/dedup.ts
//
// Customer dedup detection (CRM_PLAN.md Phase 2 — the remaining open item).
//
// The identity spine keys customers by `unique(merchant_id, email_normalized)`, so
// two rows can never share a normalized email. Duplicates instead come from the SAME
// person buying under DIFFERENT emails (personal vs work, a typo, a second address).
// Those are detectable two ways:
//   • same normalized phone  → strong signal (a phone is near-unique to a person)
//   • same normalized name   → weak signal  (common names collide)
//
// Pure module — no client/server-only imports. The merchant customer list computes
// candidate groups client-side (counts per merchant are modest) and the owner
// confirms each merge; the actual fold happens server-side via the merge RPC.

export type DedupCustomer = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  orders_count: number;
  lifetime_cents: number;
  last_order_at: string | null;
};

export type DedupReason = 'phone' | 'name';

export type DuplicateGroup = {
  /** Members, ordered best-survivor-first (most orders, then most recent, then most LTV). */
  members: DedupCustomer[];
  /** Strongest signal that grouped these rows. */
  reason: DedupReason;
  /** The shared, normalized value (a phone or a name) — shown to the owner as the "why". */
  matchValue: string;
};

/** Digits-only phone, collapsed to the national 10-digit form (drops a US country code). */
export function normalizePhone(phone: string | null | undefined): string | null {
  const digits = String(phone ?? '').replace(/\D+/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1);
  return digits.length >= 10 ? digits.slice(-10) : null;
}

/** Lowercased, whitespace-collapsed name — the weak-signal grouping key. */
export function normalizeName(name: string | null | undefined): string | null {
  const s = String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  return s.length >= 2 ? s : null;
}

/** Best default survivor for a group: most orders, then most-recent, then highest LTV. */
export function rankSurvivor(a: DedupCustomer, b: DedupCustomer): number {
  if ((b.orders_count || 0) !== (a.orders_count || 0))
    return (b.orders_count || 0) - (a.orders_count || 0);
  const at = a.last_order_at ? new Date(a.last_order_at).getTime() : 0;
  const bt = b.last_order_at ? new Date(b.last_order_at).getTime() : 0;
  if (bt !== at) return bt - at;
  return (b.lifetime_cents || 0) - (a.lifetime_cents || 0);
}

/**
 * Find candidate duplicate groups. Builds connected components over match edges so a
 * chain (A↔B by phone, B↔C by name) surfaces as one group, and labels each component
 * with its strongest reason. A pair is never reported by more than one group.
 */
export function findDuplicateGroups(customers: DedupCustomer[]): DuplicateGroup[] {
  const byId = new Map(customers.map((c) => [c.id, c]));

  // Union-Find over customer ids.
  const parent = new Map<string, string>(customers.map((c) => [c.id, c.id]));
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    let c = x;
    while (parent.get(c) !== c) {
      const n = parent.get(c)!;
      parent.set(c, r);
      c = n;
    }
    return r;
  };
  const union = (a: string, b: string) => {
    const ra = find(a),
      rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  // Bucket by phone (strong) and name (weak); union within each bucket, and record the
  // (reason, value, a representative member) of every real bucket for later labeling.
  const phoneBuckets = new Map<string, string[]>();
  const nameBuckets = new Map<string, string[]>();
  for (const c of customers) {
    const p = normalizePhone(c.phone);
    if (p) (phoneBuckets.get(p) ?? phoneBuckets.set(p, []).get(p)!).push(c.id);
    const n = normalizeName(c.name);
    if (n) (nameBuckets.get(n) ?? nameBuckets.set(n, []).get(n)!).push(c.id);
  }
  const bucketRecords: { reason: DedupReason; value: string; anyId: string }[] = [];
  const applyBucket = (bucket: Map<string, string[]>, reason: DedupReason) => {
    for (const [val, ids] of bucket) {
      if (ids.length < 2) continue;
      for (let i = 1; i < ids.length; i++) union(ids[0], ids[i]);
      bucketRecords.push({ reason, value: val, anyId: ids[0] });
    }
  };
  applyBucket(phoneBuckets, 'phone');
  applyBucket(nameBuckets, 'name');

  // Resolve labels ONLY after every union settles — roots move as chains link up, so a
  // reason recorded against a mid-merge root would strand. 'phone' outranks 'name'.
  const reasonOf = new Map<string, DedupReason>();
  const valueOf = new Map<string, string>();
  for (const rec of bucketRecords) {
    const root = find(rec.anyId);
    if (rec.reason === 'phone' || !reasonOf.has(root)) {
      reasonOf.set(root, rec.reason);
      valueOf.set(root, rec.value);
    }
  }

  // Collect components of size >= 2.
  const comps = new Map<string, string[]>();
  for (const c of customers) {
    const root = find(c.id);
    (comps.get(root) ?? comps.set(root, []).get(root)!).push(c.id);
  }

  const groups: DuplicateGroup[] = [];
  for (const [root, ids] of comps) {
    if (ids.length < 2) continue;
    const members = ids.map((id) => byId.get(id)!).sort(rankSurvivor);
    groups.push({
      members,
      reason: reasonOf.get(root) ?? 'name',
      matchValue: valueOf.get(root) ?? '',
    });
  }
  // Phone-matched (higher confidence) groups first, then larger groups.
  groups.sort((a, b) => {
    if (a.reason !== b.reason) return a.reason === 'phone' ? -1 : 1;
    return b.members.length - a.members.length;
  });
  return groups;
}
