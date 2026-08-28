'use client';

// Credit a rental to a closer's referral code, and optionally a manager's.
//
// Codes rather than names because commission_ledger.referral_code is a foreign key — a name
// can never become a ledger row, a payout, or a clawback. A code can be minted before the
// person has an account; their balance accrues as 'held' until they claim it.
//
// Whether the manager gets 15% or 25% is NOT asked here: it is derived from the closer's
// referral_codes.parent_code, the one existing record of who recruited whom. Asking would
// let the answer disagree with the hub override on the commerce side.
import * as React from 'react';
import { useRouter } from 'next/navigation';

export default function AssignRep({
  campaignId,
  domain,
  soldByCode,
  soldByLabel,
  managerCode,
  managerLabel,
  recruited,
}: {
  campaignId: string;
  domain: string;
  soldByCode: string | null;
  soldByLabel: string | null;
  managerCode: string | null;
  managerLabel: string | null;
  recruited: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function assign() {
    const closer = window.prompt(
      `Which referral code closed ${domain}?\n\nThey take 50% of net for as long as it pays. Leave blank to clear.\nThe code must already exist — mint one in Referral Codes first.`,
      soldByCode ?? ''
    );
    if (closer === null) return;

    let mgr = '';
    if (closer.trim()) {
      const m = window.prompt(
        `Which code earns the override on ${domain}?\n\nLeave blank for none — the house keeps that share.\n\nThe rate is worked out automatically: 25% if they recruited the closer, 15% if not.`,
        managerCode ?? ''
      );
      if (m === null) return;
      mgr = m.trim();
    }

    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/admin/splits/assign', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          campaignId,
          soldByCode: closer.trim() || null,
          managerCode: mgr || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `Failed (${res.status})`);
      router.refresh();
    } catch (e: any) {
      setErr(e?.message || 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-w-[160px]">
      {soldByCode ? (
        <div className="text-[13px] leading-snug">
          <div className="text-white">{soldByLabel || soldByCode}</div>
          {managerCode ? (
            <div className="text-xs text-neutral-500">
              under {managerLabel || managerCode}
              {recruited && <span className="text-amber-400"> · recruited · 25%</span>}
              {!recruited && <span className="text-neutral-600"> · 15%</span>}
            </div>
          ) : (
            <div className="text-xs text-neutral-600">no manager</div>
          )}
        </div>
      ) : (
        <div className="text-[13px] text-rose-400">unassigned</div>
      )}
      <button
        type="button"
        onClick={assign}
        disabled={busy}
        className="mt-1 text-xs text-sky-400 underline underline-offset-2 hover:text-sky-300 disabled:opacity-50"
      >
        {busy ? 'Saving…' : soldByCode ? 'Change' : 'Assign'}
      </button>
      {err && <div className="mt-1 text-xs text-rose-400">{err}</div>}
    </div>
  );
}
