'use client';

// The Demand cell on the outreach pipeline. Shows the 🔥 order-intent count and, on
// click, expands the actual leads (name / phone / what they wanted) so an operator can
// follow up by hand while the auto-SMS nudge is off — the manual Phase 2. Admin-only
// surface (the page is getAdminUser-gated), so showing visitor phone numbers is fine.
import * as React from 'react';
import type { DemandLead } from '@/lib/menu/demand';

function telHref(phone: string | null) {
  const d = (phone || '').replace(/[^\d+]/g, '');
  return d ? `tel:${d}` : '';
}

function fmtWhen(at: string | null) {
  if (!at) return '';
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function DemandLeadsCell({
  count,
  calls,
  leads,
  notified,
  restaurantName,
  restaurantPhone,
}: {
  count: number;
  calls: number;
  leads: DemandLead[];
  notified: boolean;
  restaurantName: string;
  restaurantPhone: string | null;
}) {
  const [open, setOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  if (count <= 0) return <span className="text-xs text-neutral-600">—</span>;

  const copyLeads = async () => {
    const lines = leads.map((l) => [l.name || 'Someone', l.phone || '', l.items ? `— ${l.items}` : ''].filter(Boolean).join(' '));
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — no-op */
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1"
        title="Show who tried to order"
      >
        <span className="rounded bg-sky-500/15 px-2 py-0.5 text-xs font-semibold text-sky-300 hover:bg-sky-500/25">🔥 {count}</span>
        {notified && (
          <span title="Restaurant texted about the demand" className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-400">✓ texted</span>
        )}
      </button>

      {open && (
        <>
          {/* click-away */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute left-0 z-50 mt-2 w-72 rounded-xl border border-neutral-700 bg-neutral-900 p-3 text-left shadow-2xl">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-200">
                {count} order intent{count === 1 ? '' : 's'}
              </span>
              {leads.length > 0 && (
                <button type="button" onClick={copyLeads} className="text-[11px] text-sky-400 hover:text-sky-300">
                  {copied ? 'Copied ✓' : 'Copy leads'}
                </button>
              )}
            </div>

            {leads.length > 0 ? (
              <ul className="space-y-2">
                {leads.map((l, i) => (
                  <li key={i} className="rounded-lg bg-neutral-800/60 p-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-neutral-100">{l.name || 'Someone'}</span>
                      <span className="text-[10px] text-neutral-500">{fmtWhen(l.at)}</span>
                    </div>
                    {l.items && <div className="mt-0.5 text-neutral-300">“{l.items}”</div>}
                    {l.phone && (
                      <a href={telHref(l.phone)} className="mt-1 inline-block text-sky-400 hover:text-sky-300">
                        📞 {l.phone}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-neutral-400">No contact details left — all tap-to-call.</p>
            )}

            {calls > 0 && (
              <p className="mt-2 text-[11px] text-neutral-500">+ {calls} tap-to-call (no message)</p>
            )}

            {restaurantPhone && (
              <a
                href={telHref(restaurantPhone)}
                className="mt-3 block rounded-lg bg-amber-400 px-3 py-2 text-center text-xs font-semibold text-neutral-950 hover:bg-amber-300"
              >
                📞 Call {restaurantName} to claim
              </a>
            )}
          </div>
        </>
      )}
    </div>
  );
}
