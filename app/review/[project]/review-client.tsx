'use client';
// app/review/[project]/review-client.tsx
//
// Takes grouped by track, newest first. Each card: player (native <audio>/<video>, never
// autoplay), the transcript, 👍/👎 with who voted, comments + replies. Owner-only: an upload box
// per track, "Make this the live one", and the reviewer links to send. Dark chrome tokens only
// (CLAUDE.md §7) — this is an app page, not a tenant site.
import { useMemo, useState } from 'react';
import type { VersionThread, Feedback } from '@/lib/creative/versions';

type Track = { key: string; label: string; kind: 'audio' | 'video' };
type Props = {
  project: { key: string; title: string; tracks: Track[] };
  viewer: { key: string; name: string };
  isOwner: boolean;
  token: string | null;
  initialThreads: VersionThread[];
  reviewerLinks: Array<{ name: string; href: string }>;
};

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
function fmtDur(s: number | null): string {
  if (typeof s !== 'number' || !Number.isFinite(s) || s <= 0) return '';
  return `${Math.round(s)} s`;
}

export function ReviewClient({ project, viewer, isOwner, token, initialThreads, reviewerLinks }: Props) {
  const [threads, setThreads] = useState<VersionThread[]>(initialThreads);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const byTrack = useMemo(() => {
    const m = new Map<string, VersionThread[]>();
    for (const t of threads) {
      const list = m.get(t.version.track) ?? [];
      list.push(t);
      m.set(t.version.track, list);
    }
    for (const list of m.values()) list.sort((a, b) => b.version.version - a.version.version);
    return m;
  }, [threads]);

  async function refresh() {
    const r = await fetch(`/api/review/${project.key}${token ? `?token=${encodeURIComponent(token)}` : ''}`, { cache: 'no-store' });
    const j = await r.json().catch(() => null);
    if (j?.threads) setThreads(j.threads);
  }

  async function post(body: Record<string, unknown>) {
    const r = await fetch(`/api/review/${project.key}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...body, ...(token ? { token } : {}) }),
    });
    const j = await r.json().catch(() => null);
    if (!r.ok) setMsg(j?.error ? `Could not save (${j.error}).` : 'Could not save.');
    return r.ok;
  }

  async function vote(versionId: string, v: 'up' | 'down', current: 'up' | 'down' | null) {
    setBusy(versionId);
    await post({ action: 'vote', versionId, vote: current === v ? null : v });
    await refresh();
    setBusy(null);
  }

  async function comment(versionId: string, body: string, parentId: string | null) {
    setBusy(versionId);
    const ok = await post({ action: 'comment', versionId, body, parentId });
    if (ok) await refresh();
    setBusy(null);
    return ok;
  }

  async function makeLive(versionId: string) {
    if (!isOwner) return;
    if (!window.confirm('Swap the live site to this take and republish?')) return;
    setBusy(versionId);
    const r = await fetch(`/api/admin/creative/${project.key}/set-live`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ versionId }) });
    const j = await r.json().catch(() => null);
    setMsg(r.ok ? `Live now${j?.republished ? ', republished' : ''}.${j?.warning ? ' ' + j.warning : ''}` : `Not switched: ${j?.hint || j?.error || r.status}`);
    await refresh();
    setBusy(null);
  }

  // Three steps, because a generator WAV (~6 MB) is over Vercel's 4.5 MB function-body cap:
  // sign → PUT the bytes straight into storage → register the path. Our API never sees the file.
  async function upload(track: Track, form: HTMLFormElement) {
    const fd = new FormData(form);
    const file = fd.get('file');
    if (!(file instanceof File) || !file.size) { setMsg('Pick a file first.'); return; }
    const notes = String(fd.get('notes') ?? '');
    setBusy(`upload-${track.key}`);
    try {
      const sign = await fetch(`/api/admin/creative/${project.key}/upload-url`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ track: track.key, filename: file.name, contentType: file.type, size: file.size }) });
      const s = await sign.json().catch(() => null);
      if (!sign.ok || !s?.signedUrl) { setMsg(`Upload refused: ${s?.detail || s?.error || sign.status}`); return; }
      const put = await fetch(s.signedUrl, { method: 'PUT', headers: { 'content-type': s.contentType, 'x-upsert': 'false' }, body: file });
      if (!put.ok) { setMsg(`Storage refused the file (${put.status}).`); return; }
      const reg = await fetch(`/api/admin/creative/${project.key}/upload`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ track: track.key, path: s.path, notes }) });
      const j = await reg.json().catch(() => null);
      setMsg(reg.ok ? `Added v${j?.version?.version ?? '?'} to ${track.label}. Transcript follows in a few seconds.` : `Not registered: ${j?.hint || j?.detail || j?.error || reg.status}`);
      form.reset();
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 text-foreground">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">{project.title} — takes for review</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          You are leaving notes as <span className="font-medium text-foreground">{viewer.name}</span>
          {isOwner ? ' (owner).' : '. This link is yours; anyone holding it speaks as you.'} Newest take first. Nothing here plays until you press play.
        </p>
        {isOwner && reviewerLinks.length > 0 && (
          <div className="mt-3 rounded-lg border border-border bg-card p-3 text-sm text-card-foreground">
            <div className="font-medium">Links to send (each names the reviewer; valid 90 days)</div>
            <ul className="mt-1 space-y-1">
              {reviewerLinks.map((l) => (
                <li key={l.name} className="flex flex-wrap items-center gap-2">
                  <span className="w-16">{l.name}</span>
                  <button type="button" className="rounded border border-border px-2 py-0.5 text-xs hover:bg-muted" onClick={() => navigator.clipboard?.writeText(`${window.location.origin}${l.href}`).then(() => setMsg(`Copied ${l.name}'s link.`))}>
                    Copy link
                  </button>
                  <a className="truncate text-xs text-muted-foreground underline" href={l.href} target="_blank" rel="noreferrer">open</a>
                </li>
              ))}
            </ul>
          </div>
        )}
        {msg && <p className="mt-3 rounded border border-border bg-muted px-3 py-2 text-sm" role="status">{msg}</p>}
      </header>

      {project.tracks.map((track) => {
        const list = byTrack.get(track.key) ?? [];
        return (
          <section key={track.key} className="mb-10">
            <h2 className="mb-3 text-lg font-semibold">{track.label}</h2>
            {isOwner && (
              <form
                className="mb-4 flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-border p-3 text-sm"
                onSubmit={(e) => { e.preventDefault(); void upload(track, e.currentTarget); }}
              >
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">New take ({track.kind === 'audio' ? 'WAV/MP3' : 'MP4/WebM'})</span>
                  <input name="file" type="file" required accept={track.kind === 'audio' ? 'audio/*' : 'video/*'} className="text-xs" />
                </label>
                <label className="flex flex-1 flex-col gap-1">
                  <span className="text-xs text-muted-foreground">What changed (optional)</span>
                  <input name="notes" type="text" className="rounded border border-border bg-background px-2 py-1" placeholder="e.g. team line out, ingredients in, tagline close" />
                </label>
                <button type="submit" disabled={busy === `upload-${track.key}`} className="rounded bg-primary px-3 py-1.5 text-primary-foreground disabled:opacity-50">
                  {busy === `upload-${track.key}` ? 'Uploading…' : 'Add take'}
                </button>
              </form>
            )}
            {list.length === 0 && <p className="text-sm text-muted-foreground">No takes yet.</p>}
            <div className="space-y-4">
              {list.map((t) => (
                <VersionCard
                  key={t.version.id}
                  thread={t}
                  viewer={viewer}
                  isOwner={isOwner}
                  busy={busy === t.version.id}
                  onVote={vote}
                  onComment={comment}
                  onMakeLive={makeLive}
                />
              ))}
            </div>
          </section>
        );
      })}
    </main>
  );
}

