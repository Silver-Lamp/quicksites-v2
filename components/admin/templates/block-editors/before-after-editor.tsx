'use client';

// Editor for the before_after block: two image URLs + their labels + a heading.

import * as React from 'react';
import type { Block } from '@/types/blocks';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type Props = { block: Block; onSave?: (b: Block) => void; onClose?: () => void };

export default function BeforeAfterEditor({ block, onSave, onClose }: Props) {
  const init = React.useCallback((cc: any) => ({
    title: typeof cc.title === 'string' ? cc.title : 'See the difference',
    before_url: typeof cc.before_url === 'string' ? cc.before_url : '',
    after_url: typeof cc.after_url === 'string' ? cc.after_url : '',
    before_label: typeof cc.before_label === 'string' ? cc.before_label : 'Before',
    after_label: typeof cc.after_label === 'string' ? cc.after_label : 'After',
  }), []);
  const [local, setLocal] = React.useState(() => init(block.content ?? {}));
  React.useEffect(() => { setLocal(init(block.content ?? {})); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [block._id]);

  const toContent = (n: typeof local) => ({
    ...(block.content as any),
    title: n.title.trim(), before_url: n.before_url.trim(), after_url: n.after_url.trim(),
    before_label: n.before_label.trim() || 'Before', after_label: n.after_label.trim() || 'After',
  });
  function apply(partial: Partial<typeof local>) {
    const n = { ...local, ...partial };
    setLocal(n);
    window.dispatchEvent(new CustomEvent('qs:template:apply-patch', { detail: { op: 'update_block', blockId: block._id, content: toContent(n) } as any }));
  }

  if (block.type !== 'before_after') return null;

  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <Label>Heading</Label>
        <Input value={local.title} onChange={(e) => apply({ title: e.target.value })} />
      </div>
      <div className="grid gap-2 rounded-lg border border-border p-3">
        <Label>Before</Label>
        <Input value={local.before_url} onChange={(e) => apply({ before_url: e.target.value })} placeholder="Before image URL" />
        <Input value={local.before_label} onChange={(e) => apply({ before_label: e.target.value })} placeholder="Label (Before)" />
      </div>
      <div className="grid gap-2 rounded-lg border border-border p-3">
        <Label>After</Label>
        <Input value={local.after_url} onChange={(e) => apply({ after_url: e.target.value })} placeholder="After image URL" />
        <Input value={local.after_label} onChange={(e) => apply({ after_label: e.target.value })} placeholder="Label (After)" />
      </div>
      <p className="text-xs text-muted-foreground">Use the same framing/angle for both shots so the wipe lines up.</p>

      <div className="mt-2 flex justify-end gap-2">
        <Button onClick={() => onSave?.({ ...block, content: toContent(local) } as any)}>Save</Button>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}
