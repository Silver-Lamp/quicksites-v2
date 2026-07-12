'use client';

// Pre-send preview + cost-confirm for a postcard batch. Renders the REAL personalized
// sample card (front+back), the deliverability breakdown (who mails vs who's dropped for
// a bad address), and the estimated spend — so an operator confirms a paid Lob send with
// eyes open. Populated by the dry-run route /api/admin/prospects/mail-postcards/preview.
import { formatCents } from '@/lib/outreach/geoPricing';

export type MailPreviewData = {
  domain: string;
  totalProspects: number;
  considered: number;
  capped: boolean;
  maxPerSend: number;
  mailableCount: number;
  undeliverable: { id: string; name: string; reason: string }[];
  deadline: string;
  estimate: { unitCents: number; totalCents: number; isEstimate: boolean };
  sample: { toName: string; frontHtml: string; backHtml: string } | null;
};

export default function MailPreviewModal({
  data: d,
  sending,
  onCancel,
  onConfirm,
}: {
  data: MailPreviewData;
  sending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto bg-black/70 p-4 sm:p-8" onClick={() => !sending && onCancel()}>
      <div className="my-4 w-full max-w-3xl rounded-2xl border border-neutral-700 bg-neutral-900 p-5 text-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">Mail postcards — <span className="font-mono text-amber-300">{d.domain}</span></h3>
            <p className="mt-1 text-sm text-neutral-400">Review before sending. This spends real money at Lob.</p>
          </div>
          <button onClick={() => !sending && onCancel()} className="rounded-full p-1 text-neutral-500 hover:text-white" aria-label="Close">✕</button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-emerald-900/60 bg-emerald-950/20 p-3">
            <div className="text-2xl font-bold text-emerald-300">{d.mailableCount}</div>
            <div className="text-xs text-neutral-400">will mail</div>
          </div>
          <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-3">
            <div className="text-2xl font-bold text-white">{formatCents(d.estimate.totalCents)}</div>
            <div className="text-xs text-neutral-400">est. cost · {formatCents(d.estimate.unitCents)}/card</div>
          </div>
          <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-3">
            <div className="text-2xl font-bold text-amber-300">{d.deadline}</div>
            <div className="text-xs text-neutral-400">printed claim deadline</div>
          </div>
        </div>

        {d.capped && (
          <p className="mt-3 text-xs text-amber-400/90">
            Capped at {d.maxPerSend} per send — {d.totalProspects} in this campaign; the rest mail on a follow-up send.
          </p>
        )}

        {d.undeliverable.length > 0 && (
          <div className="mt-3 rounded-xl border border-red-900/50 bg-red-950/20 p-3">
            <div className="text-xs font-semibold text-red-300">{d.undeliverable.length} skipped — no mailable address</div>
            <ul className="mt-1 space-y-0.5 text-xs text-neutral-400">
              {d.undeliverable.slice(0, 6).map((u) => <li key={u.id} className="truncate">• {u.name}</li>)}
              {d.undeliverable.length > 6 && <li className="text-neutral-500">+{d.undeliverable.length - 6} more</li>}
            </ul>
          </div>
        )}

        {d.sample ? (
          <div className="mt-4">
            <div className="mb-2 text-xs font-medium text-neutral-500">Sample card for <span className="text-neutral-300">{d.sample.toName}</span> (front &amp; back)</div>
            <div className="flex flex-wrap justify-center gap-4">
              {([['Front', d.sample.frontHtml], ['Back', d.sample.backHtml]] as const).map(([label, html]) => (
                <div key={label} className="text-center">
                  <div className="mb-1 text-[10px] uppercase tracking-wide text-neutral-500">{label}</div>
                  <div className="overflow-hidden rounded-lg border border-neutral-700" style={{ width: 242, height: 363 }}>
                    <iframe
                      title={`${label} preview`}
                      srcDoc={html}
                      sandbox=""
                      style={{ width: 576, height: 864, border: 0, transform: 'scale(0.42)', transformOrigin: 'top left' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-red-900/50 bg-red-950/20 p-3 text-sm text-red-300">
            No mailable recipients — every address failed to parse. Nothing to send.
          </div>
        )}

        <div className="mt-5 flex items-center justify-end gap-3">
          <button onClick={onCancel} disabled={sending} className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800 disabled:opacity-50">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={sending || d.mailableCount === 0}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-amber-400 disabled:opacity-50"
          >
            {sending ? 'Sending…' : `Send ${d.mailableCount} — ${formatCents(d.estimate.totalCents)}`}
          </button>
        </div>
        <p className="mt-2 text-right text-[11px] text-neutral-600">Cost is an estimate; Lob’s invoice is authoritative.</p>
      </div>
    </div>
  );
}
