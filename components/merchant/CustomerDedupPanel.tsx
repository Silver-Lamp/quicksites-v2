'use client';

// Merchant "possible duplicates" panel (CRM_PLAN.md Phase 2 — dedup/merge). Computes
// candidate duplicate groups client-side from the loaded customer rows (same phone =
// strong, same name = weak), lets the owner pick which record survives, and folds the
// rest into it via POST /api/merchant/customers/merge. Collapsed by default so it
// never gets in the way when there are no duplicates.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { findDuplicateGroups, type DedupCustomer, type DuplicateGroup } from '@/lib/crm/dedup';

function fmtCents(c: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    (c || 0) / 100
  );
}

function GroupCard({ group, onMerged }: { group: DuplicateGroup; onMerged: () => void }) {
  // Default survivor = the first member (already ranked best-survivor-first).
  const [survivor, setSurvivor] = React.useState(group.members[0].id);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const merge = async () => {
    setBusy(true);
    setErr(null);
    const loserIds = group.members.map((m) => m.id).filter((id) => id !== survivor);
    try {
      const res = await fetch('/api/merchant/customers/merge', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ survivorId: survivor, loserIds }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Merge failed');
      onMerged();
    } catch (e: any) {
      setErr(e?.message || 'Merge failed');
      setBusy(false);
    }
  };

  const reasonLabel =
    group.reason === 'phone'
      ? `Same phone · ${group.matchValue.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3')}`
      : `Same name · ${group.matchValue}`;

  return (
    <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-3">
      <div className="mb-2 flex items-center gap-2 text-xs">
        <span
          className={`rounded-full px-2 py-0.5 ${
            group.reason === 'phone'
              ? 'bg-amber-500/20 text-amber-200'
              : 'bg-white/10 text-neutral-300'
          }`}
        >
          {reasonLabel}
        </span>
        <span className="text-neutral-500">{group.members.length} records</span>
      </div>

      <div className="space-y-1">
        {group.members.map((m) => (
          <label
            key={m.id}
            className={`flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm ${
              m.id === survivor
                ? 'bg-emerald-500/10 ring-1 ring-emerald-500/30'
                : 'hover:bg-white/[0.03]'
            }`}
          >
            <input
              type="radio"
              name={`survivor-${group.members[0].id}`}
              checked={m.id === survivor}
              onChange={() => setSurvivor(m.id)}
              className="accent-emerald-400"
            />
            <span className="min-w-0 flex-1 truncate">
              <span className="font-medium text-white">{m.name || m.email.split('@')[0]}</span>
              <span className="ml-2 text-neutral-400">{m.email}</span>
              {m.phone && <span className="ml-2 text-neutral-500">{m.phone}</span>}
            </span>
            <span className="shrink-0 tabular-nums text-neutral-400">
              {m.orders_count} {m.orders_count === 1 ? 'order' : 'orders'} ·{' '}
              {fmtCents(m.lifetime_cents)}
            </span>
          </label>
        ))}
      </div>

      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={merge}
          disabled={busy}
          className="rounded-md bg-emerald-500/90 px-3 py-1.5 text-xs font-medium text-black hover:bg-emerald-400 disabled:opacity-50"
        >
          {busy ? 'Merging…' : `Merge ${group.members.length - 1} into selected`}
        </button>
        <span className="text-xs text-neutral-500">
          Order history + lifetime value combine; the other {group.members.length - 1}{' '}
          {group.members.length - 1 === 1 ? 'record is' : 'records are'} removed.
        </span>
        {err && <span className="text-xs text-red-400">{err}</span>}
      </div>
    </div>
  );
}

export default function CustomerDedupPanel({ rows }: { rows: DedupCustomer[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  const groups = React.useMemo(() => findDuplicateGroups(rows), [rows]);
  if (groups.length === 0) return null;

  const total = groups.length;

  return (
    <div className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/[0.03]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm"
      >
        <span className="font-medium text-amber-200">
          {total} possible duplicate {total === 1 ? 'group' : 'groups'}
        </span>
        <span className="text-neutral-400">{open ? 'Hide' : 'Review'}</span>
      </button>
      {open && (
        <div className="space-y-3 px-4 pb-4">
          {groups.map((g) => (
            <GroupCard key={g.members[0].id} group={g} onMerged={() => router.refresh()} />
          ))}
        </div>
      )}
    </div>
  );
}
