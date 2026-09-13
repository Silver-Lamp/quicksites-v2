'use client';

// components/admin/ops/guest-leads-panel.tsx
//
// Behind the "Reachable" tile on /admin/ops: every guest-built site, what we know about who built
// it, and one way to reach them per channel — email (mailto:, subject only), text (sms:), or a
// postcard (an address the operator types or confirms, one card, real money).
//
// ⚠️ THE TOOL FINDS PEOPLE; A PERSON WRITES THE MESSAGE. mailto: and sms: links carry no body.
// The postcard's copy is fixed and passes the forbidden-promise test, and it is never sent to an
// address the operator has not looked at: a Places candidate prefills the form, it does not send.
import { useEffect, useMemo, useState } from 'react';
import type { GuestLead } from '@/lib/admin/guestContacts';
import type { GuestFunnel } from '@/lib/admin/guestFunnel';
import { KpiTile } from '@/components/admin/ops/ops-widgets';

/**
 * The "Reachable" tile plus its panel, as one unit: the tile toggles, the panel spans the full
 * row beneath it. Renders as a fragment so the tile stays a grid cell and the panel takes
 * `col-span-full` — the ops grid needs no knowledge of either.
 */
export function GuestReachableTile({ funnel }: { funnel: GuestFunnel }) {
  const [open, setOpen] = useState(false);
  const reachable = funnel.withContact + funnel.withSourceUrl;
  return (
    <>
      <KpiTile
        label="Reachable"
        value={reachable}
        tone={reachable > 0 ? 'info' : 'neutral'}
        sub={`${funnel.withSourceUrl} from a URL · ${funnel.withContact} left a phone/email · click for details`}
        onClick={() => setOpen((v) => !v)}
        active={open}
      />
      <div className="col-span-full">
        <GuestLeadsPanel open={open} onClose={() => setOpen(false)} />
      </div>
    </>
  );
}

type Filter = 'reachable' | 'all';

function minutesLabel(m: number) {
  if (m < 60) return `${m} min`;
  if (m < 60 * 48) return `${Math.round(m / 60)} h`;
  return `${Math.round(m / 1440)} d`;
}

export default function GuestLeadsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [leads, setLeads] = useState<GuestLead[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);
  const [lookedUp, setLookedUp] = useState(false);
  const [filter, setFilter] = useState<Filter>('reachable');

  const load = async (opts: { fetch?: boolean; lookup?: boolean } = {}) => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      if (opts.fetch || fetched) q.set('fetch', '1');
      if (opts.lookup || lookedUp) q.set('lookup', '1');
      const r = await fetch(`/api/admin/guests/leads?${q}`, { cache: 'no-store' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      setLeads(j.leads);
      setFetched(!!j.fetched);
      setLookedUp(!!j.lookedUp);
    } catch (e: any) {
      setError(e?.message || 'Could not load.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (open && !leads && !loading) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const shown = useMemo(() => {
    const all = leads ?? [];
    return filter === 'all' ? all : all.filter((l) => l.reachable || l.lookup?.verdict.show);
  }, [leads, filter]);

  if (!open) return null;
  return (
    <div id="guest-leads" className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-neutral-200">Guest builders we can reach</h3>
          <p className="text-xs text-neutral-500">
            What each site recorded, what its source website shows, and a Places candidate by name (to confirm). Links open your mail or messages app with no message written — the apology is yours to write.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button type="button" onClick={() => setFilter(filter === 'all' ? 'reachable' : 'all')} className="rounded-lg border border-zinc-700 px-2 py-1 text-neutral-300 hover:text-white">
            {filter === 'all' ? 'Show reachable only' : `Show all ${leads?.length ?? ''}`}
          </button>
          <button type="button" disabled={loading || fetched} onClick={() => load({ fetch: true })} className="rounded-lg border border-zinc-700 px-2 py-1 text-neutral-300 hover:text-white disabled:opacity-50" title="Fetch each source website's homepage + contact page (free, slow)">
            {fetched ? 'Source sites fetched' : 'Fetch source sites'}
          </button>
          <button type="button" disabled={loading || lookedUp} onClick={() => load({ lookup: true })} className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-amber-200 hover:bg-amber-500/20 disabled:opacity-50" title="Google Places lookup by business name — paid (~$0.03 a name); results are candidates to confirm, never addresses">
            {lookedUp ? 'Looked up by name' : 'Look up by name (paid)'}
          </button>
          <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-neutral-400 hover:text-white" aria-label="Close">×</button>
        </div>
      </div>
      {error && <div className="mt-2 text-xs text-red-400">{error}</div>}
      {loading && !leads && <div className="mt-3 text-xs text-neutral-500">Loading…</div>}
      {leads && shown.length === 0 && <div className="mt-3 text-xs text-neutral-500">Nothing reachable yet — try fetching source sites or looking up by name.</div>}
      <ul className="mt-3 divide-y divide-zinc-800">
        {shown.map((l) => <LeadRow key={l.templateId} lead={l} />)}
      </ul>
    </div>
  );
}

