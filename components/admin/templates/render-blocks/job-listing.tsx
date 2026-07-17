'use client';

// components/admin/templates/render-blocks/job-listing.tsx
//
// Job / gig listing — the §10 odd-jobs board's public unit. Shows the gig and an
// apply/submit form. For an AisleAsk cataloging gig (deliverable='ordered_sections')
// the applicant submits an ORDERED list of section names (front-to-back walk order);
// otherwise a cover note. Submits via /api/jobs/apply, which resolves recipient +
// auto-ingest server-side (no client-trusted routing). v0: no payments.

import * as React from 'react';
import type { Block } from '@/types/blocks';

type Props = { block?: Block; content?: Block['content']; template?: any; previewOnly?: boolean };

export default function RenderJobListing({ block, content, template, previewOnly }: Props) {
  const c: any = content ?? block?.content ?? {};
  const kind: string = typeof c.kind === 'string' ? c.kind : 'general';
  const title: string = (c.store_name || c.title || 'One-time gig').trim();
  const location: string = typeof c.location === 'string' ? c.location.trim() : '';
  const pay: string = typeof c.pay === 'string' ? c.pay.trim() : '';
  const instructions: string = typeof c.instructions === 'string' ? c.instructions.trim() : '';
  const isCatalog = c.deliverable === 'ordered_sections';
  const permission: boolean = c.permission_confirmed === true;

  const templateId: string =
    (template as any)?.id ?? (typeof window !== 'undefined' ? (window as any).__QS_TEMPLATE__?.id : '') ?? '';
  const blockId: string = String((block as any)?._id ?? (block as any)?.id ?? '');

  const [name, setName] = React.useState('');
  const [contact, setContact] = React.useState('');
  const [note, setNote] = React.useState('');
  const [sections, setSections] = React.useState<string[]>(['']);
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const setSection = (i: number, v: string) => setSections((arr) => arr.map((s, idx) => (idx === i ? v : s)));
  const addSection = () => setSections((arr) => [...arr, '']);
  const removeSection = (i: number) => setSections((arr) => (arr.length > 1 ? arr.filter((_, idx) => idx !== i) : arr));
  const move = (i: number, dir: -1 | 1) =>
    setSections((arr) => {
      const j = i + dir;
      if (j < 0 || j >= arr.length) return arr;
      const next = [...arr];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const submit = async () => {
    if (busy || previewOnly) return;
    if (!name.trim() || !contact.trim()) { setError('Add your name and how to reach you.'); return; }
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/jobs/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId,
          blockId,
          name,
          contact,
          note,
          sections: isCatalog ? sections.map((s) => s.trim()).filter(Boolean) : undefined,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || 'Could not submit.');
      setDone(true);
    } catch (e: any) {
      setError(e?.message || 'Could not submit.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-primary">
            {isCatalog ? 'Store-walk gig' : 'Gig'}
          </span>
          {pay && <span className="text-sm font-semibold">{pay}</span>}
        </div>
        <h2 className="mt-2 text-xl font-bold tracking-tight">{title}</h2>
        {location && <div className="text-sm text-muted-foreground">{location}</div>}
        {instructions && <p className="mt-3 text-sm leading-relaxed text-foreground/90">{instructions}</p>}
        {isCatalog && permission && (
          <p className="mt-2 text-xs text-muted-foreground">✓ This store has approved cataloging.</p>
        )}

        {done ? (
          <div className="mt-4 rounded-xl bg-emerald-500/10 p-4 text-sm text-emerald-600 dark:text-emerald-300">
            Thanks — your {isCatalog ? 'walk order' : 'application'} was sent. The poster will reach out.
          </div>
        ) : (
          <div className="mt-5 space-y-3 border-t border-border pt-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name"
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
              <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Email or phone"
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
            </div>

            {isCatalog ? (
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">
                  List each section in the order you pass it, front to back:
                </div>
                {sections.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-5 text-right text-xs text-muted-foreground tabular-nums">{i + 1}.</span>
                    <input value={s} onChange={(e) => setSection(i, e.target.value)} placeholder="e.g. Produce"
                      className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-sm outline-none focus:border-primary" />
                    <button type="button" onClick={() => move(i, -1)} className="px-1 text-muted-foreground hover:text-foreground" aria-label="Move up">↑</button>
                    <button type="button" onClick={() => move(i, 1)} className="px-1 text-muted-foreground hover:text-foreground" aria-label="Move down">↓</button>
                    <button type="button" onClick={() => removeSection(i)} className="px-1 text-muted-foreground hover:text-red-500" aria-label="Remove">✕</button>
                  </div>
                ))}
                <button type="button" onClick={addSection} className="text-xs font-medium text-primary hover:underline">+ Add section</button>
              </div>
            ) : (
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="A quick note — why you're a fit, availability…"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
            )}

            {error && <p className="text-sm text-red-500">{error}</p>}
            <button type="button" onClick={submit} disabled={busy}
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
              {busy ? 'Sending…' : isCatalog ? 'Submit walk order' : 'Apply'}
            </button>
            <p className="text-[11px] text-muted-foreground/70">No payment is handled here — arrange pay directly with the poster.</p>
          </div>
        )}
      </div>
    </section>
  );
}