function VersionCard({ thread, viewer, isOwner, busy, onVote, onComment, onMakeLive }: {
  thread: VersionThread;
  viewer: { key: string; name: string };
  isOwner: boolean;
  busy: boolean;
  onVote: (versionId: string, v: 'up' | 'down', current: 'up' | 'down' | null) => Promise<void>;
  onComment: (versionId: string, body: string, parentId: string | null) => Promise<boolean>;
  onMakeLive: (versionId: string) => Promise<void>;
}) {
  const v = thread.version;
  const mine: 'up' | 'down' | null = thread.up.includes(viewer.name) ? 'up' : thread.down.includes(viewer.name) ? 'down' : null;
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [showTranscript, setShowTranscript] = useState(false);

  return (
    <article className="rounded-lg border border-border bg-card p-4 text-card-foreground">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold">
          v{v.version} · {v.title}
          {v.is_live && <span className="ml-2 rounded bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-300">live on the site</span>}
        </h3>
        <span className="text-xs text-muted-foreground">{fmtWhen(v.created_at)}{fmtDur(v.duration_seconds) ? ` · ${fmtDur(v.duration_seconds)}` : ''}</span>
      </div>
      {v.notes && <p className="mt-1 text-sm text-muted-foreground">{v.notes}</p>}
      <div className="mt-3">
        {v.kind === 'audio' ? (
          <audio controls preload="metadata" src={v.url} className="w-full" />
        ) : (
          <video controls preload="metadata" src={v.url} className="max-h-[480px] w-full rounded bg-black" />
        )}
      </div>
      {v.kind === 'audio' && (
        <div className="mt-2 text-sm">
          {v.transcript_status === 'done' && v.transcript ? (
            <>
              <button type="button" className="text-xs underline text-muted-foreground" onClick={() => setShowTranscript((s) => !s)}>
                {showTranscript ? 'Hide what it says' : 'Show what it says'}
              </button>
              {showTranscript && <blockquote className="mt-1 border-l-2 border-border pl-3 text-muted-foreground">{v.transcript}</blockquote>}
            </>
          ) : v.transcript_status === 'pending' ? (
            <span className="text-xs text-muted-foreground">Transcript on its way…</span>
          ) : v.transcript_status === 'failed' ? (
            <span className="text-xs text-muted-foreground">Transcript could not be made for this take.</span>
          ) : null}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <button type="button" disabled={busy} aria-pressed={mine === 'up'} onClick={() => void onVote(v.id, 'up', mine)}
          className={`rounded border px-3 py-1 ${mine === 'up' ? 'border-emerald-500/60 bg-emerald-500/15' : 'border-border hover:bg-muted'} disabled:opacity-50`}>
          👍 {thread.up.length}
        </button>
        <button type="button" disabled={busy} aria-pressed={mine === 'down'} onClick={() => void onVote(v.id, 'down', mine)}
          className={`rounded border px-3 py-1 ${mine === 'down' ? 'border-rose-500/60 bg-rose-500/15' : 'border-border hover:bg-muted'} disabled:opacity-50`}>
          👎 {thread.down.length}
        </button>
        {(thread.up.length > 0 || thread.down.length > 0) && (
          <span className="text-xs text-muted-foreground">
            {thread.up.length > 0 && <>up: {thread.up.join(', ')}</>}
            {thread.up.length > 0 && thread.down.length > 0 && ' · '}
            {thread.down.length > 0 && <>down: {thread.down.join(', ')}</>}
          </span>
        )}
        {isOwner && !v.is_live && (
          <button type="button" disabled={busy} onClick={() => void onMakeLive(v.id)} className="ml-auto rounded border border-border px-3 py-1 text-xs hover:bg-muted disabled:opacity-50">
            Make this the live one
          </button>
        )}
      </div>

      <div className="mt-4 space-y-3">
        {thread.comments.map((c) => (
          <CommentRow key={c.id} c={c} viewer={viewer} isOwner={isOwner} replyOpen={replyTo === c.id} onReply={() => { setReplyTo(replyTo === c.id ? null : c.id); setReplyDraft(''); }}
            replyDraft={replyDraft} setReplyDraft={setReplyDraft}
            onSubmitReply={async () => { if (await onComment(v.id, replyDraft, c.id)) { setReplyDraft(''); setReplyTo(null); } }} busy={busy} />
        ))}
        <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (await onComment(v.id, draft, null)) setDraft(''); }}>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={`Leave a note as ${viewer.name}…`} className="flex-1 rounded border border-border bg-background px-2 py-1 text-sm" maxLength={4000} />
          <button type="submit" disabled={busy || !draft.trim()} className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground disabled:opacity-50">Post</button>
        </form>
      </div>
    </article>
  );
}

