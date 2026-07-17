'use client';

// Editor for the deck_estimate block (DeckSketch seam). The owner sets the copy,
// the default material tier, whether to show refiners, and — the load-bearing field —
// the recipient email that homeowner leads are delivered to. recipient_email is read
// SERVER-SIDE at submit (never client-trusted), so this is where the builder points it.

import * as React from 'react';
import type { Block } from '@/types/blocks';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { ALL_TRADES, TRADE_REGISTRY, isTradeKey, type TradeKey } from '@/lib/commerce/quoteEstimator';

type Props = { block: Block; onSave?: (b: Block) => void; onClose?: () => void };
type Tier = 'pressure_treated' | 'cedar' | 'composite';
const TIERS: { value: Tier; label: string }[] = [
  { value: 'pressure_treated', label: 'Pressure-treated' },
  { value: 'cedar', label: 'Cedar' },
  { value: 'composite', label: 'Composite' },
];
const TRADE_OPTIONS = ALL_TRADES.map((k) => ({ value: k, label: TRADE_REGISTRY[k].label }));

export default function DeckEstimateEditor({ block, onSave, onClose }: Props) {
  const c: any = block.content ?? {};
  const init = React.useCallback((cc: any) => ({
    trade: (isTradeKey(cc.trade) ? cc.trade : 'deck') as TradeKey,
    title: typeof cc.title === 'string' ? cc.title : 'Instant deck estimate',
    subtitle: typeof cc.subtitle === 'string' ? cc.subtitle : '',
    default_material_tier: (TIERS.some((t) => t.value === cc.default_material_tier) ? cc.default_material_tier : 'pressure_treated') as Tier,
    show_refiners: cc.show_refiners !== false,
    cta_text: typeof cc.cta_text === 'string' ? cc.cta_text : 'Get this quote from us',
    recipient_email: typeof cc.recipient_email === 'string' ? cc.recipient_email : '',
  }), []);
  const [local, setLocal] = React.useState(() => init(c));
  React.useEffect(() => { setLocal(init(block.content ?? {})); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [block._id]);

  function toContent(n: typeof local) {
    return {
      ...(block.content as any),
      trade: n.trade,
      title: n.title.trim(),
      subtitle: n.subtitle.trim(),
      default_material_tier: n.default_material_tier,
      show_refiners: n.show_refiners,
      cta_text: n.cta_text.trim(),
      recipient_email: n.recipient_email.trim(),
    };
  }
  function apply(partial: Partial<typeof local>) {
    const n = { ...local, ...partial };
    setLocal(n);
    window.dispatchEvent(new CustomEvent('qs:template:apply-patch', { detail: { op: 'update_block', blockId: block._id, content: toContent(n) } as any }));
  }

  if (block.type !== 'deck_estimate') return null;
  const emailOk = !local.recipient_email || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(local.recipient_email.trim());

  const isDeck = local.trade === 'deck';
  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <Label>Trade</Label>
        <select value={local.trade} onChange={(e) => apply({ trade: e.target.value as TradeKey })}
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary">
          {TRADE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <p className="text-xs text-muted-foreground">Which trade this estimates. Each site’s inputs adapt automatically.</p>
      </div>

      <div className="grid gap-2">
        <Label>Heading</Label>
        <Input value={local.title} onChange={(e) => apply({ title: e.target.value })} />
      </div>
      <div className="grid gap-2">
        <Label>Subtitle</Label>
        <Input value={local.subtitle} onChange={(e) => apply({ subtitle: e.target.value })} placeholder="Enter a few dimensions for a ballpark…" />
      </div>

      {/* Deck-only knobs — the other trades' inputs come from their own field defs. */}
      {isDeck && (
        <>
          <div className="grid gap-2">
            <Label>Default material</Label>
            <div className="flex flex-wrap gap-2">
              {TIERS.map((t) => (
                <button key={t.value} type="button" onClick={() => apply({ default_material_tier: t.value })}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${local.default_material_tier === t.value ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-accent'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Show refiners (stairs, railing)</Label>
              <p className="text-xs text-muted-foreground">Extra inputs that tighten the range.</p>
            </div>
            <Switch checked={local.show_refiners} onCheckedChange={(v) => apply({ show_refiners: !!v })} />
          </div>
        </>
      )}

      <div className="grid gap-2">
        <Label>Lead button text</Label>
        <Input value={local.cta_text} onChange={(e) => apply({ cta_text: e.target.value })} />
      </div>

      <div className="grid gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
        <Label>Send leads to (your email)</Label>
        <Input value={local.recipient_email} onChange={(e) => apply({ recipient_email: e.target.value })} placeholder="you@yourdeckco.com" />
        {!emailOk && <p className="text-xs text-red-500">That doesn’t look like a valid email.</p>}
        <p className="text-xs text-muted-foreground">
          Homeowner name/email/phone is delivered here. Without it, the estimate still works but leads aren’t sent to you.
        </p>
      </div>

      <div className="mt-2 flex justify-end gap-2">
        <Button disabled={!emailOk} onClick={() => onSave?.({ ...block, content: toContent(local) } as any)}>Save</Button>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}
