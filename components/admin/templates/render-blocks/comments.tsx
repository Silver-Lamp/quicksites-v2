'use client';

// components/admin/templates/render-blocks/comments.tsx
//
// Comments / discussion block — the platform's public UGC surface. Renders the
// APPROVED comments (GET /api/comments) + a post form (POST /api/comments). All
// anti-abuse lives server-side (screening, rate-limit, moderation, link-strip); this
// UI just posts and honestly tells the visitor when a comment is awaiting approval.
// Comments are plain text — rendered as text nodes, never HTML.

import * as React from 'react';
import type { Block } from '@/types/blocks';

type Props = { block?: Block; content?: Block['content']; template?: any; previewOnly?: boolean };
type Comment = { id: string; author_name: string; body: string; created_at: string };

export default function RenderComments({ block, content, template, previewOnly }: Props) {
  const c: any = content ?? block?.content ?? {};
  const title: string = c.title || 'Comments';
  const closed: boolean = c.closed === true;
  const moderationOn: boolean = c.moderation !== false;

  const templateId: string =
    (template as any)?.id ?? (typeof window !== 'undefined' ? (window as any).__QS_TEMPLATE__?.id : '') ?? '';
  const blockId: string = String((block as any)?._id ?? (block as any)?.id ?? '');

  const [comments, setComments] = React.useState<Comment[]>([]);
  const [name, setName] = React.useState('');
  const [text, setText] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);

  const load = React.useCallback(async () => {
    if (!templateId || !blockId) return;
    try {
      const res = await fetch(`/api/comments?templateId=${encodeURIComponent(templateId)}&blockId=${encodeURIComponent(blockId)}`, { cache: 'no-store' });
      const j = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(j.comments)) setComments(j.comments);
    } catch { /* quiet */ }
  }, [templateId, blockId]);
  React.useEffect(() => { void load(); }, [load]);

  const submit = async () => {
    if (busy || previewOnly) return;
    if (!name.trim() || text.trim().length < 2) { setMsg({ ok: false, text: 'Add your name and a comment.' }); return; }
    setBusy(true); setMsg(null);
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId, blockId, author: name, body: text }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || 'Could not post.');
      setText('');
      setMsg({ ok: true, text: j.status === 'approved' ? 'Posted ✓' : 'Thanks — your comment is awaiting the owner’s approval.' });
      if (j.status === 'approved') void load();
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || 'Could not post.' });
    } finally {
      setBusy(false);
    }
  };

  const when = (iso: string) => {
    const d = Date.parse(iso);
    return Number.isFinite(d) ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  };

  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-8">
      <h2 className="text-xl font-bold tracking-tight">{title}</h2>

      <div className="mt-4 space-y-3">
        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Be the first to comment.</p>
        ) : (
          comments.map((cm) => (
            <div key={cm.id} className="rounded-xl border border-border bg-card p-4 text-card-foreground">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold">{cm.author_name}</span>
                <span className="text-xs text-muted-foreground">{when(cm.created_at)}</span>
              </div>
              {/* Plain text only — rendered as a text node, never HTML. */}
              <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/90">{cm.body}</p>
            </div>
          ))
        )}
      </div>

      {closed ? (
        <p className="mt-5 text-sm text-muted-foreground">This discussion is closed.</p>
      ) : (
        <div className="mt-6 space-y-2 border-t border-border pt-4">
          <div className="grid gap-2 sm:grid-cols-[12rem_1fr]">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={80}
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
          </div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={2000} placeholder="Add a comment…"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
          {msg && <p className={`text-sm ${msg.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>{msg.text}</p>}
          <button type="button" onClick={submit} disabled={busy}
            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {busy ? 'Posting…' : 'Post comment'}
          </button>
          {moderationOn && <p className="text-[11px] text-muted-foreground/70">Comments are reviewed before they appear.</p>}
        </div>
      )}
    </section>
  );
}