function LeadRow({ lead: l }: { lead: GuestLead }) {
  const email = (!l.onRecord.emailIsPlaceholder && l.onRecord.email) || l.scraped?.emails[0] || null;
  const phone = l.onRecord.phone || l.scraped?.phones[0] || l.lookup?.candidate?.phone || null;
  const verdict = l.lookup?.verdict ?? null;
  const cand = verdict?.show ? l.lookup!.candidate : null;
  const candTitle = verdict?.show ? `Places match score ${verdict.score.toFixed(2)}${verdict.note ? ` · ${verdict.note}` : ''}` : '';
  const siteUrl = l.slug ? `https://${l.slug}.quicksites.ai` : null;
  const subject = encodeURIComponent(`Your ${l.businessName} website — an apology from QuickSites`);
  const [showCard, setShowCard] = useState(false);
  return (
    <li className="py-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-neutral-100">{l.businessName}</span>
            {siteUrl && <a href={siteUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-300 hover:underline">{siteUrl.replace('https://', '')} ↗</a>}
            <span className="text-xs text-neutral-500">built {l.createdAt.slice(0, 10)} · edited {minutesLabel(l.minutesEdited)}</span>
            {l.bestChannel ? <span className="rounded bg-emerald-500/15 px-1.5 py-px text-[10px] text-emerald-300">{l.bestChannel}</span> : <span className="rounded bg-zinc-800 px-1.5 py-px text-[10px] text-neutral-400">name only</span>}
          </div>
          <div className="mt-1 text-xs text-neutral-400">
            {email && <span className="mr-3">✉ {email}</span>}
            {!email && l.onRecord.email && l.onRecord.emailIsPlaceholder && <span className="mr-3 text-neutral-600" title="Our scaffold's placeholder, not theirs">✉ (placeholder)</span>}
            {phone && <span className="mr-3">☎ {phone}</span>}
            {l.onRecord.sourceUrl && <a href={l.onRecord.sourceUrl} target="_blank" rel="noopener noreferrer" className="mr-3 text-sky-300 hover:underline">their site ↗</a>}
            {l.scraped && !l.scraped.fetched && <span className="mr-3 text-neutral-600">source unreachable</span>}
            {cand && (
              <span className="mr-3 text-amber-200" title={candTitle}>
                CONFIRM ▸ {cand.name} · {cand.address ?? 'no address'}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs">
          <a href={email ? `mailto:${email}?subject=${subject}` : undefined} aria-disabled={!email} className={`rounded-lg border px-2 py-1 ${email ? 'border-zinc-700 text-neutral-200 hover:bg-zinc-800' : 'cursor-not-allowed border-zinc-800 text-neutral-600'}`} title={email ? 'Opens your mail app — subject only, you write the note' : 'No real email on record'}>
            Email
          </a>
          <a href={phone ? `sms:${phone.replace(/[^\d+]/g, '')}` : undefined} aria-disabled={!phone} className={`rounded-lg border px-2 py-1 ${phone ? 'border-zinc-700 text-neutral-200 hover:bg-zinc-800' : 'cursor-not-allowed border-zinc-800 text-neutral-600'}`} title={phone ? 'Opens your messages app — you write the text' : 'No phone on record'}>
            Text
          </a>
          <button type="button" onClick={() => setShowCard((v) => !v)} className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-amber-200 hover:bg-amber-500/20" title="Mail an apology postcard with a QR to their site — you confirm the address; one card, real postage">
            Postcard
          </button>
        </div>
      </div>
      {showCard && <PostcardForm lead={l} candidate={cand} onClose={() => setShowCard(false)} />}
    </li>
  );
}

function splitAddress(formatted: string | null | undefined): { line1: string; city: string; state: string; zip: string } {
  const parts = String(formatted ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const line1 = parts[0] ?? '';
  const city = parts[1] ?? '';
  const m = (parts[2] ?? '').match(/\b([A-Z]{2})\s+(\d{5})/);
  return { line1, city, state: m?.[1] ?? '', zip: m?.[2] ?? '' };
}

function PostcardForm({ lead, candidate, onClose }: { lead: GuestLead; candidate: { name: string; address: string | null } | null; onClose: () => void }) {
  const seed = splitAddress(candidate?.address);
  const [to, setTo] = useState({ name: lead.businessName, line1: seed.line1, city: seed.city, state: seed.state, zip: seed.zip });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const set = (k: keyof typeof to) => (e: React.ChangeEvent<HTMLInputElement>) => setTo((s) => ({ ...s, [k]: e.target.value }));
  const post = async (mode: 'preview' | 'test' | 'send') => {
    setBusy(true);
    setMsg(null);
    try {
      if (mode === 'send' && !window.confirm(`Mail one apology card to ${to.name} at ${to.line1}, ${to.city}, ${to.state} ${to.zip}? This spends postage.`)) return;
      const r = await fetch('/api/admin/guests/postcard', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ templateId: lead.templateId, to, preview: mode === 'preview', test: mode === 'test' }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      if (mode === 'preview') {
        const w = window.open('', '_blank');
        if (!w) throw new Error('Pop-up blocked.');
        const frame = (html: string, label: string) => `<div><div style="font:600 12px system-ui;color:#374151;margin:0 0 6px">${label}</div><iframe style="width:9.25in;height:6.25in;border:0;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.2)" srcdoc="${html.replace(/"/g, '&quot;')}"></iframe></div>`;
        w.document.write(`<title>Apology card — ${lead.businessName}</title><div style="display:flex;flex-direction:column;gap:24px;padding:16px;background:#e5e7eb;min-width:calc(9.25in + 32px)">${frame(j.frontHtml, 'Front')}${frame(j.backHtml, 'Back')}</div>`);
        w.document.close();
        setMsg(`Preview opened · QR → ${j.claimUrl}`);
      } else {
        setMsg(`${mode === 'test' ? 'Test card' : 'Mailed'}: ${j.lobId}${j.expectedDelivery ? ` · expected ${j.expectedDelivery}` : ''}`);
      }
    } catch (e: any) {
      setMsg(`Refused: ${e?.message || 'unknown error'}`);
    } finally {
      setBusy(false);
    }
  };
  const complete = !!(to.name && to.line1 && to.city && /^[A-Za-z]{2}$/.test(to.state) && /^\d{5}(-\d{4})?$/.test(to.zip));
  const cls = 'rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-neutral-100';
  return (
    <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] p-3 text-xs">
      <div className="mb-2 text-amber-200">
        {candidate ? <>Prefilled from the Places candidate <b>{candidate.name}</b> — a guess by name; check it before sending.</> : <>No address on record — type one you have confirmed.</>}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
        <input className={`${cls} sm:col-span-2`} placeholder="Name" value={to.name} onChange={set('name')} />
        <input className={`${cls} sm:col-span-2`} placeholder="Street" value={to.line1} onChange={set('line1')} />
        <input className={cls} placeholder="City" value={to.city} onChange={set('city')} />
        <div className="flex gap-2"><input className={`${cls} w-14`} placeholder="ST" value={to.state} onChange={set('state')} /><input className={`${cls} w-20`} placeholder="ZIP" value={to.zip} onChange={set('zip')} /></div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" disabled={busy} onClick={() => post('preview')} className="rounded-lg border border-zinc-700 px-2 py-1 text-neutral-200 hover:bg-zinc-800 disabled:opacity-50">Preview</button>
        <button type="button" disabled={busy} onClick={() => post('test')} className="rounded-lg border border-zinc-700 px-2 py-1 text-neutral-200 hover:bg-zinc-800 disabled:opacity-50" title="Mails one real card to the configured test address">Mail test card</button>
        <button type="button" disabled={busy || !complete} onClick={() => post('send')} className="rounded-lg bg-amber-500 px-3 py-1 font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50">Mail to this address</button>
        <button type="button" onClick={onClose} className="px-2 py-1 text-neutral-400 hover:text-white">cancel</button>
        {msg && <span className="text-neutral-300">{msg}</span>}
      </div>
    </div>
  );
}
