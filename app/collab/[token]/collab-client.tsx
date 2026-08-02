'use client';

// The interactive half of the client collaboration page.
//
// ⚠️ EVERY MESSAGE IS LABELLED WITH WHO SAID IT, ALWAYS. A thread where "us" and "them" blur is
// not evidence of what was agreed, which is the only reason to keep one. The role comes from the
// server (derived from how the poster authenticated), never from anything typed here.
//
// ⚠️ AND A PREVIEW IS LABELLED AS A DRAFT. These are working options, not a launched site. A
// client who mistakes a preview for something already live will make a different decision than
// one who knows it is still theirs to change.
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

type Tpl = { id: string; slug: string; template_name: string | null; business_name: string | null };

export default function CollabClient({
  token,
  collab,
  templates,
  initialMessages,
}: {
  token: string;
  collab: { id: string; title: string; clientName: string | null; status: string; decidedTemplateId: string | null };
  templates: Tpl[];
  initialMessages: Msg[];
}) {
  const [messages, setMessages] = React.useState<Msg[]>(initialMessages);
  const [draft, setDraft] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [decided, setDecided] = React.useState<string | null>(collab.decidedTemplateId);
  const [replyTo, setReplyTo] = React.useState<Msg | null>(null);

  const send = async () => {
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/collab/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, body, answersId: replyTo?.id ?? null }),
      });
      const json = await res.json();
      if (json?.message) {
        setMessages((m) => [...m, json.message]);
        setDraft('');
        setReplyTo(null);
      }
    } finally {
      setBusy(false);
    }
  };

  const decide = async (templateId: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/collab/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, templateId }),
      });
      if (res.ok) {
        setDecided(templateId);
        setMessages((m) => [
          ...m,
          {
            id: `local-${Date.now()}`,
            author_role: 'client',
            author_name: collab.clientName,
            kind: 'message',
            answers_id: null,
            body: 'Picked this one.',
            template_id: templateId,
            created_at: new Date().toISOString(),
          },
        ]);
      }
    } finally {
      setBusy(false);
    }
  };

  const openQuestions = messages.filter(
    (m) => m.kind === 'question' && !messages.some((r) => r.answers_id === m.id),
  );

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{collab.title}</h1>
        <p className="mt-2 text-muted-foreground">
          {collab.clientName ? `${collab.clientName} — t` : 'T'}hree options, all working drafts.
          Nothing here is live yet, and everything is still yours to change.
        </p>
      </header>

      {/* ── Open questions first: the thing most likely to be waiting on them ── */}
      {!!openQuestions.length && (
        <section className="mt-8 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
          <h2 className="text-sm font-semibold text-foreground">
            {openQuestions.length} question{openQuestions.length === 1 ? '' : 's'} for you
          </h2>
          <ul className="mt-3 space-y-3">
            {openQuestions.map((q) => (
              <li key={q.id} className="text-sm text-foreground">
                <p>{q.body}</p>
                <button
                  type="button"
                  onClick={() => setReplyTo(q)}
                  className="mt-1 text-xs font-medium text-sky-400 underline underline-offset-2"
                >
                  Answer this
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        {/* ── The options ────────────────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold text-foreground">The options</h2>
          <div className="mt-4 space-y-4">
            {templates.map((t, i) => {
              const url = `https://${t.slug}.quicksites.ai/`;
              const isPicked = decided === t.id;
              return (
                <article
                  key={t.id}
                  className={`rounded-2xl border p-4 transition ${
                    isPicked ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-border bg-card'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        Option {String.fromCharCode(65 + i)}
                      </div>
                      <h3 className="text-base font-semibold text-card-foreground">
                        {t.template_name || t.business_name || t.slug}
                      </h3>
                    </div>
                    {isPicked && (
                      <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs text-foreground">
                        Your pick
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground transition hover:border-sky-500/40"
                    >
                      Open it ↗
                    </a>
                    <button
                      type="button"
                      onClick={() => decide(t.id)}
                      disabled={busy || isPicked}
                      className="rounded-lg bg-sky-500 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-sky-400 disabled:opacity-40"
                    >
                      {isPicked ? 'Chosen' : 'I want this one'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setReplyTo({ ...(({} as any)), id: '', body: '', template_id: t.id } as any)}
                      className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition hover:text-foreground"
                    >
                      Comment on this
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* ── The conversation ───────────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold text-foreground">Conversation</h2>
          <div className="mt-4 max-h-[26rem] space-y-3 overflow-auto pr-1">
            {messages.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nothing yet. Ask anything — including “why these three?”
              </p>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={`rounded-xl border p-3 ${
                  m.author_role === 'client'
                    ? 'border-sky-500/30 bg-sky-500/5'
                    : 'border-border bg-card'
                }`}
              >
                {/* Who said it, every time, without exception. */}
                <div className="text-xs font-medium text-muted-foreground">
                  {m.author_role === 'client' ? m.author_name || 'You' : m.author_name || 'QuickSites'}
                  {m.kind === 'question' && ' · asked'}
                  {m.kind === 'answer' && ' · answered'}
                </div>
                <p className="mt-1 whitespace-pre-line text-sm text-foreground">{m.body}</p>
              </div>
            ))}
          </div>

          {replyTo && (
            <p className="mt-3 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Replying to: {replyTo.body ? `“${replyTo.body.slice(0, 60)}”` : 'a specific option'}{' '}
              <button type="button" onClick={() => setReplyTo(null)} className="underline">
                cancel
              </button>
            </p>
          )}

          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            placeholder="Ask a question, or say what you'd change."
            className="mt-3 w-full rounded-xl border border-border bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground/70"
          />
          <button
            type="button"
            onClick={send}
            disabled={busy || !draft.trim()}
            className="mt-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-400 disabled:opacity-40"
          >
            {busy ? 'Sending…' : 'Send'}
          </button>
        </section>
      </div>
    </main>
  );
}
