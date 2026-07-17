'use client';

// Editor for the comments block: display + anti-abuse settings, AND the inline
// moderation queue — the owner approves/rejects pending comments right here (owner-
// gated /api/comments/moderate). Approve-before-publish defaults ON.

import * as React from 'react';
import type { Block } from '@/types/blocks';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';

type Props = { block: Block; onSave?: (b: Block) => void; onClose?: () => void };
type Pending = { id: string; author_name: string; body: string; created_at: string };

function getTplId(): string {
  const t = (window as any).__QS_TPL_REF__?.current ?? (window as any).__QS_TEMPLATE__ ?? null;
  return String(t?.id ?? '');
}

export default function CommentsEditor({ block, onSave, onClose }: Props) {
  const c: any = block.content ?? {};
  const [local, setLocal] = React.useState({
    title: typeof c.title === 'string' && c.title ? c.title : 'Comments',
    moderation: c.moderation !== false,
    allow_links: c.allow_links === true,
    closed: c.closed === true,
    notify_email: typeof c.notify_email === 'string' ? c.notify_email : '',
  });
  React.useEffect(() => {
    const cc: any = block.content ?? {};
    setLocal({
      title: typeof cc.title === 'string' && cc.title ? cc.title : 'Comments',
      moderation: cc.moderation !== false,
      allow_links: cc.allow_links === true,
      closed: cc.closed === true,
      notify_email: typeof cc.notify_email === 'string' ? cc.notify_email : '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block._id]);

  const templateId = getTplId();
  const blockId = String(block._id ?? '');
  const [pending, setPending] = React.useState<Pending[]>([]);
  const [modBusy, setModBusy] = React.useState<string | null>(null);

  const loadPending = React.useCallback(async () => {
    if (!templateId) return;
    try {
      const res = await fetch(`/api/comments/moderate?templateId=${encodeURIComponent(templateId)}&blockId=${encodeURIComponent(blockId)}`, { cache: 'no-store' });
      const j = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(j.pending)) setPending(j.pending);
    } catch { /* quiet */ }
  }, [templateId, blockId]);
  React.useEffect(() => { void loadPending(); }, [loadPending]);

  const moderate = async (commentId: string, action: 'approve' | 'reject') => {
    setModBusy(commentId);
    try {
      await fetch('/api/comments/moderate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId, commentId, action }),
      });
      setPending((p) => p.filter((x) => x.id !== commentId));
    } catch { /* ignore */ } finally {
      setModBusy(null);
    }
  };

  function toContent(n: typeof local) {
    return {
      ...(block.content as any),
      title: n.title.trim(),
      moderation: n.moderation,
      allow_links: n.allow_links,
      closed: n.closed,
      notify_email: n.notify_email.trim(),
    };
  }
  function apply(partial: Partial<typeof local>) {
    const n = { ...local, ...partial };
    setLocal(n);
    window.dispatchEvent(new CustomEvent('qs:template:apply-patch', { detail: { op: 'update_block', blockId: block._id, content: toContent(n) } as any }));
  }

  if (block.type !== 'comments') return null;

  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <Label>Heading</Label>
        <Input value={local.title} onChange={(e) => apply({ title: e.target.value })} />
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border p-3">
        <div>
          <Label>Review comments before they appear</Label>
          <p className="text-xs text-muted-foreground">Recommended. Comments stay hidden until you approve them below.</p>
        </div>
        <Switch checked={local.moderation} onCheckedChange={(v) => apply({ moderation: !!v })} />
      </div>

      <div className="flex items-center justify-between">
        <Label>Allow links in comments</Label>
        <Switch checked={local.allow_links} onCheckedChange={(v) => apply({ allow_links: !!v })} />
      </div>
      <div className="flex items-center justify-between">
        <Label>Close the thread (no new comments)</Label>
        <Switch checked={local.closed} onCheckedChange={(v) => apply({ closed: !!v })} />
      </div>

      <div className="grid gap-2">
        <Label>Email me new comments (optional)</Label>
        <Input value={local.notify_email} onChange={(e) => apply({ notify_email: e.target.value })} placeholder="you@example.com" />
      </div>

      {/* Inline moderation queue */}
      <div className="grid gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
        <div className="flex items-center justify-between">
          <Label>Awaiting approval{pending.length ? ` (${pending.length})` : ''}</Label>
          <button type="button" onClick={() => void loadPending()} className="text-xs text-muted-foreground hover:text-foreground">Refresh</button>
        </div>
        {pending.length === 0 ? (
          <p className="text-xs text-muted-foreground">No comments waiting.</p>
        ) : (
          pending.map((p) => (
            <div key={p.id} className="rounded-md border border-border bg-background p-2">
              <div className="text-xs font-semibold">{p.author_name}</div>
              <p className="mt-0.5 whitespace-pre-wrap text-sm">{p.body}</p>
              <div className="mt-1.5 flex gap-2">
                <button type="button" disabled={modBusy === p.id} onClick={() => moderate(p.id, 'approve')}
                  className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-300">Approve</button>
                <button type="button" disabled={modBusy === p.id} onClick={() => moderate(p.id, 'reject')}
                  className="rounded border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-xs text-red-500 hover:bg-red-500/20">Reject</button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-2 flex justify-end gap-2">
        <Button onClick={() => onSave?.({ ...block, content: toContent(local) } as any)}>Save</Button>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}
