'use client';

// Editor for the reviews block: owner pastes REAL customer reviews (house rule —
// copy them word-for-word, never fabricate); product_name ties the block to a
// product so the honest JSON-LD path lights up (see the renderer's schema notes).

import * as React from 'react';
import type { Block } from '@/types/blocks';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';

type Props = { block: Block; onSave?: (b: Block) => void; onClose?: () => void };

type Row = { author: string; rating: number; text: string; date: string };

function fromBlock(c: any): { title: string; product_name: string; show_schema: boolean; reviews: Row[] } {
  return {
    title: typeof c?.title === 'string' && c.title ? c.title : 'What customers say',
    product_name: typeof c?.product_name === 'string' ? c.product_name : '',
    show_schema: c?.show_schema !== false,
    reviews: (Array.isArray(c?.reviews) ? c.reviews : []).map((r: any) => ({
      author: typeof r?.author === 'string' ? r.author : '',
      rating: Math.min(5, Math.max(1, Number(r?.rating) || 5)),
      text: typeof r?.text === 'string' ? r.text : '',
      date: typeof r?.date === 'string' ? r.date : '',
    })),
  };
}

export default function ReviewsEditor({ block, onSave, onClose }: Props) {
  const [local, setLocal] = React.useState(() => fromBlock(block.content));
  React.useEffect(() => {
    setLocal(fromBlock(block.content));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block._id]);

  function toContent(next: typeof local) {
    return {
      ...(block.content as any),
      title: next.title,
      product_name: next.product_name.trim(),
      show_schema: next.show_schema,
      reviews: next.reviews.filter((r) => r.author.trim() && r.text.trim()),
    };
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
  function updateRow(i: number, patch: Partial<Row>) {
    const rows = local.reviews.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
    apply({ reviews: rows });
  }

  if (block.type !== 'reviews') return null;

  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <Label>Section title</Label>
        <Input value={local.title} onChange={(e) => apply({ title: e.target.value })} />
      </div>

      <div className="grid gap-2 rounded-lg border border-border p-3">
        <Label>Google star snippet (schema.org)</Label>
        <p className="text-xs text-muted-foreground">
          Star snippets only work for reviews ABOUT A PRODUCT on its page — name the product to turn the markup on.
          Business-level reviews still display beautifully, but Google ignores their markup on your own site, so we
          don't emit it.
        </p>
        <Input
          value={local.product_name}
          onChange={(e) => apply({ product_name: e.target.value })}
          placeholder="Product these reviews are about (optional)"
        />
        <div className="flex items-center justify-between">
          <span className="text-sm">Emit schema when a product is named</span>
          <Switch checked={local.show_schema} onCheckedChange={(v) => apply({ show_schema: !!v })} />
        </div>
      </div>

      <div className="grid gap-3">
        <div className="flex items-center justify-between">
          <Label>Reviews — paste REAL customer reviews, word-for-word</Label>
          <button
            type="button"
            onClick={() => apply({ reviews: [...local.reviews, { author: '', rating: 5, text: '', date: '' }] })}
            className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
          >
            + Add review
          </button>
        </div>
        {local.reviews.map((r, i) => (
          <div key={i} className="grid gap-2 rounded-lg border border-border p-3">
            <div className="grid grid-cols-[1fr_5.5rem_8.5rem_auto] items-end gap-2">
              <div className="grid gap-1">
                <Label className="text-xs">Customer name</Label>
                <Input value={r.author} onChange={(e) => updateRow(i, { author: e.target.value })} placeholder="Jane D." />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Stars</Label>
                <select
                  value={r.rating}
                  onChange={(e) => updateRow(i, { rating: Number(e.target.value) })}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                >
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>{'★'.repeat(n)}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Date (optional)</Label>
                <Input type="date" value={r.date} onChange={(e) => updateRow(i, { date: e.target.value })} />
              </div>
              <button
                type="button"
                aria-label="Remove review"
                onClick={() => apply({ reviews: local.reviews.filter((_, idx) => idx !== i) })}
                className="h-9 rounded-md border border-border px-2 text-sm text-muted-foreground hover:text-red-500"
              >
                ✕
              </button>
            </div>
            <textarea
              value={r.text}
              onChange={(e) => updateRow(i, { text: e.target.value })}
              rows={2}
              placeholder="The review, exactly as the customer wrote it…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        ))}
      </div>

      <div className="mt-2 flex justify-end gap-2">
        <Button onClick={() => onSave?.({ ...block, content: toContent(local) } as any)}>Save</Button>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}
