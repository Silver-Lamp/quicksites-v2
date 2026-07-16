'use client';

// Demand capture on an unclaimed delivered.menu draft (a restaurant site we auto-built
// during outreach, not yet claimed by the owner). Two honest signals, no money:
//   1. tap-to-call — a delegated listener logs when a visitor taps any `tel:` link.
//   2. "order ahead" — an interest form. Online checkout ISN'T live on a draft (the owner
//      hasn't claimed), so we don't fake an order: we capture the lead + point the visitor
//      at the working channel (the restaurant's phone). The count drives the claim pitch.
// All best-effort — a failed beacon/post never blocks the page. Only rendered when the
// draft is claimable and MENU_DEMAND_CAPTURE_ENABLED (gated server-side by the route too).
import * as React from 'react';

function post(templateId: string, body: Record<string, unknown>) {
  return fetch(`/api/menu/demand/${templateId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    keepalive: true,
  });
}

export default function DemandCapture({
  templateId,
  phone,
}: {
  templateId: string;
  /** The restaurant's listing phone, for the "order now" fallback. */
  phone?: string | null;
}) {
  const [open, setOpen] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const calledRef = React.useRef(false);

  // Tap-to-call → log a 'call' intent once per visit (server also rate-limits per IP).
  React.useEffect(() => {
    function onClick(e: MouseEvent) {
      const el = (e.target as HTMLElement | null)?.closest?.('a[href^="tel:"]');
      if (!el || calledRef.current) return;
      calledRef.current = true;
      const blob = new Blob([JSON.stringify({ kind: 'call' })], { type: 'application/json' });
      // sendBeacon survives the page navigation the tel: link may trigger.
      if (navigator.sendBeacon?.(`/api/menu/demand/${templateId}`, blob)) return;
      void post(templateId, { kind: 'call' }).catch(() => {});
    }
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [templateId]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const form = e.currentTarget;
    const fd = new FormData(form);
    const contactPhone = String(fd.get('phone') ?? '').trim();
    if (!contactPhone) return;
    setBusy(true);
    try {
      await post(templateId, {
        kind: 'order_ahead',
        contactName: String(fd.get('name') ?? '').trim() || undefined,
        contactPhone,
        items: String(fd.get('items') ?? '').trim() || undefined,
      });
      setSent(true);
    } catch {
      setSent(true); // best-effort — never trap the visitor
    } finally {
      setBusy(false);
    }
  }

  const telHref = phone ? `tel:${phone.replace(/[^\d+]/g, '')}` : '';

  return (
    <>
      {/* Trigger: anchored top-center, below the preview watermark. The bottom of the
          screen belongs to the owner's claim bar (the outreach priority) + the sticky
          order bar; a bottom pill would sit hidden behind the (dynamic-height) claim bar. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed top-14 left-1/2 z-[2147483646] -translate-x-1/2 rounded-full border border-sky-400/40 bg-neutral-900/95 px-4 py-2 text-sm font-semibold text-sky-300 shadow-2xl backdrop-blur transition hover:bg-neutral-900 print:hidden"
      >
        🍽 Order online?
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[2147483647] flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center print:hidden"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-950 p-5 text-neutral-100 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {sent ? (
              <div className="text-center">
                <div className="text-3xl">🙌</div>
                <h2 className="mt-2 text-lg font-semibold text-sky-300">Thanks — noted!</h2>
                <p className="mt-1 text-sm text-neutral-300">
                  Online ordering isn’t switched on here yet. To order right now, give them a call:
                </p>
                {telHref && (
                  <a
                    href={telHref}
                    className="mt-3 inline-flex items-center justify-center rounded-full bg-sky-400 px-5 py-2.5 text-sm font-semibold text-neutral-950 transition hover:bg-sky-300"
                  >
                    📞 Call to order
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="mt-4 block w-full text-xs text-neutral-500 hover:text-neutral-300"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={submit}>
                <h2 className="text-lg font-semibold text-sky-300">Want to order online?</h2>
                <p className="mt-1 text-sm text-neutral-400">
                  This spot isn’t taking online orders yet. Leave your number and we’ll let them know
                  there’s demand — the more requests, the sooner they turn it on.
                </p>
                <div className="mt-4 space-y-3">
                  <input
                    name="name"
                    placeholder="Your name (optional)"
                    autoComplete="name"
                    className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm outline-none focus:border-sky-400/60"
                  />
                  <input
                    name="phone"
                    type="tel"
                    required
                    placeholder="Your phone"
                    autoComplete="tel"
                    className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm outline-none focus:border-sky-400/60"
                  />
                  <textarea
                    name="items"
                    rows={2}
                    placeholder="What would you order? (optional)"
                    className="w-full resize-none rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm outline-none focus:border-sky-400/60"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="mt-4 w-full rounded-full bg-sky-400 px-5 py-2.5 text-sm font-semibold text-neutral-950 transition hover:bg-sky-300 disabled:opacity-60"
                >
                  {busy ? 'Sending…' : 'Request online ordering'}
                </button>
                {telHref && (
                  <a
                    href={telHref}
                    className="mt-2 block text-center text-xs text-neutral-400 underline underline-offset-2 hover:text-neutral-200"
                  >
                    or call to order now
                  </a>
                )}
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
