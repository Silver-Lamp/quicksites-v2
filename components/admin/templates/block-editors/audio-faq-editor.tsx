'use client';

// Editor for the Audio FAQ block: the HiveJournal embed ID (FAQ must be enabled on
// that embed), a heading, and an optional page-URL override for what gets answered.

import * as React from 'react';
import type { Block } from '@/types/blocks';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type Props = { block: Block; onSave?: (b: Block) => void; onClose?: () => void };
const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function AudioFaqEditor({ block, onSave, onClose }: Props) {
  const c: any = block.content ?? {};
  const [local, setLocal] = React.useState({
    embed_id: typeof c.embed_id === 'string' ? c.embed_id : '',
    title: typeof c.title === 'string' && c.title ? c.title : 'Ask about this page',
    url: typeof c.url === 'string' ? c.url : '',
  });
  React.useEffect(() => {
    const cc: any = block.content ?? {};
    setLocal({
      embed_id: typeof cc.embed_id === 'string' ? cc.embed_id : '',
      title: typeof cc.title === 'string' && cc.title ? cc.title : 'Ask about this page',
      url: typeof cc.url === 'string' ? cc.url : '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block._id]);

  function apply(partial: Partial<typeof local>) {
    const next = { ...local, ...partial };
    setLocal(next);
    window.dispatchEvent(
      new CustomEvent('qs:template:apply-patch', {
        detail: {
          op: 'update_block',
          blockId: block._id,
          content: { ...(block.content as any), embed_id: next.embed_id.trim(), title: next.title, url: next.url.trim() },
        } as any,
      }),
    );
  }

  const idOk = local.embed_id.trim() === '' || UUID_RX.test(local.embed_id.trim());
  if (block.type !== 'audio_faq') return null;

  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <Label>Heading</Label>
        <Input value={local.title} onChange={(e) => apply({ title: e.target.value })} placeholder="Ask about this page" />
      </div>
      <div className="grid gap-2">
        <Label>HiveJournal embed ID <span className="text-red-500">*</span></Label>
        <Input value={local.embed_id} onChange={(e) => apply({ embed_id: e.target.value })} placeholder="uuid — FAQ must be enabled on this embed" />
        {!idOk && <p className="text-xs text-amber-500">That doesn't look like an embed ID (uuid) yet.</p>}
        <p className="text-xs text-muted-foreground">
          Visitors ask questions answered from this page's content, in your voice. Turn on FAQ for this embed on your HiveJournal dashboard.
        </p>
      </div>
      <div className="grid gap-2">
        <Label>Answer a different URL (optional)</Label>
        <Input value={local.url} onChange={(e) => apply({ url: e.target.value })} placeholder="Defaults to this page" />
      </div>
      <div className="mt-2 flex justify-end gap-2">
        <Button
          onClick={() =>
            onSave?.({ ...block, content: { ...(block.content as any), embed_id: local.embed_id.trim(), title: local.title, url: local.url.trim() } } as any)
          }
        >
          Save
        </Button>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}
