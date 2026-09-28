'use client';

// components/admin/postcard-returns-client.tsx
//
// Working through a physical stack of returned postcards.
//
// ⚠️ THE SEARCH MATCHES WHAT IS PRINTED ON THE CARD (`to_name` / `to_address`), not the
// prospect's current record. If an address has already been corrected, searching the current
// one would fail to find the very card in the operator's hand.
//
// ⚠️ The reason is not cosmetic — `out_of_business` and `refused` CLOSE the prospect, which
// stops every future sweep, build and mailing for that business. So each option says what it
// does, and the destructive ones confirm. Getting this wrong in either direction costs money
// (mailing a dead business) or a lead (closing a live one).
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ReturnRow, ReturnsList } from '@/lib/outreach/mail/returnsList';

const REASONS: Array<{ value: string; label: string; effect: string; terminal: boolean }> = [
  { value: 'bad_address', label: 'Bad address', effect: 'fixable — you can re-send', terminal: false },
  { value: 'moved', label: 'Moved', effect: 'fixable — you can re-send', terminal: false },
  { value: 'vacant', label: 'Vacant / nobody there', effect: 'recorded only, no action', terminal: false },
  { value: 'unknown', label: 'Came back, no reason given', effect: 'recorded only, no action', terminal: false },
  { value: 'out_of_business', label: 'Out of business', effect: 'CLOSES them everywhere', terminal: true },
  { value: 'refused', label: 'Refused delivery', effect: 'CLOSES them — they said no', terminal: true },
];

const fmtDate = (iso?: string | null) => (iso ? iso.slice(0, 10) : '—');

function Row({ r, onDone }: { r: ReturnRow; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [addr, setAddr] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const chosen = REASONS.find((x) => x.value === reason);

  async function post(body: unknown, verb: string) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/prospects/mail-returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) {
        setMsg(j.error || res.statusText);
        return;
      }
      setMsg(
        j.prospectClosed
          ? 'marked — business CLOSED, no more sweeps, builds or cards'
          : j.requeued
            ? 're-queued with the new address — the next mail run picks it up'
            : j.reopened
              ? 'reopened'
              : `${verb} — still open for a re-send`,
      );
      onDone();
    } catch (e: any) {
      setMsg(e?.message || 'failed');
    } finally {
      setBusy(false);
    }
  }

  async function mark() {
    if (!chosen) return;
    if (
      chosen.terminal &&
      !window.confirm(
        `Mark "${r.to_name ?? r.business_name}" as ${chosen.label.toLowerCase()}?\n\n` +
          `This CLOSES the business: no future sweep, site build, postcard or forward-to will ` +
          `consider them again. Reversible, but only if you notice.`,
      )
    )
      return;
    await post({ mailingId: r.id, reason }, 'marked');
  }

  return (
    <tr className="border-t border-neutral-800 align-top">
      <td className="px-3 py-2">
        <div className="font-medium text-neutral-100">{r.to_name ?? r.business_name ?? '—'}</div>
        <div className="text-xs text-neutral-500">{r.to_address ?? '—'}</div>
        {r.phone ? <div className="text-xs text-neutral-600">{r.phone}</div> : null}
        {r.closed_at ? (
          <div className="mt-1 text-xs text-red-300">closed · {r.closed_reason}</div>
        ) : null}
      </td>
      <td className="px-3 py-2 text-xs text-neutral-400">
        {fmtDate(r.created_at)}
        <div className="text-neutral-600">due {fmtDate(r.expected_delivery_date)}</div>
      </td>
      <td className="px-3 py-2">
        {r.returned_at ? (
          <div className="text-xs">
            <span className="text-amber-300">{r.return_reason}</span>
            <div className="text-neutral-600">{fmtDate(r.returned_at)}</div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs text-neutral-100"
            >
              <option value="">Why did it come back?…</option>
              {REASONS.map((x) => (
                <option key={x.value} value={x.value}>
                  {x.label} — {x.effect}
                </option>
              ))}
            </select>
            <button
              onClick={mark}
              disabled={!reason || busy}
              className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs text-amber-200 hover:bg-amber-500/20 disabled:opacity-40"
            >
              {busy ? '…' : 'Mark returned'}
            </button>
          </div>
        )}
      </td>
      <td className="px-3 py-2">
        {/* Re-send is offered for any returned card — the operator may have found a new address
            even for one marked "vacant". Requeue clears closed_at, since finding them alive
            contradicts the close. */}
        {r.returned_at && r.prospect_id ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={addr}
              onChange={(e) => setAddr(e.target.value)}
              placeholder="Better address you found"
              className="w-56 rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs text-neutral-100 placeholder-neutral-600"
            />
            <button
              onClick={() => post({ prospectId: r.prospect_id, address: addr, requeue: true }, 're-queued')}
              disabled={addr.trim().length < 8 || busy}
              className="rounded-md border border-sky-500/40 bg-sky-500/10 px-2 py-1 text-xs text-sky-200 hover:bg-sky-500/20 disabled:opacity-40"
            >
              Re-send
            </button>
          </div>
        ) : (
          <span className="text-xs text-neutral-600">—</span>
        )}
        {msg ? <div className="mt-1 text-xs text-neutral-400">{msg}</div> : null}
      </td>
    </tr>
  );
}

export default function PostcardReturnsClient({ list }: { list: ReturnsList }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [showDone, setShowDone] = useState(false);

  const match = (r: ReturnRow) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return [r.to_name, r.to_address, r.business_name, r.city]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(s));
  };

  const open = useMemo(() => list.open.filter(match), [list.open, q]);
  const done = useMemo(() => list.returned.filter(match), [list.returned, q]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search the name or address printed on the card…"
          className="w-80 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600"
        />
        <label className="flex items-center gap-2 text-xs text-neutral-400">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
          Show the {list.returned.length} already marked
        </label>
        <span className="text-xs text-neutral-500">
          {list.open.length} card{list.open.length === 1 ? '' : 's'} not marked returned
        </span>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900/60 text-left text-[11px] uppercase tracking-wide text-neutral-400">
            <tr>
              <th className="px-3 py-2">Printed on the card</th>
              <th className="px-3 py-2">Mailed</th>
              <th className="px-3 py-2">Returned?</th>
              <th className="px-3 py-2">Re-send to a better address</th>
            </tr>
          </thead>
          <tbody>
            {(showDone ? [...open, ...done] : open).map((r) => (
              <Row key={r.id} r={r} onDone={() => router.refresh()} />
            ))}
            {!open.length && !showDone ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-sm text-neutral-500">
                  {q ? 'Nothing matches that.' : 'Every mailed card is accounted for.'}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
