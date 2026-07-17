'use client';

// Editor for the sticky add-to-cart bar: pick the product it sells (same
// store-treatment as products_grid/service_offer — resolve the site's store via
// /api/commerce/site-merchant, one-click setup when none), CTA text, visibility.

import * as React from 'react';
import type { Block } from '@/types/blocks';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';

type Props = { block: Block; onSave?: (b: Block) => void; onClose?: () => void };

type ItemLite = { id: string; title: string; price_cents: number };

function getTpl(): any {
  return (window as any).__QS_TPL_REF__?.current ?? (window as any).__QS_TEMPLATE__ ?? null;
}

function fromBlock(c: any) {
  return {
    productId: typeof c?.productId === 'string' ? c.productId : '',
    cta_text: typeof c?.cta_text === 'string' && c.cta_text ? c.cta_text : 'Add to cart',
    show_on_desktop: c?.show_on_desktop === true,
    enabled: c?.enabled !== false,
  };
}

export default function StickyCartEditor({ block, onSave, onClose }: Props) {
  const [local, setLocal] = React.useState(() => fromBlock(block.content));
  const [merchantId, setMerchantId] = React.useState('');
  const [items, setItems] = React.useState<ItemLite[]>([]);
  const [settingUp, setSettingUp] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const templateId: string = String(getTpl()?.id ?? '');

  React.useEffect(() => {
    setLocal(fromBlock(block.content));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block._id]);

  const loadStore = React.useCallback(async () => {
    if (!templateId) return;
    try {
      const res = await fetch(`/api/commerce/site-merchant?templateId=${encodeURIComponent(templateId)}`, { cache: 'no-store' });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j?.ok) {
        setMerchantId(j.merchantId || '');
        setItems(Array.isArray(j.products) ? j.products : []);
      }
    } catch { /* quiet */ }
  }, [templateId]);
  React.useEffect(() => { void loadStore(); }, [loadStore]);

  const setupStore = async () => {
    if (!templateId || settingUp) return;
    setSettingUp(true); setMsg(null);
    try {
      const res = await fetch('/api/commerce/site-merchant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.merchantId) throw new Error(j?.error || 'Could not set up the store.');
      setMerchantId(j.merchantId);
      setItems(Array.isArray(j.products) ? j.products : []);
      setMsg('Store created ✓ — add items in the Catalog, then pick one here.');
    } catch (e: any) {
      setMsg(e?.message || 'Could not set up the store.');
    } finally { setSettingUp(false); }
  };

  function toContent(next: typeof local) {
    const picked = items.find((i) => i.id === next.productId);
    return {
      ...(block.content as any),
      ...next,
      // Fallback label/price so the bar shows something before the live fetch lands.
      ...(picked ? { label: picked.title, price_cents: picked.price_cents } : {}),
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

  if (block.type !== 'sticky_cart') return null;

  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <Label>Product this bar sells</Label>
        {msg && <p className="text-xs text-emerald-500">{msg}</p>}
        {!merchantId && templateId ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
            <p className="text-xs text-muted-foreground">No store on this site yet — one click creates it.</p>
            <button
              type="button"
              onClick={setupStore}
              disabled={settingUp}
              className="mt-2 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {settingUp ? 'Setting up…' : '🏪 Set up my store'}
            </button>
          </div>
        ) : (
          <>
            <select
              value={local.productId}
              onChange={(e) => apply({ productId: e.target.value })}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Pick a product…</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.title} — ${(i.price_cents / 100).toFixed(2)}
                </option>
              ))}
            </select>
            {merchantId && (
              <a
                href={`/merchant/catalog?merchant=${encodeURIComponent(merchantId)}`}
                target="_blank"
                rel="noreferrer"
                className="w-fit text-xs text-sky-500 underline underline-offset-2 hover:text-sky-400"
              >
                Open Catalog ↗
              </a>
            )}
          </>
        )}
      </div>
      <div className="grid gap-2">
        <Label>Button text</Label>
        <Input value={local.cta_text} onChange={(e) => apply({ cta_text: e.target.value })} />
      </div>
      <div className="flex items-center justify-between">
        <Label>Also show on desktop</Label>
        <Switch checked={local.show_on_desktop} onCheckedChange={(v) => apply({ show_on_desktop: !!v })} />
      </div>
      <div className="flex items-center justify-between">
        <Label>Enabled</Label>
        <Switch checked={local.enabled} onCheckedChange={(v) => apply({ enabled: !!v })} />
      </div>
      <div className="mt-2 flex justify-end gap-2">
        <Button onClick={() => onSave?.({ ...block, content: toContent(local) } as any)}>Save</Button>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}
