'use client';

// components/admin/templates/render-blocks/quote-estimator-form.tsx
//
// The generic (non-deck) trade estimator — data-driven from TRADE_REGISTRY
// (contract quote-estimate-embed.md, all trades LIVE). Renders each trade's fields
// (area + enums/dimensions/refiners), posts to the shared QS proxy with `trade`, and
// shows the identical range + honest assumptions + the same lead-capture rail as deck.
// Deck keeps its own hand-tuned renderer (deck-estimate.tsx); this covers the other 8.

import * as React from 'react';
import { TRADE_REGISTRY, type TradeKey, type FieldDef } from '@/lib/commerce/quoteEstimator';

type Estimate = { low_cents: number; high_cents: number; currency: string; label: string; confidence: 'rough' | 'refined'; assumptions: string[] };
type Props = {
  trade: TradeKey;
  title: string;
  subtitle: string;
  ctaText: string;
  recipientPresent?: boolean;
  templateId: string;
  blockId: string;
  previewOnly?: boolean;
};

const inputCls = 'rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary';

export default function QuoteEstimatorForm({ trade, title, subtitle, ctaText, templateId, blockId, previewOnly }: Props) {
  const def = TRADE_REGISTRY[trade];

  // Field state, seeded from registry defaults (selects/booleans get their defaults).
  const initVals = React.useMemo(() => {
    const v: Record<string, any> = {};
    for (const f of def.fields) {
      if (f.default !== undefined) v[f.key] = f.default;
      else if (f.type === 'boolean') v[f.key] = false;
      else v[f.key] = '';
    }
    return v;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trade]);
  const [vals, setVals] = React.useState<Record<string, any>>(initVals);
  React.useEffect(() => setVals(initVals), [initVals]);
  const [lengthFt, setLengthFt] = React.useState('');
  const [widthFt, setWidthFt] = React.useState('');

  const [est, setEst] = React.useState<Estimate | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [name, setName] = React.useState('');
  const [contact, setContact] = React.useState('');
  const [note, setNote] = React.useState('');
  const [leadBusy, setLeadBusy] = React.useState(false);
  const [leadDone, setLeadDone] = React.useState(false);
  const [leadErr, setLeadErr] = React.useState<string | null>(null);

  const num = (v: any) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : undefined; };
  const sqft = def.area && num(lengthFt) && num(widthFt) ? Math.round(num(lengthFt)! * num(widthFt)!) : 0;
  const setVal = (k: string, v: any) => setVals((p) => ({ ...p, [k]: v }));

  const buildPayload = () => {
    const payload: any = { templateId, trade };
    if (def.area) { payload.length_ft = num(lengthFt); payload.width_ft = num(widthFt); }
    for (const f of def.fields) {
      const raw = vals[f.key];
      if (f.type === 'boolean') { if (raw) payload[f.key] = true; }
      else if (f.type === 'select') { if (raw) payload[f.key] = raw; }
      else { const n = num(raw); if (n != null) payload[f.key] = n; }
    }
    return payload;
  };

  const getEstimate = async () => {
    if (busy || previewOnly) return;
    setBusy(true); setError(null); setLeadDone(false);
    try {
      const res = await fetch('/api/commerce/deck-estimate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(buildPayload()),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || 'Could not get an estimate.');
      setEst(j.estimate as Estimate);
    } catch (e: any) {
      setError(e?.message || 'Could not get an estimate.');
    } finally { setBusy(false); }
  };

  const submitLead = async () => {
    if (leadBusy || previewOnly) return;
    if (!name.trim() || !contact.trim()) { setLeadErr('Add your name and how to reach you.'); return; }
    setLeadBusy(true); setLeadErr(null);
    try {
      const specParts = [
        def.area && sqft ? `${sqft} sqft` : '',
        ...def.fields.map((f) => (vals[f.key] && vals[f.key] !== false ? `${f.label}: ${vals[f.key] === true ? 'yes' : vals[f.key]}` : '')),
      ].filter(Boolean);
      const res = await fetch('/api/commerce/deck-estimate/lead', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId, blockId, name, contact, note, estimateLabel: est?.label || '', specs: specParts.join(' · ') }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || 'Could not send.');
      setLeadDone(true);
    } catch (e: any) {
      setLeadErr(e?.message || 'Could not send.');
    } finally { setLeadBusy(false); }
  };

  const renderField = (f: FieldDef) => {
    if (f.type === 'boolean') {
      return (
        <label key={f.key} className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!vals[f.key]} onChange={(e) => setVal(f.key, e.target.checked)} className="h-4 w-4" />
          {f.label}
        </label>
      );
    }
    if (f.type === 'select') {
      return (
        <div key={f.key} className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          {f.label}
          <div className="flex flex-wrap gap-2">
            {f.options?.map((o) => (
              <button key={o.value} type="button" onClick={() => setVal(f.key, o.value)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${vals[f.key] === o.value ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-accent'}`}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      );
    }
    return (
      <label key={f.key} className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        {f.label}{f.unit ? ` (${f.unit})` : ''}
        <input inputMode="decimal" value={vals[f.key] ?? ''} onChange={(e) => setVal(f.key, e.target.value)} className={inputCls} />
      </label>
    );
  };

  return (
    <section id="deck-estimate" className="mx-auto w-full max-w-2xl px-4 py-8">
      <div className="rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm">
        <h2 className="text-xl font-bold tracking-tight">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}

        <div className="mt-5 space-y-4">
          {def.area && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">Length (ft)
                  <input inputMode="decimal" value={lengthFt} onChange={(e) => setLengthFt(e.target.value)} placeholder="20" className={inputCls} /></label>
                <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">Width (ft)
                  <input inputMode="decimal" value={widthFt} onChange={(e) => setWidthFt(e.target.value)} placeholder="20" className={inputCls} /></label>
              </div>
              {sqft > 0 && <div className="text-xs text-muted-foreground">≈ <span className="font-semibold text-foreground">{sqft.toLocaleString()} sqft</span></div>}
            </>
          )}
          {def.fields.map(renderField)}

          <button type="button" onClick={getEstimate} disabled={busy || previewOnly}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {busy ? 'Estimating…' : est ? 'Re-estimate' : 'Get my estimate'}
          </button>
          {error && <div className="text-sm text-red-500">{error}</div>}
        </div>

        {est && (
          <div className="mt-6 rounded-xl border border-border bg-background p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ballpark materials cost</div>
            <div className="mt-1 text-2xl font-extrabold tabular-nums">{est.label}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{est.confidence === 'refined' ? 'Refined estimate' : 'Rough estimate'} — a range, not a quote.</div>
            {est.assumptions?.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-muted-foreground">{est.assumptions.map((a, i) => <li key={i}>• {a}</li>)}</ul>
            )}
            <div className="mt-5 border-t border-border pt-4">
              {leadDone ? (
                <div className="rounded-lg bg-emerald-500/10 p-4 text-sm text-emerald-600 dark:text-emerald-300">Thanks — we’ll be in touch with a real quote.</div>
              ) : (
                <div className="space-y-3">
                  <div className="text-sm font-semibold">{ctaText}</div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className={inputCls} />
                    <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Email or phone" className={inputCls} />
                  </div>
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Anything else? (timeline, ideas, questions)" className={`w-full ${inputCls}`} />
                  <button type="button" onClick={submitLead} disabled={leadBusy || previewOnly}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
                    {leadBusy ? 'Sending…' : 'Send my details'}
                  </button>
                  {leadErr && <div className="text-sm text-red-500">{leadErr}</div>}
                </div>
              )}
            </div>
          </div>
        )}

        <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">Estimates are ballpark materials costs only and don’t replace a site visit. Powered by DeckSketch.</p>
      </div>
    </section>
  );
}
