'use client';

// The workspace UI. Deliberately small: a list of your résumé sites, a list of postings you are
// pursuing, and one button per posting that opens HiveJournal's rehearsal room for it.
//
// ⚠️ NO AI ANYWHERE ON THIS PAGE. Verbatim's whole claim is that it rearranges what you wrote and
// never invents employment history; a workspace that offered to "improve" a posting summary or
// draft a cover letter would undo that on the same surface. Everything here is storage and
// navigation.

import * as React from 'react';
import { REHEARSAL_STAGES, STAGE_LABELS, rehearsalLinkFor, type JobPosting } from '@/lib/jobs/postings';
import type { ResumeVersion } from '@/lib/resumes/versions';
import ResumeLibrary from './resume-library';

type ResumeSite = {
  id: string;
  slug: string | null;
  name: string;
  published: boolean;
  url: string | null;
  /** The résumé version this site currently serves, if any. */
  servingLabel: string | null;
};

export default function WorkspaceClient({
  postings: initial,
  resumeSites,
  versions,
  siteSlug,
  siteId,
}: {
  postings: JobPosting[];
  resumeSites: ResumeSite[];
  versions: ResumeVersion[];
  siteSlug: string | null;
  siteId: string | null;
}) {
  const [postings, setPostings] = React.useState<JobPosting[]>(initial);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({ company: '', title: '', url: '', stage: '', body: '', notes: '' });

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/jobs/postings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Could not save that.');
      setPostings((p) => [j.posting, ...p]);
      setForm({ company: '', title: '', url: '', stage: '', body: '', notes: '' });
    } catch (err: any) {
      setError(err?.message ?? 'Could not save that.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    // ⚠️ Deleted for real, not hidden. This is a list of who someone is applying to; "archived but
    // still in the table" is not what a person means when they remove one.
    if (!confirm('Delete this posting? It is removed permanently.')) return;
    const res = await fetch(`/api/jobs/postings?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (res.ok) setPostings((p) => p.filter((x) => x.id !== id));
  };

  /** Record which résumé version an application actually went out with. */
  const linkVersion = async (id: string, resumeVersionId: string) => {
    const value = resumeVersionId || null;
    setPostings((p) => p.map((x) => (x.id === id ? { ...x, resume_version_id: value } : x)));
    await fetch('/api/jobs/postings', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, resumeVersionId: value }),
    });
  };

  const field = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground';

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-bold text-foreground">Your job search</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Private to you. Nobody at QuickSites can see this list — it is not in any admin view.
      </p>

      {/* ⚠️ THE PUBLIC SITE IS SHOWN HERE; THE PRIVATE BOARD IS NEVER SHOWN THERE. This panel is
          the whole "merge" — the workspace is the control room, and the site is what it publishes.
          The reverse (serving this page from <slug>.quicksites.ai) was considered and rejected:
          every path on a platform subdomain is rewritten to /sites/<slug>, so a private surface
          there means either a second login or widening the session cookie to `.quicksites.ai`,
          which would send it to every tenant site on the platform. */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Your résumé pages
        </h2>
        {resumeSites.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            None yet —{' '}
            <a className="underline" href="/verbatim">
              paste a résumé
            </a>{' '}
            to make one.
          </p>
        ) : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {resumeSites.map((s) => (
              <li key={s.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold text-card-foreground">{s.name}</span>
                  {s.published ? (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-400 ring-1 ring-emerald-500/30">
                      Live
                    </span>
                  ) : (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      Draft
                    </span>
                  )}
                </div>

                {s.url && (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 block truncate text-xs text-primary underline"
                  >
                    {s.url.replace(/^https:\/\//, '')} ↗
                  </a>
                )}

                <p className="mt-2 text-xs text-muted-foreground">
                  {s.servingLabel ? (
                    <>
                      Serving{' '}
                      <span className="font-medium text-foreground">{s.servingLabel}</span>
                    </>
                  ) : (
                    'No résumé published on this site yet'
                  )}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href={`/admin/templates/${s.id}`}
                    className="rounded-lg border border-border px-3 py-1 text-xs text-foreground hover:bg-muted"
                  >
                    Edit page
                  </a>
                  {s.slug && s.servingLabel && (
                    <a
                      href={`/api/resume/${s.slug}/pdf`}
                      className="rounded-lg border border-border px-3 py-1 text-xs text-foreground hover:bg-muted"
                    >
                      What visitors download ↓
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ResumeLibrary versions={versions} postings={postings} siteSlug={siteSlug} siteId={siteId} />

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Add a posting
        </h2>
        <form onSubmit={add} className="mt-2 grid gap-2 sm:grid-cols-2">
          <input className={field} placeholder="Company" value={form.company}
                 onChange={(e) => setForm({ ...form, company: e.target.value })} />
          <input className={field} placeholder="Role" value={form.title}
                 onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <input className={`${field} sm:col-span-2`} placeholder="Link to the posting"
                 value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
          <select className={field} value={form.stage}
                  onChange={(e) => setForm({ ...form, stage: e.target.value })}>
            <option value="">Which round?</option>
            {REHEARSAL_STAGES.map((s) => (
              <option key={s} value={s}>{STAGE_LABELS[s]}</option>
            ))}
          </select>
          <textarea className={`${field} sm:col-span-2`} rows={3}
                    placeholder="Paste the posting text (optional — we never fetch it for you)"
                    value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          <textarea className={`${field} sm:col-span-2`} rows={2}
                    placeholder="Your notes — referral, recruiter, what to emphasise"
                    value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="sm:col-span-2">
            <button type="submit" disabled={busy}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
              {busy ? 'Saving…' : 'Save posting'}
            </button>
            {error && <span className="ml-3 text-sm text-red-500">{error}</span>}
          </div>
        </form>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Postings ({postings.length})
        </h2>
        {postings.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nothing saved yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {postings.map((p) => (
              <li key={p.id} className="py-3">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-semibold text-foreground">{p.company || 'Untitled'}</span>
                  {p.title && <span className="text-muted-foreground">· {p.title}</span>}
                  {p.stage && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-foreground">
                      {STAGE_LABELS[p.stage] ?? p.stage}
                    </span>
                  )}
                </div>
                {p.url && (
                  <a href={p.url} target="_blank" rel="noopener noreferrer"
                     className="mt-0.5 block truncate text-xs text-muted-foreground underline">
                    {p.url}
                  </a>
                )}
                {p.notes && <p className="mt-1 text-sm text-muted-foreground">{p.notes}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  {/* ⚠️ Opens a link the person clicks; nothing is sent when a posting is merely
                      saved, and the posting BODY is never in the URL (see rehearsalLinkFor). */}
                  <a href={rehearsalLinkFor(p)} target="_blank" rel="noopener noreferrer"
                     className="rounded-lg border border-primary/40 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10">
                    Practice this interview ↗
                  </a>
                  {versions.length > 0 && (
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      Sent with
                      <select
                        className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
                        value={p.resume_version_id ?? ''}
                        onChange={(e) => void linkVersion(p.id, e.target.value)}
                      >
                        <option value="">—</option>
                        {versions.map((v) => (
                          <option key={v.id} value={v.id}>{v.label}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  <button onClick={() => remove(p.id)}
                          className="text-sm text-muted-foreground hover:text-red-500">
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-10 text-xs text-muted-foreground">
        {/* ⚠️ VERIFIED WITH HJ BEFORE SAYING IT IN OUR VOICE (2026-08-11): their prep/feedback/
            followup routes persist no content — the only write is a metadata-only call log with
            token counts and cost, no text and no user id.
            ⚠️ And deliberately NOT "never sent anywhere": text a person pastes there is processed
            by a model in-flight. "Keeps nothing" is the true claim; "never leaves your browser"
            would not be, and is the upgrade this sentence is one careless edit away from. */}
        &ldquo;Practice this interview&rdquo; opens HiveJournal&rsquo;s rehearsal room in a new tab.
        It keeps nothing you paste — it is processed in the moment and never stored. Only the
        company, role and round travel in the link; the description stays here unless you paste it
        there yourself.
      </p>
    </main>
  );
}
