'use client';

// The résumé-version library: many tailored versions, one of them served publicly.
//
// ⚠️ THE TWO PRIVACY CLASSES ARE VISIBLE IN THIS UI ON PURPOSE. A version's name is private and is
// meant to say "Indeed — Distinguished Engineer, AI"; the file it serves is public and says
// nothing. If those ever look like one thing to whoever edits this next, the natural "improvement"
// is to show the version name on the site or put it in the download — which is the disclosure the
// whole feature was built to prevent. Hence the copy under the heading, which is not decoration.

import * as React from 'react';
import {
  RESUME_FORMATS,
  formatsOf,
  type ResumeFormat,
  type ResumeVersion,
} from '@/lib/resumes/versions';
import type { JobPosting } from '@/lib/jobs/postings';

const EXT_TO_FORMAT: Record<string, ResumeFormat> = {
  pdf: 'pdf',
  docx: 'docx',
  md: 'md',
  markdown: 'md',
};

export default function ResumeLibrary({
  versions: initial,
  postings,
  siteSlug,
  siteId,
}: {
  versions: ResumeVersion[];
  postings: JobPosting[];
  siteSlug: string | null;
  /** The one site that serves the public copy. Publishing is disabled without it — see 20260830. */
  siteId: string | null;
}) {
  const [versions, setVersions] = React.useState<ResumeVersion[]>(initial);
  const [label, setLabel] = React.useState('');
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const publicId = versions.find((v) => v.is_public)?.id ?? null;

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('new');
    setError(null);
    try {
      const res = await fetch('/api/verbatim/resumes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ label }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Could not save that.');
      setVersions((v) => [j.version, ...v]);
      setLabel('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that.');
    } finally {
      setBusy(null);
    }
  };

  const upload = async (versionId: string, files: FileList | null) => {
    if (!files?.length) return;
    setBusy(versionId);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
        const format = EXT_TO_FORMAT[ext];
        // ⚠️ Refuse rather than guess. A file we cannot name a format for is one we would be
        // serving with the wrong content type to whoever downloads it next.
        if (!format) throw new Error(`Not a résumé format we serve: ${file.name}`);
        const fd = new FormData();
        fd.set('versionId', versionId);
        fd.set('format', format);
        fd.set('file', file);
        const res = await fetch('/api/verbatim/resumes', { method: 'POST', body: fd });
        const j = await res.json();
        if (!res.ok) throw new Error(j?.error || 'Upload failed.');
        setVersions((v) => v.map((x) => (x.id === versionId ? j.version : x)));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setBusy(null);
    }
  };

  const setPublic = async (id: string | null) => {
    setBusy(id ?? 'none');
    setError(null);
    try {
      const res = await fetch('/api/verbatim/resumes', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ publicId: id, siteId }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Could not change that.');
      setVersions((v) =>
        v.map((x) => ({
          ...x,
          is_public: x.id === id,
          public_site_id: x.id === id ? siteId : null,
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change that.');
    } finally {
      setBusy(null);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this version and its files? This cannot be undone.')) return;
    const res = await fetch(`/api/verbatim/resumes?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (res.ok) setVersions((v) => v.filter((x) => x.id !== id));
  };

  const field =
    'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground';

  return (
    <section className="mt-10">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Résumé versions ({versions.length})
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Private to you. Name them after the job — that name never appears on your site, in the
        download link, or in the file a recruiter saves.
        {siteSlug ? (
          <>
            {' '}
            Whichever one is marked <strong className="text-foreground">Public</strong> is what{' '}
            <code className="rounded bg-muted px-1">{siteSlug}</code> serves.
          </>
        ) : null}
      </p>

      <form onSubmit={create} className="mt-3 flex flex-wrap gap-2">
        <input
          className={`${field} max-w-md flex-1`}
          placeholder="e.g. Indeed — Distinguished Engineer, AI"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <button
          type="submit"
          disabled={busy === 'new' || !label.trim()}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {busy === 'new' ? 'Adding…' : 'Add version'}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

      {versions.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No versions yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {versions.map((v) => {
            const formats = formatsOf(v);
            const usedFor = postings.filter((p) => p.resume_version_id === v.id);
            return (
              <li key={v.id} className="py-4">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-semibold text-foreground">{v.label}</span>
                  {v.is_public && (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-400 ring-1 ring-emerald-500/30">
                      Public
                    </span>
                  )}
                  {formats.length === 0 && (
                    <span className="text-xs text-muted-foreground">no files yet</span>
                  )}
                </div>

                {usedFor.length > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Sent to{' '}
                    {usedFor
                      .map((p) => [p.company, p.title].filter(Boolean).join(' · ') || 'a posting')
                      .join(', ')}
                  </p>
                )}

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {formats.map((f) => (
                    <a
                      key={f}
                      href={`/api/verbatim/resumes/${v.id}/file?format=${f}`}
                      className="rounded-full border border-border px-3 py-1 text-xs text-foreground hover:bg-muted"
                    >
                      {RESUME_FORMATS[f].label} ↓
                    </a>
                  ))}
                  <label className="cursor-pointer rounded-full border border-dashed border-border px-3 py-1 text-xs text-muted-foreground hover:bg-muted">
                    {busy === v.id ? 'Uploading…' : '+ Add files'}
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.docx,.md"
                      className="hidden"
                      onChange={(e) => {
                        void upload(v.id, e.target.files);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-3">
                  {v.is_public ? (
                    <button
                      onClick={() => void setPublic(null)}
                      className="text-sm text-muted-foreground hover:text-foreground"
                    >
                      Take down
                    </button>
                  ) : (
                    <button
                      onClick={() => void setPublic(v.id)}
                      disabled={formats.length === 0 || !siteId}
                      className="rounded-lg border border-primary/40 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 disabled:opacity-40"
                      title={
                        !siteId
                          ? 'Publish a personal site first — a résumé is public ON a site'
                          : formats.length === 0
                            ? 'Add a file first'
                            : undefined
                      }
                    >
                      Make this the public one
                    </button>
                  )}
                  <button
                    onClick={() => void remove(v.id)}
                    className="text-sm text-muted-foreground hover:text-red-500"
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {publicId && siteSlug && (
        <p className="mt-4 text-xs text-muted-foreground">
          {/* ⚠️ Says what switching actually does. "Public" is one-way in practice: changing the
              choice controls what is served NEXT, and implying a recall would be a promise we
              cannot keep about a file someone already has. */}
          Live now at <code className="rounded bg-muted px-1">/api/resume/{siteSlug}/pdf</code>.
          Switching versions changes what that link serves from the next request on — it cannot
          un-send a copy someone already downloaded.
        </p>
      )}
    </section>
  );
}
