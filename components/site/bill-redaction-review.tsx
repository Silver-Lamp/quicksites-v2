'use client';

// components/site/bill-redaction-review.tsx
//
// "Upload your cloud bill" — with the identifying parts struck out IN THE BROWSER, shown to the
// person, and editable, before a single byte is sent.
//
// ⚠️ THE ORDER OF OPERATIONS IS THE FEATURE.
//
// The natural offer is "upload it and we'll remove the sensitive bits." That is strictly worse
// for the uploader, because to remove them we must first receive them — it converts a fact into
// a policy, and a policy is a thing you're asked to trust. Reading and redacting client-side
// means the identified version never leaves their machine: no retention window, no breach
// surface, nothing to take on faith.
//
// It matters more here than on the résumé path, not less, because this text goes on to TWO
// further parties: an LLM that produces the estimate, and a human — the site owner reads the
// enquiry. The person uploading should know both before they press send, so the UI says both.
//
// ⚠️ NEVER TELL THEM IT IS ANONYMISED. A regex sweep over an arbitrary invoice cannot promise it
// caught everything — vendor account formats vary, a company name is any string, and a project
// codename can identify its owner to anyone in the industry. So the copy says "we found and
// struck these; read it before you send", never "your bill is now anonymous". Someone who
// believes the stronger claim stops checking, which is exactly when it costs them.
import * as React from 'react';
import { extractPdfText } from '@/lib/rebuild/pdfText';
import { findIdentifiers, redact, summarise, type Finding } from '@/lib/billing/redactBill';

export default function BillRedactionReview({
  onReady,
}: {
  /** Called with the text the person approved — never with the original. */
  onReady?: (redactedText: string) => void;
}) {
  const [raw, setRaw] = React.useState('');
  const [keep, setKeep] = React.useState<Set<number>>(new Set());
  const [reading, setReading] = React.useState(false);
  const [note, setNote] = React.useState<string | null>(null);

  // Re-derived on every keystroke: the highlights must move as they edit, not after a round-trip.
  const findings: Finding[] = React.useMemo(() => findIdentifiers(raw), [raw]);
  const output = React.useMemo(() => redact(raw, findings, keep), [raw, findings, keep]);
  const struck = findings.filter((f) => !keep.has(f.start));

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setNote(null);
    setReading(true);
    try {
      const { text, pages, quality } = await extractPdfText(file);
      if (quality === 'empty') {
        setNote(
          'We couldn’t find any text in that PDF — it’s probably a scan. Paste the figures instead, or take a photo and type the totals.',
        );
        return;
      }
      setRaw(text);
      setKeep(new Set());
      setNote(`Read ${pages} page${pages === 1 ? '' : 's'} on your device. Nothing has been sent.`);
    } catch {
      setNote('Couldn’t read that PDF. Pasting the figures works just as well.');
    } finally {
      setReading(false);
    }
  };

  const toggle = (start: number) =>
    setKeep((prev) => {
      const next = new Set(prev);
      next.has(start) ? next.delete(start) : next.add(start);
      return next;
    });

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <h3 className="text-lg font-semibold text-card-foreground">Send a bill, not your account details</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Upload a PDF and we’ll read it <strong>on your device</strong>, strike out the identifying
        parts, and show you exactly what would be sent. Nothing leaves this page until you press
        send.
      </p>
      {/* Said plainly and up front, because both are true and both are the uploader's business. */}
      <p className="mt-2 text-xs text-muted-foreground">
        What you send is read by an AI model to produce the estimate, and by the person who runs
        this site. A black marker over the account number before you upload works too — this just
        saves you the step.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="cursor-pointer rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-sky-500/40 hover:text-foreground">
          {reading ? 'Reading…' : 'Choose a PDF'}
          <input type="file" accept="application/pdf,.pdf" className="sr-only" onChange={onPick} disabled={reading} />
        </label>
        <span className="text-xs text-muted-foreground">or paste the text below</span>
      </div>
      {note && (
        <p className="mt-3 rounded-lg border border-sky-500/25 bg-sky-500/5 px-3 py-2 text-xs text-foreground">{note}</p>
      )}

      <textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        rows={8}
        placeholder="Paste the bill — line items and totals are what matter."
        className="mt-4 w-full rounded-xl border border-border bg-background p-3 font-mono text-xs text-foreground placeholder:text-muted-foreground/70"
      />

      {!!findings.length && (
        <div className="mt-4">
          <h4 className="text-sm font-semibold text-foreground">
            Found {findings.length} thing{findings.length === 1 ? '' : 's'} that could identify you
          </h4>
          <p className="mt-1 text-xs text-muted-foreground">
            Struck out by default. Untick anything you’re happy to send — it’s your document, and
            we can’t know which details matter to you.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {findings.map((f) => {
              const isStruck = !keep.has(f.start);
              return (
                <li key={`${f.start}-${f.kind}`}>
                  <button
                    type="button"
                    onClick={() => toggle(f.start)}
                    className={`rounded-lg border px-2.5 py-1 text-xs transition ${
                      isStruck
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-foreground line-through decoration-emerald-400/70'
                        : 'border-amber-500/40 bg-amber-500/10 text-foreground'
                    }`}
                    title={isStruck ? 'Struck out — click to keep it' : 'Will be sent — click to strike it'}
                  >
                    {f.text.length > 28 ? `${f.text.slice(0, 28)}…` : f.text}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            {summarise(struck).map((s) => `${s.count} ${s.label}${s.count === 1 ? '' : 's'}`).join(' · ') ||
              'Nothing struck — everything above will be sent as written.'}
          </p>
        </div>
      )}

      {!!raw.trim() && (
        <div className="mt-5">
          <h4 className="text-sm font-semibold text-foreground">This is exactly what gets sent</h4>
          <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-muted/40 p-3 font-mono text-xs text-foreground">
            {output}
          </pre>
          <button
            type="button"
            onClick={() => onReady?.(output)}
            className="mt-3 rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-400"
          >
            Send this for an estimate
          </button>
          {/* The honest ceiling on the claim — stated next to the button, not in a footer. */}
          <p className="mt-2 text-xs text-muted-foreground">
            We strike what we can recognise. We can’t promise we caught everything — give it a read.
          </p>
        </div>
      )}
    </section>
  );
}
