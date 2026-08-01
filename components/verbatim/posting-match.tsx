'use client';

// components/verbatim/posting-match.tsx
//
// "Paste a job posting" — shows what it asks for that the résumé already evidences, and what it
// asks for that the résumé never mentions.
//
// ⚠️ IT RUNS ENTIRELY IN THE BROWSER, AND THAT DISSOLVES A PROBLEM RATHER THAN MANAGING IT.
// A job posting is someone else's copyrighted content, and fetching, storing and re-processing
// one has a different legal shape from a résumé a person pasted about themselves. That was a
// live question when this was scoped. Running the comparison client-side answers it by removing
// it: the posting is never transmitted, never stored, never logged. There is no retention policy
// to write because there is no retention. Same argument as the PDF reader on this page — don't
// hold what you don't need — and it costs nothing here because the matcher is pure TypeScript.
//
// ⚠️ AND IT WRITES NOTHING. No model call, no "here's why you'd be great at this". The mesh was
// unanimous that generated fit-copy plus rehearsal is worse than keyword-stuffing: stuffing games
// a machine and a human catches the gap later, whereas practising an unsupported line teaches
// someone to deliver it fluently, which is what stops it being caught. So every row here is a
// word the employer wrote, matched against a line the person wrote — and every overlap shows the
// résumé line it came from, because a claim about someone without a citation is just a claim.
import * as React from 'react';
import { matchPostingToResume, type PostingMatch } from '@/lib/rebuild/matchPosting';

export default function PostingMatchPanel({ resumeText }: { resumeText: string }) {
  const [posting, setPosting] = React.useState('');
  const [match, setMatch] = React.useState<PostingMatch | null>(null);

  const run = () => setMatch(matchPostingToResume(resumeText, posting));

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-6">
      <h3 className="text-lg font-semibold text-card-foreground">Going for something specific?</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Paste a job posting and we&rsquo;ll show what it asks for that your résumé already covers —
        and what it asks for that your résumé never mentions.
      </p>
      {/* Said plainly because it is both true and the reason to feel safe pasting it. */}
      <p className="mt-2 text-xs text-muted-foreground">
        This runs on your device. The posting isn&rsquo;t uploaded, stored, or logged — and nothing
        here is written for you.
      </p>

      <textarea
        value={posting}
        onChange={(e) => setPosting(e.target.value)}
        rows={6}
        placeholder="Paste the whole posting — requirements section and all."
        className="mt-4 w-full rounded-xl border border-border bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground/70"
      />
      <button
        type="button"
        onClick={run}
        disabled={posting.trim().length < 40}
        className="mt-3 rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-400 disabled:opacity-40"
      >
        Compare with my résumé
      </button>

      {match && (
        <div className="mt-5 space-y-5">
          {match.inconclusive ? (
            // ⚠️ NEVER LET EMPTY READ AS PERFECT. Zero gaps because we couldn't parse the posting
            // and zero gaps because they match everything look identical on screen and are
            // completely different claims. Only one of them is ours to make.
            <p className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-sm text-foreground">
              We couldn&rsquo;t pick out any requirements from that. It doesn&rsquo;t mean you
              match everything — it means we couldn&rsquo;t tell. Try pasting the requirements
              section on its own.
            </p>
          ) : (
            <>
              {!!match.overlaps.length && (
                <div>
                  <h4 className="text-sm font-semibold text-foreground">
                    Already on your résumé <span className="text-muted-foreground">({match.overlaps.length})</span>
                  </h4>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Talk about these. Each one shows the line it came from, so you can point at it.
                  </p>
                  <ul className="mt-3 space-y-2">
                    {match.overlaps.map((o) => (
                      <li key={o.term} className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-3 py-2">
                        <div className="text-sm font-medium text-foreground">{o.term}</div>
                        {/* The citation. This is what keeps the feature extractive rather than
                            a machine telling someone what they're good at. */}
                        <div className="mt-0.5 text-xs italic text-muted-foreground">“{o.evidence}”</div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {!!match.gaps.length && (
                <div>
                  <h4 className="text-sm font-semibold text-foreground">
                    Not on your résumé <span className="text-muted-foreground">({match.gaps.length})</span>
                  </h4>
                  <p className="mt-1 text-xs text-muted-foreground">
                    We only list something here when it appears nowhere in what you pasted. If
                    you do have it, your résumé is the thing to fix — not this list.
                  </p>
                  <ul className="mt-3 space-y-2">
                    {match.gaps.map((g) => (
                      <li key={g.term} className="rounded-lg border border-border bg-muted/40 px-3 py-2">
                        <div className="text-sm font-medium text-foreground">{g.term}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">asked for in: “{g.source}”</div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {!match.gaps.length && (
                <p className="text-sm text-muted-foreground">
                  Nothing in that posting is missing from your résumé.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
