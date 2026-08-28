'use client';

// Credit a rental to a closer and (optionally) a manager. Free-text on purpose: reps are
// contractors who get pitched and paid before they ever have a login.
import * as React from 'react';
import { useRouter } from 'next/navigation';

export default function AssignRep({
  campaignId,
  domain,
  soldBy,
  manager,
  isRecruiter,
}: {
  campaignId: string;
  domain: string;
  soldBy: string | null;
  manager: string | null;
  isRecruiter: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function assign() {
    const closer = window.prompt(
      `Who closed ${domain}?\n\nThey take 50% of net for as long as it pays. Leave blank to clear.`,
      soldBy ?? ''
    );
    if (closer === null) return;

    let mgr = '';
    let recruited = false;
    if (closer.trim()) {
      const m = window.prompt(
        `Who manages ${closer.trim()} on this rental?\n\nThey earn the override. Leave blank for none — the house keeps that share.`,
        manager ?? ''
      );
      if (m === null) return;
      mgr = m.trim();
      if (mgr) {
        recruited = window.confirm(
          `Did ${mgr} recruit ${closer.trim()}?\n\nOK = yes, override is 25% (funded by the house).\nCancel = no, override is 15%.`
        );
      }
    }

    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/admin/splits/assign', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          campaignId,
          soldBy: closer.trim() || null,
          manager: mgr || null,
          managerIsRecruiter: recruited,
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
    <div className="min-w-[150px]">
      {soldBy ? (
        <div className="text-[13px] leading-snug">
          <div className="text-white">{soldBy}</div>
          {manager ? (
            <div className="text-xs text-neutral-500">
              under {manager}
              {isRecruiter && <span className="text-amber-400"> · recruit</span>}
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
        {busy ? 'Saving…' : soldBy ? 'Change' : 'Assign'}
      </button>
      {err && <div className="mt-1 text-xs text-rose-400">{err}</div>}
    </div>
  );
}
