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

/**
 * Reviews of an option.
 *
 * ⚠️ THE HEADING SAYS "AI REVIEW", NOT "REVIEWS", AND THAT IS NOT A DETAIL. Every reviewer here is
 * an AI — a sibling assistant reading the page, or a browsing persona working through a goal.
 * "Two reviewers preferred B" is a sentence a client reads as two people, and she is deciding
 * about her own business on the strength of it. The label is on the section, on every row, and in
 * the database column that made the row (`reviewer_is_ai`, NOT NULL, no default) — three places,
 * because a label that lives only in a renderer is one refactor from gone.
 *
 * The pitch is "AI personas browse it as a real person WOULD", never "as real people". The first
 * is a claim about behaviour; the second asserts humans did it, and they did not.
 */
function ReviewList({ items }: { items: Feedback[] }) {
  const anyHuman = items.some((f) => !f.reviewer_is_ai);
  return (
    <div className="mt-4 border-t border-border pt-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {anyHuman ? `Reviews (${items.length})` : `AI review (${items.length})`}
      </div>
      {!anyHuman && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Written by AI reviewers reading the page as a first-time visitor would — not people.
        </p>
      )}
      <ul className="mt-2 space-y-2">
        {items.map((f) => (
          <li key={f.id} className="rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{f.source_label}</span>
              {f.reviewer_is_ai && (
                <span className="rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                  AI
                </span>
              )}
              {f.picked_option && <span>· would pick {f.picked_option}</span>}
            </div>
            <p className="mt-1.5 whitespace-pre-line text-sm text-foreground">{f.body}</p>
            {/* Verbatim, never stripped — the same rule the persona receiver applies to the task
                body. A note that gets summarised away is a note that stopped doing its job. */}
            {f.honesty_note && (
              <p className="mt-1.5 text-[11px] italic text-muted-foreground">{f.honesty_note}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export type OptionVersion = { version: number; templateId: string; note: string | null };
export type CollabOption = { key: string; versions: OptionVersion[]; latest: OptionVersion };
export type Feedback = {
  id: string;
  template_id: string | null;
  source: 'mesh' | 'persona' | 'operator';
  source_label: string;
  reviewer_is_ai: boolean;
  honesty_note: string | null;
  body: string;
  picked_option: string | null;
};

export default function CollabClient({
  token,
  collab,
  initialMessages,
  previews = {},
  options,
  templatesById,
  feedback = [],
}: {
  token: string;
  collab: { id: string; title: string; clientName: string | null; status: string; decidedTemplateId: string | null };
  initialMessages: Msg[];
  previews?: Record<string, { url: string; capturedAt: string | null }>;
  options: CollabOption[];
  templatesById: Record<string, Tpl>;
  feedback?: Feedback[];
}) {
  // Which version of each option is on screen. Defaults to the newest — the revision is the
  // current answer — but v1 stays one tap away, because "I preferred the old headline" has to be
  // a sayable thing.
  const [shownVersion, setShownVersion] = React.useState<Record<string, number>>(() =>
    Object.fromEntries(options.map((o) => [o.key, o.latest.version])),
  );

  /**
   * Which option a template belongs to.
   *
   * ⚠️ THIS USED TO BE AN ARRAY INDEX, AND THAT BREAKS THE MOMENT AN OPTION HAS A v2. The letter
   * has to come from the lineage: B's revision is still B, because she has been calling it B in
   * conversation. A position-derived label would quietly rename it to D.
   */
  const optionKeyOf = React.useCallback(
    (templateId: string | null | undefined): string | null =>
      options.find((o) => o.versions.some((v) => v.templateId === templateId))?.key ?? null,
    [options],
  );
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
        const key = optionKeyOf(templateId);
        const label = key ? `Option ${key}` : 'this one';
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
            {options.map((opt) => {
              const shown =
                opt.versions.find((v) => v.version === shownVersion[opt.key]) ?? opt.latest;
              const t = templatesById[shown.templateId];
              if (!t) return null;
              const url = `https://${t.slug}.quicksites.ai/`;
              const isPicked = decided === t.id;
              const preview = previews[t.slug];
              const optionFeedback = feedback.filter(
                (f) =>
                  // Feedback follows the OPTION, not one version of it: a note about v1's headline
                  // is still the reason v2 exists, and hiding it when the switcher moves would
                  // leave the revision looking unmotivated.
                  opt.versions.some((v) => v.templateId === f.template_id) ||
                  (f.template_id === null && f.picked_option === opt.key),
              );
              return (
                <article
                  key={opt.key}
                  className={`rounded-2xl border p-4 transition ${
                    isPicked ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-border bg-card'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        Option {opt.key}
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

                  {/* ⚠️ ONLY WHEN THERE IS SOMETHING TO SWITCH BETWEEN. A "v1" chip on an option
                      with one version invites the question "where are the others?" and answers it
                      with nothing. */}
                  {opt.versions.length > 1 && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {opt.versions.map((v) => (
                        <button
                          key={v.version}
                          type="button"
                          onClick={() => setShownVersion((s) => ({ ...s, [opt.key]: v.version }))}
                          className={`rounded-md border px-2 py-0.5 text-xs transition ${
                            v.version === shown.version
                              ? 'border-sky-500/50 bg-sky-500/10 text-foreground'
                              : 'border-border text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          v{v.version}
                          {v.version === opt.latest.version && opt.versions.length > 1 && ' · newest'}
                        </button>
                      ))}
                      {shown.note && (
                        <span className="text-xs text-muted-foreground">{shown.note}</span>
                      )}
                    </div>
                  )}

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

                  {!!optionFeedback.length && <ReviewList items={optionFeedback} />}
                </article>
              );
            })}
          </div>

          {/* Reviews about the SET rather than one option — "I'd pick B" belongs here, next to
              all three, not buried inside the card it happens to name. */}
          {(() => {
            const general = feedback.filter((f) => !f.template_id && !f.picked_option);
            return general.length ? (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-foreground">On all three</h3>
                <ReviewList items={general} />
              </div>
            ) : null;
          })()}
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
                : `Option ${optionKeyOf(replyTo.template_id) ?? '—'}`}{' '}
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
