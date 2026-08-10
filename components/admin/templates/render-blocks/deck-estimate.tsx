'use client';

// components/admin/templates/render-blocks/deck-estimate.tsx
//
// Instant deck estimate — the DeckSketch↔QuickSites seam (contract:
// crosstalk/contracts/deck-estimate-embed.md, Status: LIVE). Homeowner enters a few
// dimensions → we POST the QS proxy (/api/commerce/deck-estimate), which forwards
// server-to-server to DeckSketch's BOM engine and returns a price RANGE + honest
// assumptions. The range is never a single number, and the excluded-costs fine print
// is shown so the builder isn't undercut by a lowball. A SEPARATE lead step
// (name/email/phone) fires the QS submission rail to the builder — the estimate call
// itself is stateless + PII-free.

import * as React from 'react';
import type { Block } from '@/types/blocks';
import { isTradeKey, type TradeKey } from '@/lib/commerce/quoteEstimator';
import QuoteEstimatorForm from './quote-estimator-form';

type Props = { block?: Block; content?: Block['content']; template?: any; previewOnly?: boolean };
type Tier = 'pressure_treated' | 'cedar' | 'composite';
type Estimate = {
  low_cents: number; high_cents: number; currency: string;
  label: string; confidence: 'rough' | 'refined'; assumptions: string[];
};

const TIER_LABEL: Record<Tier, string> = {
  pressure_treated: 'Pressure-treated',
  cedar: 'Cedar',
  composite: 'Composite',
};
const s = (v: any) => (typeof v === 'string' ? v.trim() : '');