function CommentRow({ c, viewer, isOwner, replyOpen, onReply, replyDraft, setReplyDraft, onSubmitReply, busy }: {
  c: Feedback & { replies: Feedback[] };
  viewer: { key: string; name: string };
  isOwner: boolean;
  replyOpen: boolean;
  onReply: () => void;
  replyDraft: string;
  setReplyDraft: (s: string) => void;
  onSubmitReply: () => Promise<void>;
  busy: boolean;
}) {
  const isOwnerRow = (f: Feedback) => f.author_key === 'owner';
  return (
    <div className="rounded border border-border bg-background/60 p-3 text-sm">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium">{c.author_name}{isOwnerRow(c) ? ' (owner)' : ''}</span>
        <span className="text-xs text-muted-foreground">{fmtWhen(c.created_at)}</span>
      </div>
      <p className="mt-1 whitespace-pre-wrap">{c.body}</p>
      {c.replies.length > 0 && (
        <div className="mt-2 space-y-2 border-l-2 border-border pl-3">
          {c.replies.map((r) => (
            <div key={r.id}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{r.author_name}{isOwnerRow(r) ? ' (owner)' : ''}</span>
                <span className="text-xs text-muted-foreground">{fmtWhen(r.created_at)}</span>
              </div>
              <p className="mt-0.5 whitespace-pre-wrap">{r.body}</p>
            </div>
          ))}
        </div>
      )}
      <div className="mt-2">
        <button type="button" className="text-xs text-muted-foreground underline" onClick={onReply}>{replyOpen ? 'Cancel' : 'Reply'}</button>
        {replyOpen && (
          <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); void onSubmitReply(); }}>
            <input value={replyDraft} onChange={(e) => setReplyDraft(e.target.value)} placeholder={`Reply as ${viewer.name}${isOwner ? ' (owner)' : ''}…`} className="flex-1 rounded border border-border bg-background px-2 py-1 text-sm" maxLength={4000} />
            <button type="submit" disabled={busy || !replyDraft.trim()} className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground disabled:opacity-50">Reply</button>
          </form>
        )}
      </div>
    </div>
  );
}
