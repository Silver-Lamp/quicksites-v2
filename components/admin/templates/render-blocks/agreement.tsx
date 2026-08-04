// components/admin/templates/render-blocks/agreement.tsx
'use client';

// Terms a visitor accepts on a public page — a waiver, a cancellation policy, a safety notice.
//
// ⚠️ "ACCEPTED", NEVER "SIGNED", AND THAT IS NOT A WORD CHOICE. The private signing product
// (docs/AGREEMENTS.md) emails ONE named person a private link, so signing evidences possession of
// that inbox. This block has nobody to address: whoever is at the keyboard can type any name.
// Calling that a signature would claim an identity check we did not perform — the same class of
// dishonesty as billing a house narrator as the owner's voice. Every label here says accepted,
// and the receipt the visitor sees says exactly what was recorded.
//
// ⚠️ THE TERMS ARE RENDERED AS PLAIN PARAGRAPHS, NOT MARKDOWN. The fingerprint stored with an
// acceptance is taken over this source text, so any renderer that reflows or reinterprets it
// opens a gap between what was hashed and what was read — and that gap is exactly where this
// could mislead without anyone noticing.
//
// ⚠️ EDITOR-SPEAK NEVER REACHES A VISITOR (CUSTOM_SITES §4 rule 6). An unconfigured block shows a
// hint in the editor and renders NOTHING on a published page.
import * as React from 'react';
import type { Block } from '@/types/blocks';
import SectionShell from '@/components/ui/section-shell';

type Props = {
  block?: Block;
  content?: Block['content'];
  compact?: boolean;
  colorMode?: 'light' | 'dark';
  previewOnly?: boolean;
  template?: any;
};

type AgreementContent = {
  title?: string;
  body?: string;
  button_label?: string;
  require_email?: boolean;
  confirmation?: string;
};

function pick(block?: Block, override?: Block['content']): AgreementContent {
  const c = (override as AgreementContent) ?? (block?.content as AgreementContent);
  const p = (block as any)?.props as AgreementContent | undefined;
  return {
    title: c?.title ?? p?.title,
    body: c?.body ?? p?.body,
    button_label: c?.button_label ?? p?.button_label,
    require_email: c?.require_email ?? p?.require_email,
    confirmation: c?.confirmation ?? p?.confirmation,
  };
}

export default function AgreementRender({
  block,
  content,
  colorMode = 'light',
  previewOnly = false,
  template,
}: Props) {
  const c = pick(block, content);
  const [typedName, setTypedName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [consent, setConsent] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  const body = (c.body ?? '').trim();
  const title = (c.title ?? '').trim();

  // Unconfigured: a hint where it can be fixed, silence where it cannot.
  if (!body || !title) {
    if (previewOnly) {
      return (
        <SectionShell>
          <p className="text-sm text-muted-foreground">
            Agreement block — add a title and the terms to show.
          </p>
        </SectionShell>
      );
    }
    return null;
  }

  const templateId = template?.id ?? null;
  const blockId = (block as any)?._id ?? (block as any)?.id ?? null;
  const canSubmit =
    !!typedName.trim() && consent && (!c.require_email || !!email.trim()) && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/agreements/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId,
          blockId,
          // ⚠️ The text is posted so the server hashes and stores EXACTLY what was on screen.
          // Re-reading it server-side from the template would hash what is stored now, which is
          // not necessarily what this visitor read if the owner edited it mid-session.
          title,
          body,
          typedName,
          email: email || null,
          consent,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json?.ok) setDone(true);
      else setError(json?.error ?? 'Something went wrong. Nothing was recorded.');
    } catch {
      setError('Something went wrong. Nothing was recorded — please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <SectionShell>
        <div className="mx-auto max-w-2xl rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-6">
          <h2 className="text-lg font-semibold">{c.confirmation || 'Thank you — recorded.'}</h2>
          {/* The honest receipt: what was kept, in the visitor's own interest. */}
          <p className="mt-2 text-sm opacity-80">
            We recorded the name you typed, the time, and a copy of the exact terms above.
          </p>
        </div>
      </SectionShell>
    );
  }

  return (
    <SectionShell>
      <div className="mx-auto max-w-2xl">
        <h2 className="text-xl font-semibold">{title}</h2>

        <div className="mt-4 max-h-96 overflow-y-auto rounded-xl border border-border bg-muted/20 p-5">
          {body.split(/\n{2,}/).map((para, i) => (
            <p key={i} className="mb-3 whitespace-pre-line text-[15px] leading-relaxed">
              {para}
            </p>
          ))}
        </div>

        <div className="mt-5 space-y-3">
          <input
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            placeholder="Type your full name"
            autoComplete="name"
            disabled={previewOnly}
            className="w-full rounded-xl border border-border bg-background p-3 text-base placeholder:opacity-60"
          />
          {c.require_email && (
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email"
              type="email"
              autoComplete="email"
              disabled={previewOnly}
              className="w-full rounded-xl border border-border bg-background p-3 text-base placeholder:opacity-60"
            />
          )}
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              disabled={previewOnly}
              className="mt-1 h-4 w-4 shrink-0"
            />
            <span>I have read the above and accept it, and agree to do so electronically.</span>
          </label>

          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit || previewOnly}
            className="rounded-xl bg-sky-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-sky-300 disabled:opacity-40"
          >
            {busy ? 'Recording…' : c.button_label || 'I accept'}
          </button>

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
      </div>
    </SectionShell>
  );
}
