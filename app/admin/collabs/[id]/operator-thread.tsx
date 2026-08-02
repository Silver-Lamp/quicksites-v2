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

export default function OperatorThread({
  collab,
  templates,
  initialMessages,
  clientLink,
  operatorName,
}: {
  collab: { id: string; title: string; clientName: string | null; status: string; decidedTemplateId: string | null };
  templates: Tpl[];
  initialMessages: Msg[];
  clientLink: string | null;
  operatorName: string;
}) {
  const [messages, setMessages] = React.useState<Msg[]>(initialMessages);
  const [draft, setDraft] = React.useState('');
  const [asQuestion, setAsQuestion] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

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
