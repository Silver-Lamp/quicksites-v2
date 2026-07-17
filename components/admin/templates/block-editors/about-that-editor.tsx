'use client';

// components/admin/templates/block-editors/about-that-editor.tsx
//
// Editor for the "About That" (HiveJournal narration) block: embed ID (required —
// the uuid from HiveJournal's embed screen), optional width, optional narrated-URL
// override. Everything else lives on HiveJournal's side.

import * as React from 'react';
import type { Block } from '@/types/blocks';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type Props = { block: Block; onSave?: (b: Block) => void; onClose?: () => void };

const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function AboutThatEditor({ block, onSave, onClose }: Props) {
  const c: any = block.content ?? {};
  const [local, setLocal] = React.useState({
    embed_id: typeof c.embed_id === 'string' ? c.embed_id : '',
    width: typeof c.width === 'string' ? c.width : typeof c.width === 'number' ? String(c.width) : '',
    url: typeof c.url === 'string' ? c.url : '',
  });

  React.useEffect(() => {
    const cc: any = block.content ?? {};
    setLocal({
      embed_id: typeof cc.embed_id === 'string' ? cc.embed_id : '',
      width: typeof cc.width === 'string' ? cc.width : typeof cc.width === 'number' ? String(cc.width) : '',
      url: typeof cc.url === 'string' ? cc.url : '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block._id]);

  function apply(partial: Partial<typeof local>) {
    const next = { ...local, ...partial };
    setLocal(next);
    const patch = {
      op: 'update_block',
      blockId: block._id,
      content: {
        ...(block.content as any),
        embed_id: next.embed_id.trim(),
        width: next.width.trim(),
        url: next.url.trim(),
      },
    };
    window.dispatchEvent(new CustomEvent('qs:template:apply-patch', { detail: patch as any }));
  }

  const idOk = UUID_RX.test(local.embed_id.trim());

  // Defensive type guard runs AFTER all hooks (rules-of-hooks).
  if (block.type !== 'about_that') return null;

  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <Label>
          Embed ID <span className="text-red-500">*</span>
        </Label>
        <Input
          value={local.embed_id}
          onChange={(e) => apply({ embed_id: e.target.value })}
          placeholder="e.g. 6f9c1b2a-3d4e-5f60-7a8b-9c0d1e2f3a4b"
        />
        {!idOk && local.embed_id.trim() !== '' && (
          <p className="text-xs text-amber-500">That doesn't look like a HiveJournal embed ID (uuid) yet.</p>
        )}
        <p className="text-xs text-muted-foreground">
          From your HiveJournal embed screen. The player only renders with a valid ID.
        </p>
      </div>

      <div className="grid gap-2">
        <Label>Width (optional)</Label>
        <Input
          value={local.width}
          onChange={(e) => apply({ width: e.target.value })}
          placeholder='e.g. 480 or 100%'
        />
      </div>

      <div className="grid gap-2">
        <Label>Narrated URL override (optional)</Label>
        <Input
          value={local.url}
          onChange={(e) => apply({ url: e.target.value })}
          placeholder="Defaults to the page's own address"
        />
      </div>

      <div className="mt-2 flex justify-end gap-2">
        <Button
          onClick={() =>
            onSave?.({
              ...block,
              content: {
                ...(block.content as any),
                embed_id: local.embed_id.trim(),
                width: local.width.trim(),
                url: local.url.trim(),
              },
            } as any)
          }
        >
          Save
        </Button>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}
