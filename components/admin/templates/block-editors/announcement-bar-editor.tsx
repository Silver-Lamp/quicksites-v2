'use client';

// Editor for the announcement bar: message, optional link, promo code, and a REAL
// end time (past = the bar hides itself; no auto-resetting scarcity — house rule).

import * as React from 'react';
import type { Block } from '@/types/blocks';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';

type Props = { block: Block; onSave?: (b: Block) => void; onClose?: () => void };

function fromBlock(c: any) {
  const s = (v: any) => (typeof v === 'string' ? v : '');
  return {
    message: s(c?.message),
    link_text: s(c?.link_text),
    link_href: s(c?.link_href),
    code: s(c?.code),
    ends_at: s(c?.ends_at),
    dismissible: c?.dismissible !== false,
  };
}

export default function AnnouncementBarEditor({ block, onSave, onClose }: Props) {
  const [local, setLocal] = React.useState(() => fromBlock(block.content));
  React.useEffect(() => {
    setLocal(fromBlock(block.content));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block._id]);

  function toContent(next: typeof local) {
    return { ...(block.content as any), ...next, message: next.message.trim(), code: next.code.trim() };
  }
  function apply(partial: Partial<typeof local>) {
    const next = { ...local, ...partial };
    setLocal(next);
    window.dispatchEvent(
      new CustomEvent('qs:template:apply-patch', {
        detail: { op: 'update_block', blockId: block._id, content: toContent(next) } as any,
      }),
    );
  }

  const endsPast = local.ends_at && Number.isFinite(Date.parse(local.ends_at)) && Date.parse(local.ends_at) < Date.now();

  if (block.type !== 'announcement_bar') return null;

  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <Label>Message</Label>
        <Input value={local.message} onChange={(e) => apply({ message: e.target.value })} placeholder="Free local delivery on orders over $50" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label>Promo code (optional)</Label>
          <Input value={local.code} onChange={(e) => apply({ code: e.target.value })} placeholder="SUMMER10" />
        </div>
        <div className="grid gap-2">
          <Label>Ends (optional — real end time)</Label>
          <Input type="datetime-local" value={local.ends_at} onChange={(e) => apply({ ends_at: e.target.value })} />
        </div>
      </div>
      {endsPast && (
        <p className="text-xs text-amber-500">
          That end time has passed — the bar is currently hidden on the live site. Set a new REAL end time or clear it.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label>Link text (optional)</Label>
          <Input value={local.link_text} onChange={(e) => apply({ link_text: e.target.value })} placeholder="Shop the sale" />
        </div>
        <div className="grid gap-2">
          <Label>Link URL</Label>
          <Input value={local.link_href} onChange={(e) => apply({ link_href: e.target.value })} placeholder="#products or /sale" />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <Label>Visitors can dismiss</Label>
        <Switch checked={local.dismissible} onCheckedChange={(v) => apply({ dismissible: !!v })} />
      </div>
      <div className="mt-2 flex justify-end gap-2">
        <Button onClick={() => onSave?.({ ...block, content: toContent(local) } as any)}>Save</Button>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}
