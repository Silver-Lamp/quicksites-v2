// lib/booking/tablesInput.ts
//
// Validation for "create these tables" (POST /api/booking/<id>/tables) — the step that lets
// HiveJournal's plan-from-image proposal become real `restaurant_tables` rows once the OWNER
// has confirmed it (crosstalk, 2026-10-14; contracts/restaurant-floor-plan.md). Pure, so the
// rules are pinned: a `ref` is the caller's temporary key and comes back beside the new id; a
// label is 1–40 chars; seats is an integer 1–40 and REQUIRED — a table whose seat count the
// extraction could not see (null) must be filled in by the owner before it is created, never
// defaulted here, because a wrong seat count double-books a real evening.
export type TableInput = { ref: string; label: string; seats: number };

export const MAX_TABLES_PER_CALL = 40;

export function parseTablesInput(body: unknown): { ok: true; tables: TableInput[] } | { ok: false; error: string; index?: number } {
  const raw = (body as any)?.tables;
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, error: 'tables_required' };
  if (raw.length > MAX_TABLES_PER_CALL) return { ok: false, error: 'too_many' };
  const out: TableInput[] = [];
  const refs = new Set<string>();
  const labels = new Set<string>();
  for (let i = 0; i < raw.length; i++) {
    const t = raw[i] ?? {};
    const ref = String(t.ref ?? '').trim().slice(0, 64);
    const label = String(t.label ?? '').replace(/\s+/g, ' ').trim();
    const seats = Number(t.seats);
    if (!ref) return { ok: false, error: 'ref_required', index: i };
    if (refs.has(ref)) return { ok: false, error: 'ref_duplicate', index: i };
    if (!label || label.length > 40) return { ok: false, error: 'label_invalid', index: i };
    if (labels.has(label.toLowerCase())) return { ok: false, error: 'label_duplicate', index: i };
    if (!Number.isInteger(seats) || seats < 1 || seats > 40) return { ok: false, error: 'seats_invalid', index: i };
    refs.add(ref);
    labels.add(label.toLowerCase());
    out.push({ ref, label, seats });
  }
  return { ok: true, tables: out };
}
