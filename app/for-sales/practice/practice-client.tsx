'use client';

// The practice room: say a line, the prospect answers, and anything you cannot back up gets
// flagged in your own words.
//
// ⚠️ TWO HONESTY RULES ARE RENDERED HERE, NOT DECORATED.
//
// 1. A flag whose quote is the WHOLE line is labelled as such rather than highlighted. HJ's guard
//    verifies a quote is real (`includes`) but cannot verify it isolates anything, and the first
//    real turn returned the entire rep line character for character. Highlighting all of it would
//    present "you said something wrong somewhere in that sentence" as coaching.
// 2. `flags_dropped` is shown beside the flag count, because zero dropped means nothing on its
//    own — zero out of zero raised is "nothing happened", zero out of five is the guard working.
import * as React from 'react';

type Flag = { rule_id: string; quote: string; why?: string };
type Turn = {
  prospect_line?: string;
  objection_id?: string | null;
  call_state?: string;
  coaching?: string;
  honesty_flags?: Flag[];
  flags_dropped?: number;
  would_keep_listening?: string;
  isolating?: boolean[];
  latency_ms?: number;
  error?: string;
};
type Line = { who: 'rep' | 'prospect'; text: string };

export default function PracticeClient({
  archetypes,
  objections,
}: {
  archetypes: { id: string; label: string; openingState: string }[];
  objections: { id: string; says: string; goodMove: string }[];
}) {
  const [archetype, setArchetype] = React.useState(archetypes[0]?.id);
  const [transcript, setTranscript] = React.useState<Line[]>([]);
  const [draft, setDraft] = React.useState('');
  const [turn, setTurn] = React.useState<Turn | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [speech, setSpeech] = React.useState(false);
  const [listening, setListening] = React.useState(false);

  React.useEffect(() => {
    setSpeech(typeof window !== 'undefined' && 'speechSynthesis' in window);
  }, []);

  const say = React.useCallback((text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis || !text) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  }, []);

  // Dictation, on the browser's free API — the same path HJ's interview lane uses. A sales call
  // is spoken, and typing your pitch practises the wrong muscle.
  const dictate = React.useCallback(() => {
    const SR: any =
      typeof window !== 'undefined' &&
      ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    if (!SR) return;
    const rec = new SR();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.onresult = (e: any) => setDraft((d) => (d ? d + ' ' : '') + e.results[0][0].transcript);
    rec.onend = () => setListening(false);
    setListening(true);
    rec.start();
  }, []);

  async function send() {
    const rep_said = draft.trim();
    if (!rep_said || busy) return;
    setBusy(true);
    const priorTurns = [...transcript, { who: 'rep' as const, text: rep_said }];
    setTranscript(priorTurns);
    setDraft('');
    try {
      const res = await fetch('/api/rehearsal/turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rep_said, archetype_id: archetype, transcript }),
      });
      const data: Turn = await res.json();
      setTurn(data);
      if (data.prospect_line) {
        setTranscript([...priorTurns, { who: 'prospect', text: data.prospect_line }]);
        say(data.prospect_line);
      }
    } catch {
      setTurn({ error: 'the turn could not be sent' });
    } finally {
      setBusy(false);
    }
  }

  const flags = turn?.honesty_flags || [];
  const matched = objections.find((o) => o.id === turn?.objection_id);

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 text-white">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Practice</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Say your line. They answer, and anything you can&apos;t back up gets quoted back to
            you.
          </p>
        </div>
        <a href="/for-sales/call" className="text-xs text-amber-400 underline underline-offset-4">
          call sheet ↗
        </a>
      </header>

      <div className="mt-5 flex flex-wrap gap-2">
        {archetypes.map((a) => (
          <button
            key={a.id}
            onClick={() => {
              setArchetype(a.id);
              setTranscript([]);
              setTurn(null);
            }}
            className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
              a.id === archetype
                ? 'border-amber-500/60 bg-amber-500/15 text-amber-200'
                : 'border-zinc-700 bg-zinc-900/60 text-zinc-400 hover:border-zinc-500'
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs italic text-zinc-500">
        {archetypes.find((a) => a.id === archetype)?.openingState}
      </p>

      <div className="mt-5 space-y-2">
        {transcript.map((l, i) => (
          <div
            key={i}
            className={`rounded-lg border p-3 text-sm leading-relaxed ${
              l.who === 'rep'
                ? 'border-amber-500/25 bg-amber-500/[0.05] text-zinc-200'
                : 'border-zinc-800 bg-zinc-950/60 text-zinc-300'
            }`}
          >
            <span className="mr-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              {l.who === 'rep' ? 'You' : 'Them'}
            </span>
            {l.text}
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          placeholder="What do you say?"
          className="w-full resize-none bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            onClick={send}
            disabled={busy || !draft.trim()}
            className="rounded-md border border-emerald-500/50 bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-300 disabled:opacity-40"
          >
            {busy ? 'thinking…' : 'Say it'}
          </button>
          <button
            onClick={dictate}
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-400 hover:border-zinc-500"
          >
            {listening ? '● listening' : '🎤 speak'}
          </button>
          {speech && turn?.prospect_line && (
            <button
              onClick={() => say(turn.prospect_line!)}
              className="text-xs text-zinc-500 underline underline-offset-4 hover:text-zinc-300"
            >
              replay their line
            </button>
          )}
        </div>
      </div>

      {turn?.error && (
        <p className="mt-4 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">
          {turn.error}
        </p>
      )}

      {turn && !turn.error && (
        <section className="mt-5 space-y-3">
          {flags.length > 0 ? (
            flags.map((f, i) => {
              const isolates = turn.isolating?.[i];
              return (
                <div
                  key={i}
                  className="rounded-lg border border-rose-500/40 bg-rose-500/[0.07] p-4"
                >
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-rose-300">
                    {f.rule_id.replace(/_/g, ' ')}
                  </div>
                  {isolates ? (
                    <p className="mt-2 text-sm leading-relaxed text-zinc-200">
                      You said: <mark className="bg-rose-500/30 text-white">{f.quote}</mark>
                    </p>
                  ) : (
                    <>
                      <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                        Flagged, but the engine quoted your whole line back rather than the words
                        that broke the rule.
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                        Treat it as &ldquo;something in that sentence&rdquo; — it is not telling
                        you where.
                      </p>
                    </>
                  )}
                  {f.why && <p className="mt-2 text-sm text-zinc-400">{f.why}</p>}
                </div>
              );
            })
          ) : (
            <p className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-sm text-zinc-400">
              No honesty flags on that line.
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <Stat
              k="Flags"
              v={`${flags.length} raised · ${turn.flags_dropped ?? '—'} dropped`}
              s="dropped = quote wasn't verbatim"
            />
            <Stat
              k="They matched"
              v={matched ? matched.says : turn.objection_id || 'nothing in the tree'}
              s={matched ? matched.goodMove : 'no branch to open'}
            />
            <Stat
              k="Still listening?"
              v={turn.would_keep_listening || '—'}
              s={`${turn.call_state || 'unknown'} · ${turn.latency_ms ?? '—'}ms`}
            />
          </div>

          {turn.coaching && (
            <p className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 text-sm leading-relaxed text-zinc-300">
              {turn.coaching}
            </p>
          )}
        </section>
      )}
    </div>
  );
}

function Stat({ k, v, s }: { k: string; v: string; s?: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
      <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">{k}</div>
      <div className="mt-1 text-sm font-medium text-white">{v}</div>
      {s && <div className="mt-1 text-[11px] leading-snug text-zinc-500">{s}</div>}
    </div>
  );
}
