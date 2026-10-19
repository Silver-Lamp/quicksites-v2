'use client';
// app/admin/texts/texts-client.tsx — the thread list, a composer per thread, and "new text".
// Sends only through POST /api/admin/ppl/text-business (the operator route: a campaign's own
// forward-to, reason 'operator_text', STOP honoured). Dark chrome tokens only.
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

export type ThreadMessage = { id: string; at: string; body: string; direction: 'in' | 'out'; kind: string | null; reason: string | null; ok: boolean | null; error: string | null };
export type Thread = { key: string; campaignId: string | null; business: string | null; domain: string | null; number: string | null; numberDisplay: string; lastAt: string; unansweredInbound: boolean; messages: ThreadMessage[] };
export type LineOption = { campaignId: string; label: string; domain: string; business: string | null; number: string; pitched: boolean };

const SMS_SEGMENT = 160;
const fmt = (iso: string) => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** Words the IVR and the scripts never say; a person may, but the box says so before they do. */
const CAUTION = ['guarantee', 'licensed', 'insured', '24/7', 'rank', 'first page', 'page one', 'google'];

function Composer({ campaignId, toLabel, onSent }: { campaignId: string; toLabel: string; onSent: () => void }) {
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const cautions = useMemo(() => CAUTION.filter((w) => body.toLowerCase().includes(w)), [body]);
  async function send() {
    const text = body.trim();
    if (!text) return;
    if (!window.confirm(`Send this text to ${toLabel}?\n\n${text}`)) return;
    setBusy(true);
    const r = await fetch('/api/admin/ppl/text-business', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ campaignId, body: text }) });
    const j = await r.json().catch(() => null);
    if (r.ok && j?.ok) { setMsg(`Sent to ${j.to}. A copy is in your email.`); setBody(''); onSent(); }
    else setMsg(`Not sent: ${j?.error || r.status}${j?.detail ? ` — ${j.detail}` : ''}`);
    setBusy(false);
  }
  return (
    <div className="mt-2">
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={600} placeholder={`Write to ${toLabel}…`} className="w-full rounded border border-border bg-background px-3 py-2 text-sm" />
      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <span>{body.length} chars · {Math.max(1, Math.ceil(body.length / SMS_SEGMENT))} segment{body.length > SMS_SEGMENT ? 's' : ''}</span>
        {cautions.length > 0 && <span className="text-amber-600 dark:text-amber-300">Careful: "{cautions.join('", "')}" — the scripts never promise these.</span>}
        <button type="button" disabled={busy || !body.trim()} onClick={send} className="ml-auto rounded bg-primary px-3 py-1 text-sm text-primary-foreground disabled:opacity-50">{busy ? 'Sending…' : 'Send text'}</button>
      </div>
      {msg && <p role="status" className="mt-1 rounded border border-border bg-muted px-2 py-1 text-xs">{msg}</p>}
    </div>
  );
}

export default function TextsClient({ threads, lines }: { threads: Thread[]; lines: LineOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(threads[0]?.key ?? null);
  const [newTo, setNewTo] = useState<string>('');
  const refresh = () => router.refresh();
  const newLine = lines.find((l) => l.campaignId === newTo) ?? null;

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[22rem_1fr]">
      <aside>
        <div className="rounded-lg border border-border bg-card p-3 text-card-foreground">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">New text</div>
          <select value={newTo} onChange={(e) => setNewTo(e.target.value)} className="mt-2 w-full rounded border border-border bg-background px-2 py-1 text-sm">
            <option value="">Pick a line…</option>
            {lines.map((l) => <option key={l.campaignId} value={l.campaignId}>{l.label}{l.pitched ? ' · pitched' : ''}</option>)}
          </select>
          {newLine && <Composer campaignId={newLine.campaignId} toLabel={`${newLine.business || newLine.number} (${newLine.domain})`} onSent={() => { setNewTo(''); refresh(); }} />}
        </div>
        <ul className="mt-4 space-y-1">
          {threads.length === 0 && <li className="text-sm text-muted-foreground">No texts yet. Every text from now on lands here, both directions.</li>}
          {threads.map((t) => {
            const last = t.messages[t.messages.length - 1];
            return (
              <li key={t.key}>
                <button type="button" onClick={() => setOpen(t.key)} className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${open === t.key ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'}`}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-medium">{t.business || t.numberDisplay}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{fmt(t.lastAt)}</span>
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{t.domain ?? 'no campaign'}{last ? ` · ${last.direction === 'in' ? '←' : '→'} ${last.body.slice(0, 48)}` : ''}</div>
                  {t.unansweredInbound && <div className="mt-1 inline-block rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 text-[11px]">they wrote last — answer them</div>}
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <section>
        {threads.filter((t) => t.key === open).map((t) => (
          <div key={t.key} className="rounded-lg border border-border bg-card p-4 text-card-foreground">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold">{t.business || t.numberDisplay}</h2>
              <span className="text-xs text-muted-foreground">{t.numberDisplay}{t.domain ? ` · ${t.domain}` : ''}</span>
            </div>
            <ol className="mt-3 space-y-2">
              {t.messages.map((m) => (
                <li key={m.id} className={`max-w-[85%] rounded-lg border px-3 py-2 text-sm ${m.direction === 'in' ? 'border-emerald-500/30 bg-emerald-500/5' : 'ml-auto border-border bg-background/60'}`}>
                  <div className="text-[11px] text-muted-foreground">{m.direction === 'in' ? '← them' : `→ us${m.reason ? ` · ${m.reason}` : ''}${m.ok === false ? ` · FAILED${m.error ? `: ${m.error}` : ''}` : ''}`}{m.kind && m.kind !== 'reply' ? ` · ${m.kind.toUpperCase()}` : ''} · {fmt(m.at)}</div>
                  <div className="mt-0.5 whitespace-pre-wrap">{m.body}</div>
                </li>
              ))}
            </ol>
            {t.campaignId ? (
              <Composer campaignId={t.campaignId} toLabel={`${t.business || t.numberDisplay}${t.domain ? ` (${t.domain})` : ''}`} onSent={refresh} />
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">This number is not the forward-to of any campaign, so there is no line to answer from here. Read it; if it is a business we re-pointed away from, call them.</p>
            )}
          </div>
        ))}
        {!open && <p className="text-sm text-muted-foreground">Pick a thread.</p>}
      </section>
    </div>
  );
}
