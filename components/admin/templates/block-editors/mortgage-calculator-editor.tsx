'use client';

// components/admin/templates/block-editors/mortgage-calculator-editor.tsx
//
// Editor for the mortgage/affordability calculator. The agent sets the DEFAULTS a
// visitor lands on (this listing's price, a current rate, typical down payment) plus
// the optional carrying costs (tax rate, insurance, HOA) that flesh out the monthly
// breakdown. Numbers are plain numbers; the renderer does the amortization math.

import * as React from 'react';
import type { Block } from '@/types/blocks';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type Props = { block: Block; onSave?: (b: Block) => void; onClose?: () => void };

const numOf = (v: any, fallback = 0): number => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : fallback;
};
const str = (v: any) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');

function fromBlock(c: any) {
  return {
    title: str(c?.title) || 'Estimate your monthly payment',
    subtitle: str(c?.subtitle),
    price: str(c?.price) || '$500,000',
    down_payment_percent: numOf(c?.down_payment_percent, 20),
    interest_rate: numOf(c?.interest_rate, 6.8),
    loan_term_years: numOf(c?.loan_term_years, 30) || 30,
    property_tax_rate: numOf(c?.property_tax_rate, 0),
    home_insurance_monthly: numOf(c?.home_insurance_monthly, 0),
    hoa_monthly: numOf(c?.hoa_monthly, 0),
    cta_text: str(c?.cta_text),
    cta_link: str(c?.cta_link) || '#contact',
    disclaimer: str(c?.disclaimer),
  };
}

export default function MortgageCalculatorEditor({ block, onSave, onClose }: Props) {
  const [local, setLocal] = React.useState(() => fromBlock(block.content));

  React.useEffect(() => {
    setLocal(fromBlock(block.content));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block._id]);

  function toContent(next: typeof local) {
    return {
      ...(block.content as any),
      title: next.title.trim(),
      subtitle: next.subtitle.trim(),
      price: next.price.trim(),
      down_payment_percent: next.down_payment_percent,
      interest_rate: next.interest_rate,
      loan_term_years: next.loan_term_years,
      property_tax_rate: next.property_tax_rate,
      home_insurance_monthly: next.home_insurance_monthly,
      hoa_monthly: next.hoa_monthly,
      cta_text: next.cta_text.trim(),
      cta_link: next.cta_link.trim(),
      disclaimer: next.disclaimer.trim(),
    };
  }

  function apply(partial: Partial<typeof local>) {
    const next = { ...local, ...partial };
    setLocal(next);
    const patch = { op: 'update_block', blockId: block._id, content: toContent(next) };
    window.dispatchEvent(new CustomEvent('qs:template:apply-patch', { detail: patch as any }));
  }

  // Defensive type guard runs AFTER all hooks (rules-of-hooks).
  if (block.type !== 'mortgage_calculator') return null;

  const NumField = ({
    label,
    keyName,
    step = '1',
    placeholder,
  }: {
    label: string;
    keyName: keyof typeof local;
    step?: string;
    placeholder?: string;
  }) => (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Input
        type="number"
        step={step}
        value={String(local[keyName] as number)}
        onChange={(e) => apply({ [keyName]: numOf(e.target.value, 0) } as any)}
        placeholder={placeholder}
      />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <Label>Title</Label>
        <Input value={local.title} onChange={(e) => apply({ title: e.target.value })} />
      </div>
      <div className="grid gap-2">
        <Label>Subtitle</Label>
        <Input
          value={local.subtitle}
          onChange={(e) => apply({ subtitle: e.target.value })}
          placeholder="Play with the numbers — see what this home could cost per month."
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label>Default home price</Label>
          <Input
            value={local.price}
            onChange={(e) => apply({ price: e.target.value })}
            placeholder="$524,900"
          />
        </div>
        <NumField label="Down payment (%)" keyName="down_payment_percent" placeholder="20" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <NumField label="Interest rate (%)" keyName="interest_rate" step="0.05" placeholder="6.8" />
        <NumField label="Loan term (years)" keyName="loan_term_years" placeholder="30" />
      </div>

      <div className="grid gap-2 rounded-lg border border-border p-3">
        <p className="text-xs text-muted-foreground">
          Optional carrying costs — leave at 0 to show principal &amp; interest only.
        </p>
        <div className="grid grid-cols-3 gap-3">
          <NumField label="Property tax (%/yr)" keyName="property_tax_rate" step="0.05" placeholder="1.1" />
          <NumField label="Insurance ($/mo)" keyName="home_insurance_monthly" placeholder="120" />
          <NumField label="HOA ($/mo)" keyName="hoa_monthly" placeholder="0" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label>CTA text</Label>
          <Input
            value={local.cta_text}
            onChange={(e) => apply({ cta_text: e.target.value })}
            placeholder="Get pre-approved"
          />
        </div>
        <div className="grid gap-2">
          <Label>CTA link</Label>
          <Input value={local.cta_link} onChange={(e) => apply({ cta_link: e.target.value })} placeholder="#contact" />
        </div>
      </div>

      <div className="grid gap-2">
        <Label>Disclaimer</Label>
        <textarea
          value={local.disclaimer}
          onChange={(e) => apply({ disclaimer: e.target.value })}
          rows={2}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder="Estimate only — not a loan offer…"
        />
      </div>

      <div className="mt-2 flex justify-end gap-2">
        <Button onClick={() => onSave?.({ ...block, content: toContent(local) } as any)}>Save</Button>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
