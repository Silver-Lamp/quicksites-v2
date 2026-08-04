'use client';

// The Verbatim intake form.
//
// ⚠️ THE GAPS ARE SHOWN, NOT SWALLOWED. The API returns what the résumé did NOT yield, and this
// surfaces it before the person walks into the editor. A tool that reports only what it found
// lets someone publish a page missing their own name and never notice — and the whole promise
// of this feature is that it tells you what it doesn't know rather than filling the silence.
// Deleting this list would make the product quietly worse in exactly the way it claims not to be.
import * as React from 'react';
import { extractPdfText } from '@/lib/rebuild/pdfText';
import PostingMatchPanel from '@/components/verbatim/posting-match';

type Result = {
  ok?: boolean;
  editorUrl?: string;
  gaps?: string[];
  read?: { name: string | null; skills: number; roles: number; links: number };
  error?: string;
  code?: string;
  /** Set when the draft was refused but the file still isn't — see the rate-limit branch. */
  exportAvailable?: boolean;
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
  const [reading, setReading] = React.useState(false);
  const [pdfNote, setPdfNote] = React.useState<string | null>(null);
  const [downloading, setDownloading] = React.useState(false);
  const [downloadError, setDownloadError] = React.useState<string | null>(null);

  /**
   * ⚠️ THE FILE NEVER LEAVES THE DEVICE. Extraction runs in the browser and only the resulting
   * TEXT is posted — the server needs the words, not a document full of the person's address,
   * phone number and employment history. Don't "simplify" this by uploading the PDF.
   *
   * And the text lands in the textarea rather than being submitted straight through: PDF
   * extraction is lossy (multi-column CVs interleave, image-only exports yield nothing), and
   * the parser downstream refuses to invent — so anything wrong has to be VISIBLE and
   * correctable before it becomes a page.
   */
  const onPickPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // let the same file be re-picked after a failure
    if (!file) return;
    setPdfNote(null);
    setReading(true);
    try {
      const { text, pages, quality } = await extractPdfText(file);
      if (quality === 'empty') {
        // The one diagnosis we can actually support: zero characters really does mean no text
        // layer. Even here we say what we OBSERVED before offering the likely cause.
        setPdfNote(
          'We couldn’t find any text in that PDF — it’s probably a scan or an image. Pasting the text works fine.',
        );
        return;
      }
      // ⚠️ ALWAYS KEEP THE TEXT. An earlier version discarded anything short and announced it
      // was a scan; it was wrong about a real résumé the first time it met one.
      setResumeText(text);
      setPdfNote(
        quality === 'thin'
          ? `Read ${pages} page${pages === 1 ? '' : 's'}, but that came out shorter than most résumés — worth checking nothing’s missing before you continue.`
          : `Read ${pages} page${pages === 1 ? '' : 's'} — have a look before you continue. PDFs don’t always come out in order, and we’d rather you fix it here than find it on your page.`,
      );
    } catch {
      setPdfNote('Couldn’t read that PDF. Pasting the text works just as well.');
    } finally {
      setReading(false);
    }
  };

  /**
   * Download the page as one self-contained HTML file.
   *
   * ⚠️ THE POINT OF THE WHOLE FEATURE, NOT A CONVENIENCE. Everything else here produces a site on
   * our platform, which is a bet that we still exist next year. This produces something the person
   * owns outright — it opens offline, prints, and has no link back to us. It is also the only path
   * that works when the draft limit has been hit, because it creates nothing.
   */
  const download = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const res = await fetch('/api/verbatim/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeText, sinceParagraph }),
      });
      if (!res.ok) throw new Error('export failed');
      const blob = await res.blob();
      // Filename comes from the server (Content-Disposition); this is the fallback for the
      // browser-download path, which cannot read that header cross-origin-safely.
      const name = (result?.read?.name || 'profile').toLowerCase().replace(/[^\w-]+/g, '-');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name}.html`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setDownloadError('Couldn’t build the file just now. Your text is still here — try again.');
    } finally {
      setDownloading(false);
    }
  };

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
      <>
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

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a
              href={result.editorUrl}
              className="inline-block rounded-xl bg-sky-500 px-6 py-3 font-semibold text-zinc-950 transition hover:bg-sky-400"
            >
              Open my page →
            </a>
            {/* Offered next to the primary action rather than hidden in a menu: for a job-seeker
                at a library, the file IS the outcome — it opens offline, prints, and carries no
                link back to us. */}
            <button
              type="button"
              onClick={download}
              disabled={downloading}
              className="rounded-xl border border-border px-5 py-3 text-sm font-medium text-foreground transition hover:border-sky-500/40 disabled:opacity-50"
            >
              {downloading ? 'Preparing…' : 'Download it to keep'}
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            The download is one file that works on any computer, with or without us.
          </p>
          {downloadError && <p className="mt-2 text-sm text-red-400">{downloadError}</p>}
        </div>

        {/* A second act, not a step. Offered only once a page exists, and it reuses the résumé
            already sitting in this component's state — so nothing is re-uploaded and the
            posting never leaves the browser at all. */}
        <PostingMatchPanel resumeText={resumeText} />
      </>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="block text-sm font-medium text-card-foreground" htmlFor="resume">
          Paste your résumé
        </label>
        <label className="cursor-pointer rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-sky-500/40 hover:text-foreground">
          {reading ? 'Reading…' : '…or upload a PDF'}
          <input type="file" accept="application/pdf,.pdf" className="sr-only" onChange={onPickPdf} disabled={reading} />
        </label>
      </div>
      {/* Said plainly, because it's true and it's the reason to prefer the upload. */}
      <p className="mt-1 text-xs text-muted-foreground">
        A PDF is read on your device — the file never reaches our servers, only the text you see below.
      </p>
      {pdfNote && (
        <p className="mt-2 rounded-lg border border-sky-500/25 bg-sky-500/5 px-3 py-2 text-xs text-foreground">
          {pdfNote}
        </p>
      )}
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

      {/* ⚠️ THE SHARED-WIFI CASE, GIVEN ITS OWN BRANCH ON PURPOSE. The draft cap is per-IP, and a
          library or classroom puts everyone behind one address — so the person who trips it did
          nothing wrong and is standing in a room where this was just recommended to them. Refusing
          the site is correct; refusing them their page is not, and the export creates nothing so
          it is always available. */}
      {result?.exportAvailable ? (
        <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-sm text-foreground">{result.error}</p>
          <button
            type="button"
            onClick={download}
            disabled={downloading}
            className="mt-3 rounded-lg bg-sky-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-300 disabled:opacity-50"
          >
            {downloading ? 'Preparing…' : 'Download my page'}
          </button>
          {downloadError && <p className="mt-2 text-sm text-red-400">{downloadError}</p>}
        </div>
      ) : (
        result?.error && <p className="mt-4 text-sm text-red-400">{result.error}</p>
      )}

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
