'use client';

// The operator's half of a client thread.
//
// ⚠️ IT SHOWS THE SAME CONVERSATION THE CLIENT SEES, IN THE SAME ORDER. A "internal notes"
// channel invisible to the client was the obvious feature to add here and is deliberately
// absent: the moment a thread has a hidden half, it stops being a record either side can point
// at, which is the only reason to keep one. Anything not sayable to the client belongs somewhere
// that is not this thread.
//
// What an operator gets that a client does not: the shareable link, and the ability to ASK a
// question (kind='question') rather than only reply — because an unanswered question is the
// thing the client's page pins to the top.
import * as React from 'react';

type Msg = {
  id: string;
  author_role: 'operator' | 'client';
  author_name: string | null;
  kind: 'message' | 'question' | 'answer';
  answers_id: string | null;
  body: string;
  template_id: string | null;
  created_at: string;
};

type Tpl = { id: string; slug: string; template_name: string | null };

type Feedback = {
  id: string;
  template_id: string | null;
  source: 'mesh' | 'persona' | 'operator';
  source_label: string;
  reviewer_is_ai: boolean;
  honesty_note: string | null;
  body: string;
  picked_option: string | null;
  status: 'new' | 'applied' | 'dismissed';
  visible_to_client: boolean;
  created_at: string;
};

