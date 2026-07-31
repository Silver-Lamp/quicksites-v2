'use client';

// The Verbatim intake form.
//
// ⚠️ THE GAPS ARE SHOWN, NOT SWALLOWED. The API returns what the résumé did NOT yield, and this
// surfaces it before the person walks into the editor. A tool that reports only what it found
// lets someone publish a page missing their own name and never notice — and the whole promise
// of this feature is that it tells you what it doesn't know rather than filling the silence.
// Deleting this list would make the product quietly worse in exactly the way it claims not to be.
import * as React from 'react';

type Result = {
  ok?: boolean;
  editorUrl?: string;
  gaps?: string[];
  read?: { name: string | null; skills: number; roles: number; links: number };
  error?: string;
};

const GAP_LABEL: Record<string, string> = {
  name: 'your name',
  headline: 'a title for yourself',
  summary: 'a summary',
  skills: 'skills',
  experience: 'work history',
  location: 'where you are',
  links: 'links to your work',
};

export default function VerbatimIntake() {
  const [resumeText, setResumeText] = React.useState('');
  const [sinceParagraph, setSince] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<Result | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || resumeText.trim().length < 40) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch('/api/rebuild/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeText, sinceParagraph }),
      });
      setResult(await res.json());
    } catch {
      setResult({ error: 'Something went wrong. Your text is still here — try again.' });
    } finally {
      setBusy(false);
    }
  };

  if (result?.ok && result.editorUrl) {
    return (
      <div className="rounded-2xl border border-border bg-card p-7">
        <h2 className="text-xl font-semibold text-card-foreground">Your page is ready to edit.</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Read {result.read?.skills ?? 0} skills and {result.read?.roles ?? 0} roles
          {result.read?.name ? ` for ${result.read.name}` : ''}.
        </p>

        {!!result.gaps?.length && (
          // Stated plainly and before they click through — this is the honest half of the
          // product, and burying it after the editor loads would defeat the point.
          <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
            <div className="text-sm font-medium text-foreground">
              Your résumé didn’t tell us everything — these are blank rather than guessed:
            </div>
            <p className="mt-1.5 text-sm text-amber-100/90">
              {result.gaps.map((g) => GAP_LABEL[g] ?? g).join(' · ')}
            </p>
            <p className="mt-2 text-xs text-amber-100/70">
              You can fill any of them in the editor. We’d rather leave a space than put words in
              your mouth.
            </p>
          </div>
        )}

        <a
          href={result.editorUrl}
          className="mt-6 inline-block rounded-xl bg-sky-500 px-6 py-3 font-semibold text-zinc-950 transition hover:bg-sky-400"
        >
          Open my page →
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-7">
      <label className="block text-sm font-medium text-card-foreground" htmlFor="resume">
        Paste your résumé
      </label>
      <textarea
        id="resume"
        value={resumeText}
        onChange={(e) => setResumeText(e.target.value)}
        rows={12}
        placeholder="Paste the whole thing — headings and all. It doesn't need tidying up first."
        className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-sky-500 focus:outline-none"
      />

      <label className="mt-6 block text-sm font-medium text-card-foreground" htmlFor="since">
        What have you done since? <span className="font-normal text-muted-foreground">(optional)</span>
      </label>
      <p className="mt-1 text-xs text-muted-foreground">
        One paragraph, your words. This goes at the top — it’s the most current thing about you.
      </p>
      <textarea
        id="since"
        value={sinceParagraph}
        onChange={(e) => setSince(e.target.value)}
        rows={4}
        className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-sky-500 focus:outline-none"
      />

      {result?.error && <p className="mt-4 text-sm text-red-400">{result.error}</p>}

      <button
        type="submit"
        disabled={busy || resumeText.trim().length < 40}
        className="mt-6 rounded-xl bg-sky-500 px-6 py-3 font-semibold text-zinc-950 transition hover:bg-sky-400 disabled:opacity-50"
      >
        {busy ? 'Reading it…' : 'Make my page'}
      </button>
      <p className="mt-3 text-xs text-muted-foreground">
        Free, and no account needed to try it.
      </p>
    </form>
  );
}
