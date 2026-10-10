'use client';

// components/sites/preview-order-drawer.tsx
//
// The preview cart for an EXHIBIT (an unclaimed draft framed on the Evolve page). Menu rows
// dispatch `qs:preview-order:add`; this collects them, shows a running total, and at the order
// button shows what would happen next — in words — instead of charging anything. It never
// fetches, never posts, never records: the owner is looking at it, not a customer.
import * as React from 'react';
import { addLine, changeQty, centsLabel, previewTotals, PREVIEW_COPY, type PreviewLine } from '@/lib/menu/previewOrder';

export default function PreviewOrderDrawer() {
  const [lines, setLines] = React.useState<PreviewLine[]>([]);
  const [open, setOpen] = React.useState(false);
  const [done, setDone] = React.useState(false);

  React.useEffect(() => {
    const onAdd = (e: Event) => {
      const d = (e as CustomEvent).detail as Omit<PreviewLine, 'qty'> | undefined;
      if (!d?.key || !d?.name) return;
      setLines((prev) => addLine(prev, d));
      setDone(false);
      setOpen(true);
    };
    window.addEventListener('qs:preview-order:add', onAdd);
    return () => window.removeEventListener('qs:preview-order:add', onAdd);
  }, []);

  const totals = previewTotals(lines);
  const subtotal = centsLabel(totals.subtotalCents);

  return (
    <>
      {/* Floating button — the owner sees the count climb as they tap dishes. */}
      {totals.count > 0 && !open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-[60] rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg"
        >
          {PREVIEW_COPY.fab(totals.count, subtotal)}
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label={PREVIEW_COPY.title}>
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">{done ? PREVIEW_COPY.doneTitle : PREVIEW_COPY.title}</h2>
              <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-300">{PREVIEW_COPY.previewBadge}</span>
            </div>

            {done ? (
              <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                {PREVIEW_COPY.doneBody.map((p) => (
                  <p key={p}>{p}</p>
                ))}
                <div className="mt-4 flex gap-2">
                  <button type="button" onClick={() => setDone(false)} className="rounded-md border border-border px-3 py-1.5 text-sm">{PREVIEW_COPY.back}</button>
                  <button type="button" onClick={() => setOpen(false)} className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground">{PREVIEW_COPY.close}</button>
                </div>
              </div>
            ) : (
              <>
                {lines.length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">{PREVIEW_COPY.empty}</p>
                ) : (
                  <ul className="mt-3 divide-y divide-border">
                    {lines.map((l) => (
                      <li key={l.key} className="flex items-center justify-between gap-3 py-2 text-sm">
                        <span className="min-w-0 flex-1">
                          <span className="font-medium">{l.name}</span>
                          {l.option && <span className="text-muted-foreground"> · {l.option}</span>}
                          <span className="ml-2 text-muted-foreground">{l.priceCents == null ? PREVIEW_COPY.unpriced : centsLabel(l.priceCents)}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <button type="button" aria-label="Less" onClick={() => setLines((p) => changeQty(p, l.key, -1))} className="h-7 w-7 rounded-md border border-border">−</button>
                          <span className="w-6 text-center tabular-nums">{l.qty}</span>
                          <button type="button" aria-label="More" onClick={() => setLines((p) => changeQty(p, l.key, 1))} className="h-7 w-7 rounded-md border border-border">+</button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{PREVIEW_COPY.subtotal}{totals.unpriced ? ` (${totals.unpriced} ${PREVIEW_COPY.unpriced})` : ''}</span>
                  <span className="font-semibold tabular-nums">{subtotal}</span>
                </div>
                <div className="mt-4 flex gap-2">
                  <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-border px-3 py-1.5 text-sm">{PREVIEW_COPY.close}</button>
                  <button
                    type="button"
                    disabled={lines.length === 0}
                    onClick={() => setDone(true)}
                    className="flex-1 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    {PREVIEW_COPY.orderButton}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