export default function OperatorThread({
  collab,
  templates,
  initialMessages,
  clientLink,
  operatorName,
  initialFeedback = [],
}: {
  collab: { id: string; title: string; clientName: string | null; status: string; decidedTemplateId: string | null };
  templates: Tpl[];
  initialMessages: Msg[];
  clientLink: string | null;
  operatorName: string;
  initialFeedback?: Feedback[];
}) {
  const [messages, setMessages] = React.useState<Msg[]>(initialMessages);
  const [draft, setDraft] = React.useState('');
  const [asQuestion, setAsQuestion] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [feedback, setFeedback] = React.useState<Feedback[]>(initialFeedback);
  const [reviewDraft, setReviewDraft] = React.useState('');
  const [reviewLabel, setReviewLabel] = React.useState('');
  const [reviewPick, setReviewPick] = React.useState('');
  const [reviewTemplate, setReviewTemplate] = React.useState('');

  const send = async () => {
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/collab/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collabId: collab.id,
          body,
          kind: asQuestion ? 'question' : 'message',
          authorName: operatorName,
        }),
      });
      const json = await res.json();
      if (json?.message) {
        setMessages((m) => [...m, json.message]);
        setDraft('');
        setAsQuestion(false);
      }
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    if (!clientLink) return;
    const full = `${window.location.origin}${clientLink}`;
    try {
      await navigator.clipboard.writeText(full);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the link is visible below anyway */
    }
  };

  const answered = new Set(messages.filter((m) => m.answers_id).map((m) => m.answers_id));
  const openQuestions = messages.filter((m) => m.kind === 'question' && !answered.has(m.id));

  const patchFeedback = async (id: string, patch: Partial<Feedback>) => {
    const res = await fetch('/api/admin/collab/feedback', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        collabId: collab.id,
        id,
        visibleToClient: patch.visible_to_client,
        status: patch.status,
      }),
    });
    if (res.ok) setFeedback((f) => f.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  };

  const addMeshReview = async () => {
    const body = reviewDraft.trim();
    if (!body || !reviewLabel.trim() || busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/collab/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collabId: collab.id,
          source: 'mesh',
          sourceLabel: reviewLabel.trim(),
          // Mesh reviews are written by sibling Claude sessions. Hard-coded true rather than a
          // checkbox: a UI toggle for "was this a person?" is a toggle someone eventually gets
          // wrong, on the one field that must never be wrong.
          reviewerIsAi: true,
          body,
          templateId: reviewTemplate || null,
          pickedOption: reviewPick || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (json?.feedback) {
        setFeedback((f) => [json.feedback, ...f]);
        setReviewDraft('');
        setReviewPick('');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{collab.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {collab.clientName ?? 'Client'} · {collab.status}
            {collab.decidedTemplateId && ' · decided'}
          </p>
        </div>
        {clientLink ? (
          <button
            type="button"
            onClick={copyLink}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground transition hover:border-sky-500/40"
          >
            {copied ? 'Copied' : 'Copy client link'}
          </button>
        ) : (
          // Surfaced, not swallowed: without a signing secret the client link cannot exist, and
          // finding that out when the client says "your link is broken" is the expensive way.
          <span className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs text-foreground">
            No signing secret set — client link unavailable
          </span>
        )}
      </header>

      {!!openQuestions.length && (
        <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-foreground">
          {openQuestions.length} question{openQuestions.length === 1 ? '' : 's'} still unanswered —
          these are pinned to the top of their page.
        </p>
      )}

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-foreground">Options on the table</h2>
        <ul className="mt-2 flex flex-wrap gap-2">
          {templates.map((t, i) => (
            <li key={t.id}>
              <a
                href={`https://${t.slug}.quicksites.ai/`}
                target="_blank"
                rel="noopener noreferrer"
                className={`rounded-lg border px-3 py-1.5 text-sm transition hover:border-sky-500/40 ${
                  collab.decidedTemplateId === t.id
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-foreground'
                    : 'border-border text-muted-foreground'
                }`}
              >
                {String.fromCharCode(65 + i)} · {t.template_name || t.slug}
                {collab.decidedTemplateId === t.id && ' ✓'}
              </a>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Reviews ────────────────────────────────────────────────────
          ⚠️ NOTHING HERE IS ON HER PAGE UNTIL IT IS PROMOTED. Persona findings arrive as CLAIMS —
          that is why they file at 'triage' rather than 'open' — and auto-publishing an unconfirmed
          claim onto a customer's own page is the cry-wolf failure with the customer as the victim.
          The default is invisible; showing one is a deliberate act by someone who has read it. */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold text-foreground">
          Reviews{' '}
          <span className="font-normal text-muted-foreground">
            ({feedback.filter((f) => f.visible_to_client).length} of {feedback.length} shown to{' '}
            {collab.clientName ?? 'the client'})
          </span>
        </h2>

        <div className="mt-3 space-y-2">
          {feedback.length === 0 && (
            <p className="text-sm text-muted-foreground">
              None yet. Persona findings about these sites land here automatically; paste mesh
              reviews below.
            </p>
          )}
          {feedback.map((f) => (
            <div
              key={f.id}
              className={`rounded-xl border p-3 ${
                f.visible_to_client ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border bg-card'
              }`}
            >
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{f.source_label}</span>
                <span className="rounded border border-border px-1.5 py-0.5 text-[10px] uppercase">
                  {f.source}
                </span>
                {f.reviewer_is_ai && (
                  <span className="rounded border border-border px-1.5 py-0.5 text-[10px] uppercase">
                    AI
                  </span>
                )}
                {f.picked_option && <span>· would pick {f.picked_option}</span>}
                {f.status !== 'new' && <span>· {f.status}</span>}
              </div>
              <p className="mt-1.5 whitespace-pre-line text-sm text-foreground">{f.body}</p>
              {f.honesty_note && (
                <p className="mt-1 text-[11px] italic text-muted-foreground">{f.honesty_note}</p>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => patchFeedback(f.id, { visible_to_client: !f.visible_to_client })}
                  className="rounded-lg border border-border px-2.5 py-1 text-xs text-foreground transition hover:border-sky-500/40"
                >
                  {f.visible_to_client ? 'Hide from client' : 'Show to client'}
                </button>
                <button
                  type="button"
                  onClick={() => patchFeedback(f.id, { status: f.status === 'applied' ? 'new' : 'applied' })}
                  className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground transition hover:text-foreground"
                >
                  {f.status === 'applied' ? 'Un-apply' : 'Mark applied'}
                </button>
                <button
                  type="button"
                  onClick={() => patchFeedback(f.id, { status: f.status === 'dismissed' ? 'new' : 'dismissed' })}
                  className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground transition hover:text-foreground"
                >
                  {f.status === 'dismissed' ? 'Undismiss' : 'Dismiss'}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-xl border border-border p-3">
          <div className="flex flex-wrap gap-2">
            <input
              value={reviewLabel}
              onChange={(e) => setReviewLabel(e.target.value)}
              placeholder="Who — e.g. PorchHearth"
              className="min-w-[12rem] flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/70"
            />
            <select
              value={reviewTemplate}
              onChange={(e) => setReviewTemplate(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            >
              <option value="">About all three</option>
              {templates.map((t, i) => (
                <option key={t.id} value={t.id}>
                  {String.fromCharCode(65 + i)} · {t.template_name || t.slug}
                </option>
              ))}
            </select>
            <select
              value={reviewPick}
              onChange={(e) => setReviewPick(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            >
              <option value="">No pick stated</option>
              {templates.map((_, i) => (
                <option key={i} value={String.fromCharCode(65 + i)}>
                  Would pick {String.fromCharCode(65 + i)}
                </option>
              ))}
            </select>
          </div>
          <textarea
            value={reviewDraft}
            onChange={(e) => setReviewDraft(e.target.value)}
            rows={3}
            placeholder="Paste a mesh review…"
            className="mt-2 w-full rounded-xl border border-border bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground/70"
          />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={addMeshReview}
              disabled={busy || !reviewDraft.trim() || !reviewLabel.trim()}
              className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground transition hover:border-sky-500/40 disabled:opacity-40"
            >
              Add mesh review
            </button>
            <span className="text-xs text-muted-foreground">
              Filed as an AI reviewer, hidden from the client until you show it.
            </span>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-foreground">Conversation</h2>
        <div className="mt-3 space-y-3">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`rounded-xl border p-3 ${
                m.author_role === 'client' ? 'border-sky-500/30 bg-sky-500/5' : 'border-border bg-card'
              }`}
            >
              <div className="text-xs font-medium text-muted-foreground">
                {m.author_role === 'client' ? m.author_name || 'Client' : m.author_name || 'You'}
                {m.kind === 'question' && ' · asked'}
                {m.kind === 'answer' && ' · answered'}
                {m.kind === 'question' && !answered.has(m.id) && ' · awaiting reply'}
              </div>
              <p className="mt-1 whitespace-pre-line text-sm text-foreground">{m.body}</p>
            </div>
          ))}
        </div>

        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={4}
          placeholder="Reply, or ask something."
          className="mt-4 w-full rounded-xl border border-border bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground/70"
        />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={send}
            disabled={busy || !draft.trim()}
            className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-400 disabled:opacity-40"
          >
            {busy ? 'Sending…' : asQuestion ? 'Ask' : 'Send'}
          </button>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={asQuestion} onChange={(e) => setAsQuestion(e.target.checked)} />
            Ask as a question (pins it to the top of their page)
          </label>
        </div>
      </section>
    </div>
  );
}
