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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Deliberately NOT toLocaleDateString: this component is server-rendered and then hydrated, and
 * the server's locale/timezone is not the client's — a date formatted twice differently is a
 * hydration mismatch, which React resolves by silently swapping the text after paint.
 */
function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export default function CollabClient({
  token,
  collab,
  templates,
  initialMessages,
  previews = {},
}: {
  token: string;
  collab: { id: string; title: string; clientName: string | null; status: string; decidedTemplateId: string | null };
  templates: Tpl[];
  initialMessages: Msg[];
  previews?: Record<string, { url: string; capturedAt: string | null }>;
}) {
  const [messages, setMessages] = React.useState<Msg[]>(initialMessages);
  const [draft, setDraft] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [decided, setDecided] = React.useState<string | null>(collab.decidedTemplateId);
  const [replyTo, setReplyTo] = React.useState<Msg | null>(null);
  const composerRef = React.useRef<HTMLTextAreaElement | null>(null);

  /**
   * ⚠️ "Answer this" USED TO DO NOTHING VISIBLE. It set reply state and left her where she was —
   * and on mobile the reply box sat at y=1690 of an 1886px page, i.e. below everything. A button
   * that silently changes off-screen state reads as broken, so it now scrolls AND focuses.
   */
  const jumpToComposer = React.useCallback((q?: Msg) => {
    if (q) setReplyTo(q);
    composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // focus after the scroll starts, or the browser yanks the viewport back
    setTimeout(() => composerRef.current?.focus(), 350);
  }, []);

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

  /**
   * ⚠️ REVERSIBLE, BECAUSE THE FIRST CLICK ON THIS BUTTON IN THE WILD WAS AN ACCIDENT. The owner
   * mis-clicked it on the client's behalf minutes after the page went live, and there was no way
   * back — the pick was recorded, a sentence appeared in her voice, and nothing on the page
   * offered to undo it.
   *
   * The fix is not a confirm dialog. This is a PREFERENCE in a conversation, not a contract; the
   * right shape is "change your mind freely", which also makes the button safe to press when you
   * are only half sure — which is the state most people are in when they first look.
   */
  const decide = async (templateId: string | null) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/collab/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, templateId }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setDecided(json?.decidedTemplateId ?? null);
        const idx = templateId ? templates.findIndex((t) => t.id === templateId) : -1;
        const label = idx >= 0 ? `Option ${String.fromCharCode(65 + idx)}` : 'this one';
        setMessages((m) => [
          ...m,
          {
            id: `local-${Date.now()}`,
            author_role: 'client',
            author_name: collab.clientName,
            kind: 'message',
            answers_id: null,
            body: templateId ? `Leaning towards ${label}.` : 'Actually — still deciding.',
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

      {/* ⚠️ A POINTER, NOT A SECOND COPY. This box used to repeat each question in full, so every
          question appeared TWICE on the page — once here and once in the thread below. Two copies
          of a question read as two questions, and the one you answer is ambiguous. The full text
          now lives once, in the conversation, where the reply box is; this just says how many are
          waiting and takes her there. */}
      {!!openQuestions.length && (
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <span className="text-sm text-foreground">
            {openQuestions.length} question{openQuestions.length === 1 ? '' : 's'} waiting for you
            {openQuestions.length === 1 ? '' : ' — both are in the conversation'}
          </span>
          <button
            type="button"
            onClick={() => jumpToComposer()}
            className="rounded-lg border border-amber-500/40 px-3 py-1 text-xs font-medium text-foreground transition hover:bg-amber-500/10"
          >
            Go answer {openQuestions.length === 1 ? 'it' : 'them'}
          </button>
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        {/* ── The options ────────────────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold text-foreground">The options</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Picking one just tells me where you&rsquo;re leaning — you can change it or undo it any
            time, and nothing happens until we talk.
          </p>
          <div className="mt-4 space-y-4">
            {templates.map((t, i) => {
              const url = `https://${t.slug}.quicksites.ai/`;
              const isPicked = decided === t.id;
              const preview = previews[t.slug];
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
                        Leaning this way
                      </span>
                    )}
                  </div>

                  {/* ⚠️ A DATED STILL, NOT A LIVE EMBED. Three iframes is three full page loads on
                      a phone; a screenshot is calm and cannot misbehave. But a screenshot is also a
                      claim about a past moment, so it says when it was taken — an undated preview of
                      an edited site is indistinguishable from the site itself. Options with no
                      stored capture simply show no image rather than a broken one. */}
                  {preview && (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 block overflow-hidden rounded-xl border border-border"
                    >
                      <img
                        src={preview.url}
                        alt={`Preview of ${t.template_name || t.slug}`}
                        loading="lazy"
                        className="block max-h-64 w-full object-cover object-top"
                      />
                    </a>
                  )}
                  {preview?.capturedAt && (
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      Screenshot from {shortDate(preview.capturedAt)} — open it for the live version.
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground transition hover:border-sky-500/40"
                    >
                      Open it ↗
                    </a>
                    {isPicked ? (
                      // The undo that did not exist. Same button position, so the way back is
                      // exactly where the way in was.
                      <button
                        type="button"
                        onClick={() => decide(null)}
                        disabled={busy}
                        className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-emerald-500/20 disabled:opacity-40"
                      >
                        Undo
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => decide(t.id)}
                        disabled={busy}
                        className="rounded-lg bg-sky-500 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-sky-400 disabled:opacity-40"
                      >
                        {decided ? 'Pick this instead' : 'I like this one'}
                      </button>
                    )}
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
          <div // ⚠️ Scroll only where the two-column layout needs it. On mobile the cap clipped a message
          // mid-sentence, which reads as a broken page rather than a scrollable one.
          className="mt-4 space-y-3 lg:max-h-[26rem] lg:overflow-auto lg:pr-1">
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
                {m.kind === 'question' && !messages.some((r) => r.answers_id === m.id) && (
                  <button
                    type="button"
                    onClick={() => jumpToComposer(m)}
                    className="mt-2 text-xs font-medium text-sky-400 underline underline-offset-2"
                  >
                    Answer this
                  </button>
                )}
              </div>
            ))}
          </div>

          {replyTo && (
            <p className="mt-3 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Replying to:{' '}
              {replyTo.body
                ? `“${replyTo.body.slice(0, 60)}${replyTo.body.length > 60 ? '…' : ''}”`
                : `Option ${String.fromCharCode(65 + Math.max(0, templates.findIndex((t) => t.id === replyTo.template_id)))}`}{' '}
              <button type="button" onClick={() => setReplyTo(null)} className="underline">
                cancel
              </button>
            </p>
          )}

          <textarea
            ref={composerRef}
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
