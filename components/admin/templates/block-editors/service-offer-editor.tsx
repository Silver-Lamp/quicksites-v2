'use client';

import * as React from 'react';
import type { Block } from '@/types/blocks';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

type Props = { block: Block; onSave?: (b: Block) => void; onClose?: () => void; };

function usdToCents(v: string | number | null | undefined): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v * 100);
  if (typeof v === 'string') {
    const n = Number.parseFloat(v.replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) ? Math.round(n * 100) : null;
  }
  return null;
}

export default function ServiceOfferEditor({ block, onSave, onClose }: Props) {
  if (block.type !== 'service_offer') return null;

  const c: any = block.content ?? {};
  const [local, setLocal] = React.useState({
    title: c.title ?? 'Book a Service',
    description: c.description ?? '',
    productId: c.productId ?? '',
    showPrice: typeof c.showPrice === 'boolean' ? c.showPrice : true,
    priceUsd: typeof c.price_cents === 'number' ? (c.price_cents / 100).toFixed(2) : '',
    cta: c.cta ?? 'Book now',
    href: c.href ?? '',
  });

  React.useEffect(() => {
    const cc: any = block.content ?? {};
    setLocal({
      title: cc.title ?? 'Book a Service',
      description: cc.description ?? '',
      productId: cc.productId ?? '',
      showPrice: typeof cc.showPrice === 'boolean' ? cc.showPrice : true,
      priceUsd: typeof cc.price_cents === 'number' ? (cc.price_cents / 100).toFixed(2) : '',
      cta: cc.cta ?? 'Book now',
      href: cc.href ?? '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block._id]);

  function apply(partial: Partial<typeof local>) {
    const next = { ...local, ...partial };
    setLocal(next);
    const cents = next.showPrice && next.priceUsd !== '' ? usdToCents(next.priceUsd) : null;

    const patch = {
      op: 'update_block',
      blockId: block._id,
      content: {
        ...(block.content as any),
        title: next.title,
        description: next.description,
        productId: next.productId || undefined,
        showPrice: !!next.showPrice,
        ...(cents !== null && next.showPrice ? { price_cents: cents } : { price_cents: undefined }),
        cta: next.cta,
        href: next.href || undefined,
      },
    };
    window.dispatchEvent(new CustomEvent('qs:template:apply-patch', { detail: patch as any }));
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <Label>Title</Label>
        <Input value={local.title} onChange={(e) => apply({ title: e.target.value })} placeholder="Book a Service" />
      </div>

      <div className="grid gap-2">
        <Label>Description</Label>
        <textarea
          value={local.description}
          onChange={(e) => apply({ description: e.target.value })}
          placeholder="Short value prop for this service…"
          className="w-full min-h-[88px] rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="grid gap-2">
        <Label>Product / Service ID</Label>
        <div className="flex gap-2">
          <Input
            value={local.productId}
            onChange={(e) => apply({ productId: e.target.value })}
            placeholder="prod_123… (or your SKU/slug)"
          />
          <button
            type="button"
            onClick={() => {
              try {
                const last = localStorage.getItem('qs:ecom:lastProductId');
                if (last) apply({ productId: last });
              } catch {}
            }}
            className="h-9 rounded-md border px-3 text-sm"
          >
            Use last
          </button>
          <button
            type="button"
            onClick={() => {
              try { window.dispatchEvent(new CustomEvent('qs:ecom:open')); } catch {}
            }}
            className="h-9 rounded-md border px-3 text-sm"
          >
            Pick…
          </button>
        </div>
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <Label className="mr-3">Show price</Label>
          <Switch checked={local.showPrice} onCheckedChange={(v) => apply({ showPrice: !!v })} />
        </div>
        {local.showPrice && (
          <>
            <Label>Price (USD)</Label>
            <Input
              inputMode="decimal"
              placeholder="e.g. 59 or 59.99"
              value={local.priceUsd}
              onChange={(e) => apply({ priceUsd: e.target.value })}
            />
          </>
        )}
      </div>

      <div className="grid gap-2">
        <Label>CTA text</Label>
        <Input value={local.cta} onChange={(e) => apply({ cta: e.target.value })} placeholder="Book now" />
      </div>

      <div className="grid gap-2">
        <Label>Optional link override</Label>
        <Input
          value={local.href}
          onChange={(e) => apply({ href: e.target.value })}
          placeholder="/checkout?product_id=prod_123"
        />
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={() => onSave?.(block)}
          className="px-3 py-1.5 text-sm rounded-md bg-primary text-white hover:bg-primary/80"
        >
          Save
        </button>
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-sm rounded-md bg-muted text-muted-foreground hover:bg-muted/80"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
