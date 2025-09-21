'use client';

import { useMemo, useRef, useState } from 'react';
import { MultiSelect } from '@/components/ui/multi-select';
import { Input } from '@/components/ui/input';

/* -------------------------------- Types --------------------------------- */

type PreviewRow = {
  id: string;
  referral_code: string;
  subject: string;
  subject_id: string;
  amount_cents: number;
  currency: string;
  status: 'pending'|'approved'|'paid'|'void'|string;
  created_at: string;
};

/* ------------------------------- Utilities ------------------------------ */

function parseCSV(text: string): PreviewRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length <= 1) return [];
  const headers = lines[0].split(',');
  const idx = (h: string) => headers.indexOf(h);
  const out: PreviewRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < headers.length) continue;
    out.push({
      id: cols[idx('id')],
      referral_code: cols[idx('referral_code')],
      subject: cols[idx('subject')],
      subject_id: cols[idx('subject_id')],
      amount_cents: Number(cols[idx('amount_cents')] || 0),
      currency: (cols[idx('currency')] || 'USD') as string,
      status: cols[idx('status')] as any,
      created_at: cols[idx('created_at')],
    });
  }
  return out;
}

function formatMoney(cents: number, cur = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format((cents || 0) / 100);
}
function ymd(d: Date) { return d.toISOString().slice(0, 10); }

/* --------------------------- Confirmation Modal ------------------------- */

