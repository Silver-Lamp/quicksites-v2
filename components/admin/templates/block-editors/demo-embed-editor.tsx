'use client';

// Editor for the HJ demo embed: slug (with a browse-the-public-catalog picker so
// nobody types slugs by hand) + optional width.

import * as React from 'react';
import type { Block } from '@/types/blocks';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const HJ_API = 'https://hivejournalbackend-production.up.railway.app/api/studio-demos/public';

type Props = { block: Block; onSave?: (b: Block) => void; onClose?: () => void };
type CatalogDemo = { slug: string; title: string; feature_name?: string; video_url: string | null };

export default function DemoEmbedEditor({ block, onSave, onClose }: Props) {
  const c: any = block.content ?? {};
  const [local, setLocal] = React.useState({
    slug: typeof c.slug === 'string' ? c.slug : '',
    width: typeof c.width === 'string' ? c.width : '',
  });
  const [catalog, setCatalog] = React.useState<CatalogDemo[] | null>(null);

  React.useEffect(() => {
    const cc: any = block.content ?? {};
    setLocal({ slug: typeof cc.slug === 'string' ? cc.slug : '', width: typeof cc.width === 'string' ? cc.width : '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block._id]);

  React.useEffect(() => {
    let active = true;
    fetch(HJ_API, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => { if (active) setCatalog(Array.isArray(j?.demos) ? j.demos : []); })
      .catch(() => { if (active) setCatalog([]); });
    return () => { active = false; };
  }, []);

  function apply(partial: Partial<typeof local>) {
    const next = { ...local, ...partial };
    setLocal(next);
    window.dispatchEvent(
      new CustomEvent('qs:template:apply-patch', {
        detail: { op: 'update_block', blockId: block._id, content: { ...(block.content as any), ...next } } as any,
      }),
    );
  }

  if (block.type !== 'demo_embed') return null;

  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <Label>Demo</Label>
        {catalog === null ? (
          <p className="text-xs text-muted-foreground">Loading the public demo catalog…</p>
        ) : catalog.length ? (
          <select
            value={local.slug}
            onChange={(e) => apply({ slug: e.target.value })}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Pick a demo…</option>
            {catalog.map((d) => (
              <option key={d.slug} value={d.slug}>
                {d.title}{d.video_url ? ' 🎬' : ' (live player)'}
              </option>
            ))}
          </select>
        ) : (
          <p className="text-xs text-muted-foreground">Catalog unreachable — paste the slug manually below.</p>
        )}
        <Input value={local.slug} onChange={(e) => apply({ slug: e.target.value })} placeholder="demo slug" />
      </div>
      <div className="grid gap-2">
        <Label>Max width (optional)</Label>
        <Input value={local.width} onChange={(e) => apply({ width: e.target.value })} placeholder="e.g. 720 or 100%" />
      </div>
      <div className="mt-2 flex justify-end gap-2">
        <Button onClick={() => onSave?.({ ...block, content: { ...(block.content as any), ...local } } as any)}>Save</Button>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}
