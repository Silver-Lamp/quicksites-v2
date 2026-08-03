'use client';

// components/admin/templates/render-blocks/cloud-savings-agency.tsx
//
// A BESPOKE WHOLE-PAGE BLOCK — one block renders the entire landing page.
//
// ⚠️ THIS PATTERN IS DELIBERATE HERE AND SHOULD NOT SPREAD BY DEFAULT. It exists so the owner can
// compare it against the composed-block version of the same site. Read docs/CUSTOM_SITES.md §6b
// before adding another, because the costs are real and were measured on the last one:
//
//   • It does NOT inherit fleet-wide fixes. When the SSR gate, the footer leaks and the
//     hard-coded-white bug were fixed across the block library this week, a private block would
//     have improved only if someone remembered it existed.
//   • The previous bespoke block (PNW Prestige, 2025-10) grew to 556 lines and spawned THREE
//     schema keys plus FOUR aliases for one client.
//   • It lives outside the composed rhythm: you cannot drop a testimonial above it or reorder
//     its parts without editing this file.
//
// What it buys is layout the block library cannot express — a continuous narrative page rather
// than a stack of independently-themed sections.
//
// ⚠️ COLOUR COMES FROM THEME TOKENS ONLY. The last bespoke block was designed against one
// client's palette and escaped both fleet-wide guards purely by living in another directory
// (fixed 2026-08-02 — both sweeps now cover both). No hex, no bg-white, no literal light fills:
// a tenant site is NOT always dark, and a hard-coded colour is invisible until the day it isn't.
import * as React from 'react';
import BillRedactionReview from '@/components/site/bill-redaction-review';
import { isEditorContext } from '@/lib/editor/isEditorContext';
import type { SavingsEstimate } from '@/lib/billing/estimateSavings';

type ProofPoint = { label: string; detail?: string };
type Props = { block?: any; content?: any; template?: any; previewOnly?: boolean };

const pick = (block: any, content: any) => content ?? block?.content ?? block?.props ?? {};

export default function CloudSavingsAgencyRender({ block, content, template, previewOnly }: Props) {
  const c = pick(block, content);
  const [result, setResult] = React.useState<SavingsEstimate | null>(null);
  const [busy, setBusy] = React.useState(false);
  const inEditor = previewOnly || isEditorContext(previewOnly);

  const submit = async (text: string) => {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch('/api/billing/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, templateId: template?.id ?? null }),
      });
      const json = await res.json();
      if (res.ok) setResult(json.estimate as SavingsEstimate);
    } catch {
      /* the review pane keeps their text; a failed estimate is not a lost document */
    } finally {
      setBusy(false);
    }
  };

  const proof: ProofPoint[] = Array.isArray(c.proof_points) ? c.proof_points : [];

  return (
    <div className="w-full bg-background text-foreground">
      {/* ── Opening band ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="pointer-events-none absolute inset-0 -z-10 opacity-[0.07]"
             style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, hsl(var(--primary)) 0, transparent 45%)' }} />
        <div className="mx-auto max-w-4xl px-6 py-20 sm:py-28">
          <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-6xl">
            {c.headline || 'Find out what your cloud bill should cost.'}
          </h1>
          {c.subheadline && (
            <p className="mt-5 max-w-2xl text-lg text-muted-foreground">{c.subheadline}</p>
          )}
          <a
            href="#estimate"
            className="mt-8 inline-block rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground transition hover:opacity-90"
          >
            Start with one invoice
          </a>
        </div>
      </section>

      {/* ── Proof strip ──────────────────────────────────────────────── */}
      {!!proof.length && (
        <section className="border-b border-border bg-muted/30">
          <div className="mx-auto grid max-w-4xl gap-6 px-6 py-10 sm:grid-cols-3">
            {proof.map((p, i) => (
              <div key={i}>
                <div className="text-sm font-semibold text-foreground">{p.label}</div>
                {p.detail && <div className="mt-1 text-sm text-muted-foreground">{p.detail}</div>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── The estimator, inline rather than a separate section ─────── */}
      <section id="estimate" className="border-b border-border">
        <div className="mx-auto max-w-2xl px-6 py-16">
          {/* ⚠️ THE FEE DISCLOSURE HAS TO CLEAR THE UPLOAD CONTROL, NOT JUST EXIST ON THE PAGE.
              It lived in the "who you are talking to" section further down, which put it ~600px
              BELOW the control that takes someone's invoice: you were asked to hand over billing
              data before learning that a provider pays the person receiving it. That is a
              sequencing failure, and a correctly-worded disclosure in the wrong place still
              produces the "wait, who are you working for" moment — just later, and after you have
              already handed over the document. It renders in both places; this is the one that
              arrives in time. */}
          {c.fee_disclosure && (
            <p className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-foreground">
              {c.fee_disclosure}
            </p>
          )}

          {c.provider_claim && (
            // A third party's figure, attributed in the markup as well as the copy.
            <p className="mb-6 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              {c.provider_name ? `${c.provider_name} publishes: ` : 'The provider publishes: '}
              <span className="text-foreground">{c.provider_claim}</span>{' '}
              {/* ⚠️ A NEGATION IS THE WRONG SHAPE FOR A DISCLAIMER HERE. This read "— their figure,
                which this estimate does not assume", which raises "then what DOES it assume?" and
                never answers — drawing attention to a gap and leaving it open is worse than either
                asserting the number or omitting it. Attribution stays; the second clause now
                answers the question it provokes, which also turns the weak spot into the ask. */}
            <span className="italic">— their published figure. Send yours and find out what it actually is, for you.</span>
            </p>
          )}

          {inEditor ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              Upload + estimate appears here on the published site.
            </p>
          ) : (
            <BillRedactionReview onReady={submit} />
          )}

          {busy && <p className="mt-4 text-sm text-muted-foreground">Reading the figures…</p>}

          {result && (
            <div className="mt-6 rounded-2xl border border-border bg-card p-5">
              {result.recommendSwitch ? (
                <>
                  <div className="text-sm text-muted-foreground">Estimated saving</div>
                  <div className="text-3xl font-bold">{result.lowPct}–{result.highPct}%</div>
                </>
              ) : (
                // Same weight as a yes. See bill-estimator.tsx for why this is not negotiable.
                <>
                  <div className="text-sm text-muted-foreground">Our read</div>
                  <div className="text-xl font-semibold">Moving probably wouldn’t pay for you.</div>
                </>
              )}
              {result.summary && <p className="mt-3 text-sm">{result.summary}</p>}
              {!!result.assumptions.length && (
                <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {result.assumptions.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              )}
              <p className="mt-4 text-xs text-muted-foreground">
                An estimate from one bill, not a quote.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── Who and how they're paid, in one breath ───────────────────── */}
      {(c.operator_name || c.fee_disclosure) && (
        <section>
          <div className="mx-auto max-w-2xl px-6 py-16">
            {c.operator_name && <h2 className="text-2xl font-bold tracking-tight">{c.operator_name}</h2>}
            {c.operator_bio && (
              <p className="mt-3 whitespace-pre-line text-muted-foreground">{c.operator_bio}</p>
            )}
            {c.fee_disclosure && (
              // Deliberately not a footnote: how someone is paid belongs beside who they are.
              <p className="mt-5 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-foreground">
                {c.fee_disclosure}
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