function ConfirmModal({
  open, onClose, title, message, expectedToken, onConfirm, confirmLabel = 'Confirm'
}:{
  open: boolean;
  onClose: () => void;
  title: string;
  message: string | React.ReactNode;
  expectedToken: string;              // e.g., "PAY" or "REVERT"
  onConfirm: () => Promise<void> | void;
  confirmLabel?: string;
}) {
  const [typed, setTyped] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const canConfirm = typed.trim().toUpperCase() === expectedToken.toUpperCase();

  async function handleConfirm() {
    if (!canConfirm || submitting) return;
    try {
      setSubmitting(true);
      await onConfirm();
      onClose();
    } finally {
      setSubmitting(false);
      setTyped('');
    }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-lg rounded-2xl bg-neutral-950 p-6 ring-1 ring-neutral-800">
        <div className="text-lg font-semibold">{title}</div>
        <div className="mt-3 text-sm text-neutral-300">{message}</div>

        <div className="mt-4">
          <label className="block text-xs text-neutral-400">
            Type <span className="font-mono">{expectedToken}</span> to continue
          </label>
          <input
            autoFocus
            value={typed}
            onChange={(e)=>setTyped(e.target.value)}
            className="mt-1 w-full rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800 outline-none"
            placeholder={expectedToken}
          />
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={() => { setTyped(''); onClose(); }}
            className="rounded bg-neutral-900 px-4 py-2 text-sm ring-1 ring-neutral-800"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm || submitting}
            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {submitting ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Main Component --------------------------- */

export default function PayoutWizardClient({
  codes, defaultStart, defaultEnd, baseUrl
}:{
  codes: string[];
  defaultStart: string;
  defaultEnd: string;
  baseUrl: string;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);
  const [loading, setLoading] = useState(false);
  const [rowsByCode, setRowsByCode] = useState<Record<string, PreviewRow[]>>({});
  const [error, setError] = useState<string | null>(null);

  // Confirm modal (dynamic for PAY / REVERT)
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmMessage, setConfirmMessage] = useState<React.ReactNode>('');
  const [confirmToken, setConfirmToken] = useState<'PAY'|'REVERT'>('PAY');
  const [confirmButtonLabel, setConfirmButtonLabel] = useState('Confirm');
  const confirmActionRef = useRef<() => Promise<void> | void>(() => {});

  const summary = useMemo(() => {
    const result: Record<string, { pending: number; approved: number; paid: number; currency: string; countApproved: number; countPaid: number }> = {};
    for (const code of Object.keys(rowsByCode)) {
      const rows = rowsByCode[code] || [];
      const currency = rows[0]?.currency || 'USD';
      let pending = 0, approved = 0, paid = 0, countApproved = 0, countPaid = 0;
      for (const r of rows) {
        if (r.status === 'pending') pending += r.amount_cents;
        else if (r.status === 'approved') { approved += r.amount_cents; countApproved++; }
        else if (r.status === 'paid') { paid += r.amount_cents; countPaid++; }
      }
      result[code] = { pending, approved, paid, currency, countApproved, countPaid };
    }
    return result;
  }, [rowsByCode]);

  function setPrevMonth() {
    const now = new Date();
    const firstThis = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const firstPrev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const endPrev = new Date(firstThis.getTime() - 24 * 3600 * 1000);
    setStart(ymd(firstPrev));
    setEnd(ymd(endPrev));
  }
  function setMTD() {
    const now = new Date();
    const firstThis = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    setStart(ymd(firstThis));
    setEnd(ymd(now));
  }
  function setLast7() {
    const now = new Date();
    const sevenAgo = new Date(now.getTime() - 6 * 24 * 3600 * 1000);
    setStart(ymd(sevenAgo));
    setEnd(ymd(now));
  }

  async function loadPreview() {
    setError(null);
    setLoading(true);
    try {
      const out: Record<string, PreviewRow[]> = {};
      for (const code of selected) {
        const url = new URL('/api/referrals/export', baseUrl || window.location.origin);
        url.searchParams.set('code', code);
        if (start) url.searchParams.set('start', start);
        if (end) url.searchParams.set('end', end);
        const res = await fetch(url.toString(), { cache: 'no-store' });
        if (!res.ok) throw new Error(`Export failed for ${code}`);
        const text = await res.text();
        out[code] = parseCSV(text);
      }
      setRowsByCode(out);
    } catch (e: any) {
      setError(e?.message || 'Failed to preview');
    } finally {
      setLoading(false);
    }
  }

  async function downloadCombinedApprovedCSV() {
    const header = ['id','referral_code','subject','subject_id','amount_cents','currency','status','created_at'];
    const lines = [header.join(',')];
    for (const code of selected) {
      const rows = (rowsByCode[code] || []).filter(r => r.status === 'approved');
      for (const r of rows) lines.push([r.id, r.referral_code, r.subject, r.subject_id, r.amount_cents, r.currency, r.status, r.created_at].join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `referrals_approved_${start}_${end}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
  }

  // Existing payout work, split into "confirmed" action so we can wrap with modal
  async function actuallyRunPayout() {
    setLoading(true); setError(null);
    try {
      // 1) Prepare counts/totals from the preview we just showed
      const perCode: Array<{ code: string; approvedCentsBefore: number; rowsMarked: number; markedPaidCents: number }> = [];
      let totalApprovedCentsBefore = 0;
      let totalMarkedPaidCents = 0;
      let countRowsMarked = 0;
  
      // build per-code preview stats
      for (const code of selected) {
        const rows = (rowsByCode[code] || []).filter(r => r.status === 'approved');
        const approvedCents = rows.reduce((s, r) => s + r.amount_cents, 0);
        totalApprovedCentsBefore += approvedCents;
        perCode.push({
          code,
          approvedCentsBefore: approvedCents,
          rowsMarked: 0,              // will fill after mark-paid responses
          markedPaidCents: approvedCents
        });
        totalMarkedPaidCents += approvedCents;
      }
  
      // 2) Download CSV snapshot for records
      await downloadCombinedApprovedCSV();
  
      // 3) Mark paid per code, collect counts returned by the API
      for (const code of selected) {
        const res = await fetch('/api/referrals/mark-paid', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ code, start, end })
        });
        if (!res.ok) throw new Error(`mark-paid failed for ${code}`);
        const j = await res.json().catch(() => ({}));
        const count = Number(j?.count || 0);
        countRowsMarked += count;
        const pc = perCode.find(p => p.code === code);
        if (pc) pc.rowsMarked = count; // markedPaidCents already = approvedCentsBefore
      }
  
      // 4) Write a payout_runs audit row
      await fetch('/api/referrals/payout-runs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          rangeStart: start,
          rangeEnd: end,
          codes: selected,
          totalApprovedCentsBefore,
          totalMarkedPaidCents,
          countRowsMarked,
          perCode,
          meta: { source: 'payout-wizard', tz: Intl.DateTimeFormat().resolvedOptions().timeZone }
        })
      });
  
      alert('Payout run complete and logged.');
      await loadPreview(); // refresh view to show new statuses
    } catch (e: any) {
      setError(e?.message || 'Payout run failed');
    } finally {
      setLoading(false);
    }
  }
  

  function promptRunPayout() {
    if (selected.length === 0) return;
    const totalApproved = Object.values(summary).reduce((s, v) => s + v.approved, 0);
    setConfirmTitle('Mark APPROVED → PAID?');
    setConfirmMessage(
      <div className="space-y-2">
        <p>
          You’re about to mark all <b>approved</b> commissions as <b>paid</b> for the selected code(s)
          within <span className="font-mono">{start}</span> → <span className="font-mono">{end}</span>.
        </p>
        <p className="text-neutral-300">Scope: <b>{selected.length}</b> code(s) • Approved total in preview: <b>{formatMoney(totalApproved)}</b></p>
        <p className="text-xs text-neutral-400">We’ll also download a combined CSV of approved rows for your records.</p>
      </div>
    );
    setConfirmToken('PAY');
    setConfirmButtonLabel('Type PAY to proceed');
    confirmActionRef.current = actuallyRunPayout;
    setConfirmOpen(true);
  }

  // Existing revert flow (typed confirm already)
  async function actuallyRevertPaid() {
    setLoading(true); setError(null);
    try {
      for (const code of selected) {
        const res = await fetch('/api/referrals/revert-paid', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ code, start, end })
        });
        if (!res.ok) {
          const j = await res.json().catch(()=>({}));
          throw new Error(`revert-paid failed for ${code}: ${j.error || res.statusText}`);
        }
      }
      alert('Reverted paid → approved for selected scope.');
      await loadPreview();
    } catch (e: any) {
      setError(e?.message || 'Revert failed');
    } finally {
      setLoading(false);
    }
  }

  function promptRevertPaid() {
    if (selected.length === 0) return;
    const totalPaid = Object.values(summary).reduce((s, v) => s + v.paid, 0);
    setConfirmTitle('Revert PAID → APPROVED?');
    setConfirmMessage(
      <div className="space-y-2">
        <p>
          You’re about to revert <b>paid</b> commissions back to <b>approved</b> for the selected code(s)
          within <span className="font-mono">{start}</span> → <span className="font-mono">{end}</span>.
        </p>
        <p className="text-neutral-300">Scope: <b>{selected.length}</b> code(s) • Paid total in preview: <b>{formatMoney(totalPaid)}</b></p>
        <p className="text-xs text-neutral-400">This won’t touch pending rows or anything outside the date range.</p>
      </div>
    );
    setConfirmToken('REVERT');
    setConfirmButtonLabel('Type REVERT to proceed');
    confirmActionRef.current = actuallyRevertPaid;
    setConfirmOpen(true);
  }

  if (!codes.length) return <div className="rounded-xl border border-neutral-800 p-4 text-sm text-neutral-500">No referral codes found.</div>;

  return (
    <>
      <div className="rounded-2xl border border-neutral-800 p-5">
        {/* Step 1: select & range */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className="block text-xs text-neutral-400">Referral codes</label>
            <MultiSelect
              label="Referral codes"
              options={codes.map((code) => ({ value: code, label: code }))}
              selected={selected}
              onChange={setSelected}
              placeholder="Select one or more codes…"
            />
          </div>
          <div>
            <label className="block text-xs text-neutral-400">Start</label>
            <Input type="date" value={start} onChange={(e: any)=>setStart(e.target.value)}
                  className="mt-1 w-full rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800"/>
          </div>
          <div>
            <label className="block text-xs text-neutral-400">End</label>
            <Input type="date" value={end} onChange={(e: any)=>setEnd(e.target.value)}
                  className="mt-1 w-full rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800"/>
          </div>
        </div>

        {/* Presets */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-neutral-400">Presets:</span>
          <button onClick={setPrevMonth} className="rounded bg-neutral-900 px-3 py-1 text-xs ring-1 ring-neutral-800">Prev Month</button>
          <button onClick={setMTD} className="rounded bg-neutral-900 px-3 py-1 text-xs ring-1 ring-neutral-800">This Month-to-Date</button>
          <button onClick={setLast7} className="rounded bg-neutral-900 px-3 py-1 text-xs ring-1 ring-neutral-800">Last 7 Days</button>
        </div>

        {/* Actions */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button onClick={loadPreview} disabled={loading || selected.length === 0}
                  className="rounded-lg bg-neutral-900 px-4 py-2 text-sm ring-1 ring-neutral-800 disabled:opacity-50">
            {loading ? 'Loading…' : 'Preview totals'}
          </button>
          <button onClick={promptRunPayout} disabled={loading || Object.keys(rowsByCode).length === 0}
                  className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium disabled:opacity-50">
            Mark Paid (type PAY)
          </button>
          <button onClick={promptRevertPaid} disabled={loading || Object.keys(rowsByCode).length === 0}
                  className="rounded-lg bg-red-600/80 px-4 py-2 text-sm font-medium disabled:opacity-50">
            Revert Paid (type REVERT)
          </button>
        </div>

        {error && <div className="mt-3 rounded bg-red-950/40 p-3 text-sm text-red-300">{error}</div>}

        {/* Step 2: preview cards + detail */}
        {Object.keys(rowsByCode).length > 0 && (
          <div className="mt-6 rounded-xl border border-neutral-800">
            <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-3">
              {Object.entries(rowsByCode).map(([code, rows]) => {
                const s = summary[code] || { pending:0, approved:0, paid:0, currency:'USD', countApproved:0, countPaid:0 };
                return (
                  <div key={code} className="rounded-lg border border-neutral-800 p-4">
                    <div className="font-mono text-sm">{code}</div>
                    <div className="mt-2 text-xs text-neutral-400">
                      Approved rows: {s.countApproved} • Paid rows: {s.countPaid}
                    </div>
                    <div className="mt-2 space-y-1 text-sm">
                      <div><span className="text-neutral-400">Pending:</span> {formatMoney(s.pending, s.currency)}</div>
                      <div><span className="text-neutral-400">Approved:</span> {formatMoney(s.approved, s.currency)}</div>
                      <div><span className="text-neutral-400">Paid:</span> {formatMoney(s.paid, s.currency)}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-neutral-900">
                  <tr className="[&>th]:px-4 [&>th]:py-3 text-left">
                    <th>When</th><th>Code</th><th>Status</th><th>Subject</th><th>Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {Object.values(rowsByCode).flat().map((r) => (
                    <tr key={r.id} className="[&>td]:px-4 [&>td]:py-3">
                      <td className="text-neutral-400 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                      <td className="font-mono">{r.referral_code}</td>
                      <td><span className="rounded bg-neutral-800 px-2 py-1 text-xs">{r.status}</span></td>
                      <td className="text-xs">{r.subject} • {r.subject_id}</td>
                      <td>{formatMoney(r.amount_cents, r.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal at root */}
      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={confirmTitle}
        message={confirmMessage}
        expectedToken={confirmToken}
        confirmLabel={confirmButtonLabel}
        onConfirm={() => confirmActionRef.current?.()}
      />
    </>
  );
}