export default function RenderDeckEstimate({ block, content, template, previewOnly }: Props) {
  const c: any = content ?? block?.content ?? {};
  const title = s(c.title) || 'Instant deck estimate';
  const subtitle = s(c.subtitle);
  const ctaText = s(c.cta_text) || 'Get this quote from us';
  const showRefiners = c.show_refiners !== false;
  const defaultTier: Tier = (['pressure_treated', 'cedar', 'composite'] as Tier[]).includes(c.default_material_tier)
    ? c.default_material_tier
    : 'pressure_treated';

  const templateId: string =
    (template as any)?.id ?? (typeof window !== 'undefined' ? (window as any).__QS_TEMPLATE__?.id : '') ?? '';
  const blockId: string = String((block as any)?._id ?? (block as any)?.id ?? '');

  // Non-deck trades (fence/concrete/roofing/…) render the generic registry-driven form;
  // deck keeps its own hand-tuned UI below. All 9 trades are LIVE on the DeckSketch endpoint.
  const trade: TradeKey = isTradeKey(c.trade) ? c.trade : 'deck';
  if (trade !== 'deck') {
    return (
      <QuoteEstimatorForm
        trade={trade}
        title={title}
        subtitle={subtitle}
        ctaText={ctaText}
        templateId={templateId}
        blockId={blockId}
        previewOnly={previewOnly}
      />
    );
  }

  // dimensions
  const [lengthFt, setLengthFt] = React.useState('');
  const [widthFt, setWidthFt] = React.useState('');
  const [heightFt, setHeightFt] = React.useState('2');
  const [attached, setAttached] = React.useState(true);
  const [tier, setTier] = React.useState<Tier>(defaultTier);
  const [stairs, setStairs] = React.useState(false);
  const [railingFt, setRailingFt] = React.useState('');

  const [est, setEst] = React.useState<Estimate | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // lead
  const [name, setName] = React.useState('');
  const [contact, setContact] = React.useState('');
  const [note, setNote] = React.useState('');
  const [leadBusy, setLeadBusy] = React.useState(false);
  const [leadDone, setLeadDone] = React.useState(false);
  const [leadErr, setLeadErr] = React.useState<string | null>(null);

  const areaReady = Number(lengthFt) > 0 && Number(widthFt) > 0;
  const sqft = areaReady ? Math.round(Number(lengthFt) * Number(widthFt)) : 0;

  const getEstimate = async () => {
    if (busy || previewOnly) return;
    if (!areaReady) { setError('Enter the deck length and width.'); return; }
    setBusy(true); setError(null); setLeadDone(false);
    try {
      const payload: any = {
        templateId,
        trade: typeof c.trade === 'string' ? c.trade : 'deck',
        length_ft: Number(lengthFt),
        width_ft: Number(widthFt),
        height_ft: Number(heightFt) || undefined,
        attached,
        material_tier: tier,
      };
      if (showRefiners) {
        if (stairs) payload.stairs = true;
        if (Number(railingFt) > 0) payload.railing_ft = Number(railingFt);
      }
      const res = await fetch('/api/commerce/deck-estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || 'Could not get an estimate.');
      setEst(j.estimate as Estimate);
    } catch (e: any) {
      setError(e?.message || 'Could not get an estimate.');
    } finally {
      setBusy(false);
    }
  };

  const submitLead = async () => {
    if (leadBusy || previewOnly) return;
    if (!name.trim() || !contact.trim()) { setLeadErr('Add your name and how to reach you.'); return; }
    setLeadBusy(true); setLeadErr(null);
    try {
      const specs = `${sqft} sqft · ${TIER_LABEL[tier]} · ${heightFt || '?'} ft high · ${attached ? 'attached' : 'freestanding'}${stairs ? ' · stairs' : ''}${Number(railingFt) > 0 ? ` · ${railingFt} ft railing` : ''}`;
      const res = await fetch('/api/commerce/deck-estimate/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId, blockId, name, contact, note,
          estimateLabel: est?.label || '', specs,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || 'Could not send.');
      setLeadDone(true);
    } catch (e: any) {
      setLeadErr(e?.message || 'Could not send.');
    } finally {
      setLeadBusy(false);
    }
  };

  const inputCls = 'rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary';

  return (
    <section id="deck-estimate" className="mx-auto w-full max-w-2xl px-4 py-8">
      <div className="rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm">
        <h2 className="text-xl font-bold tracking-tight">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}

        {/* Dimensions */}
        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Length (ft)
              <input inputMode="decimal" value={lengthFt} onChange={(e) => setLengthFt(e.target.value)} placeholder="16" className={inputCls} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Width (ft)
              <input inputMode="decimal" value={widthFt} onChange={(e) => setWidthFt(e.target.value)} placeholder="20" className={inputCls} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Height (ft)
              <input inputMode="decimal" value={heightFt} onChange={(e) => setHeightFt(e.target.value)} placeholder="2" className={inputCls} />
            </label>
          </div>
          {sqft > 0 && <div className="text-xs text-muted-foreground">≈ <span className="font-semibold text-foreground">{sqft.toLocaleString()} sqft</span></div>}

          <div className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Material
            <div className="flex flex-wrap gap-2">
              {(Object.keys(TIER_LABEL) as Tier[]).map((t) => (
                <button key={t} type="button" onClick={() => setTier(t)}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${tier === t ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-accent'}`}>
                  {TIER_LABEL[t]}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={attached} onChange={(e) => setAttached(e.target.checked)} className="h-4 w-4" />
            Attached to the house <span className="text-muted-foreground">(vs. freestanding)</span>
          </label>

          {showRefiners && (
            <div className="flex flex-wrap items-center gap-4 border-t border-border pt-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={stairs} onChange={(e) => setStairs(e.target.checked)} className="h-4 w-4" />
                Stairs
              </label>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                Railing (ft)
                <input inputMode="decimal" value={railingFt} onChange={(e) => setRailingFt(e.target.value)} placeholder="0" className={`w-20 ${inputCls}`} />
              </label>
            </div>
          )}

          <button type="button" onClick={getEstimate} disabled={busy || previewOnly}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {busy ? 'Estimating…' : est ? 'Re-estimate' : 'Get my estimate'}
          </button>
          {error && <div className="text-sm text-red-500">{error}</div>}
        </div>

        {/* Result */}
        {est && (
          <div className="mt-6 rounded-xl border border-border bg-background p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ballpark estimate</div>
            <div className="mt-1 text-2xl font-extrabold tabular-nums">{est.label}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {est.confidence === 'refined' ? 'Refined estimate' : 'Rough estimate'} — a range, not a quote.
            </div>
            {est.assumptions?.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                {est.assumptions.map((a, i) => <li key={i}>• {a}</li>)}
              </ul>
            )}

            {/* Lead capture — separate step, fires the QS submission rail to the builder */}
            <div className="mt-5 border-t border-border pt-4">
              {leadDone ? (
                <div className="rounded-lg bg-emerald-500/10 p-4 text-sm text-foreground">
                  Thanks — we’ll be in touch with a real quote.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-sm font-semibold">{ctaText}</div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className={inputCls} />
                    <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Email or phone" className={inputCls} />
                  </div>
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
                    placeholder="Anything else? (timeline, ideas, questions)" className={`w-full ${inputCls}`} />
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

        <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
          Estimates are ballpark figures and don’t replace a site visit. Powered by DeckSketch.
        </p>
      </div>
    </section>
  );
}
