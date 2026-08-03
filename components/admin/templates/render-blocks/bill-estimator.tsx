'use client';

// components/admin/templates/render-blocks/bill-estimator.tsx
//
// The site-placeable version of the bill uploader: a visitor uploads a cloud bill, it is read and
// redacted IN THEIR BROWSER, they approve exactly what gets sent, and they get a savings RANGE.
//
// The custody argument lives in components/site/bill-redaction-review.tsx and is not repeated
// here — this file is the block wrapper plus the result rendering, which carries its own
// honesty duty:
//
// ⚠️ THE RESULT MUST NEVER READ AS A QUOTE. It is an estimate from one bill, shown to someone
// deciding whether to move production workloads. So the range, the assumptions and the
// "estimate, not a quote" line render together — an assumption in a tooltip or a footer is an
// assumption nobody reads.
//
// ⚠️ AND THE "DON'T SWITCH" ANSWER IS RENDERED AS PROMINENTLY AS THE GOOD NEWS. When
// `recommendSwitch` is false the block says so plainly instead of burying it under a percentage.
// The site's own FAQ promises "if it is not a fit, I tell you"; this component is where that is
// kept or quietly broken, and the tempting design — big green number, caveat below the fold — is
// exactly the break.
import * as React from 'react';
import SectionShell from '@/components/ui/section-shell';
import BillRedactionReview from '@/components/site/bill-redaction-review';
import { isEditorContext } from '@/lib/editor/isEditorContext';
import type { SavingsEstimate } from '@/lib/billing/estimateSavings';

type Props = {
  block?: any;
  content?: any;
  template?: any;
  previewOnly?: boolean;
  compact?: boolean;
};

const pickContent = (block: any, content: any) => content ?? block?.content ?? block?.props ?? {};

export default function BillEstimatorRender({ block, content, template, previewOnly }: Props) {
  const c = pickContent(block, content);
  const [result, setResult] = React.useState<SavingsEstimate | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async (redactedText: string) => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/billing/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: redactedText, templateId: template?.id ?? null }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || 'That didn’t work. Nothing was saved.');
        return;
      }
      setResult(json.estimate as SavingsEstimate);
    } catch {
      setError('That didn’t work. Nothing was saved.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SectionShell>
      <div className="mx-auto max-w-2xl">
        <h2 className="text-2xl font-bold tracking-tight">{c.title || 'Send a bill, not your account details'}</h2>
        {c.blurb && <p className="mt-2 text-muted-foreground">{c.blurb}</p>}

        {/* A third party's figure stays attributed to them, in the data model and on the page. */}
        {c.provider_claim && (
          <p className="mt-3 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
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

        <div className="mt-6">
          {/* previewOnly: in the editor we show the shell, not a live upload surface — an owner
              arranging blocks should not be able to accidentally post a document. */}
          {previewOnly || isEditorContext(previewOnly) ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              Upload + estimate appears here on the published site.
            </p>
          ) : (
            <BillRedactionReview onReady={submit} />
          )}
        </div>

        {busy && <p className="mt-4 text-sm text-muted-foreground">Reading the figures…</p>}
        {error && (
          <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-foreground">
            {error}
          </p>
        )}

        {result && (
          <div className="mt-6 rounded-2xl border border-border bg-card p-5">
            {result.recommendSwitch ? (
              <>
                <div className="text-sm text-muted-foreground">Estimated saving</div>
                <div className="text-3xl font-bold text-foreground">
                  {result.lowPct}–{result.highPct}%
                </div>
              </>
            ) : (
              // The honest no, rendered at the same weight as a yes would be.
              <>
                <div className="text-sm text-muted-foreground">Our read</div>
                <div className="text-xl font-semibold text-foreground">
                  Moving probably wouldn’t pay for you.
                </div>
              </>
            )}

            {result.summary && <p className="mt-3 text-sm text-foreground">{result.summary}</p>}

            {!!result.assumptions.length && (
              <div className="mt-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  What this assumes
                </div>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {result.assumptions.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Next to the number, never below the fold. */}
            <p className="mt-4 text-xs text-muted-foreground">
              An estimate from one bill, not a quote. The only way to know is to check it against
              your actual usage.
            </p>
          </div>
        )}
      </div>
    </SectionShell>
  );
}
