'use client';

// components/merchant/VariantsEditor.tsx
//
// Authoring UI for single- or multi-axis product variants (Size × Color …).
// The merchant defines axes (name + comma-separated values); the editor generates
// the cartesian grid of offered combinations and takes a price per combination.
// It emits { variantOptions, variants } ready to POST/PATCH to /api/catalog/items,
// where the server normalizes it (lib/commerce/variants.ts). Reused by the create
// drawer and the edit drawer.
import * as React from 'react';

export type EditorAxis = { name: string; values: string[] };
export type EditorVariant = { label: string; priceCents: number; options: Record<string, string>; stock?: number | null; image?: string | null };
export type VariantsPayload = { variantOptions: EditorAxis[]; variants: EditorVariant[] };

type Props = {
  /** Default per-combo price (dollars) — usually the item's base price field. */
  defaultPriceDollars?: number;
  /** Seed for edit mode. */
  initialAxes?: EditorAxis[];
  initialVariants?: Array<{ price_cents: number; options?: Record<string, string> | null; stock?: number | null; image?: string | null }>;
  onChange: (payload: VariantsPayload) => void;
};

const MAX_AXES = 3;
const MAX_COMBOS = 60;
const SEP = '␟';

const parseValues = (text: string) => {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of text.split(',')) {
    const v = raw.trim();
    if (v && !seen.has(v)) { seen.add(v); out.push(v); }
  }
  return out;
};

// Cartesian product of the axes' value lists → array of {axisName: value} maps.
function combos(axes: EditorAxis[]): Array<Record<string, string>> {
  const live = axes.filter((a) => a.name.trim() && a.values.length);
  if (!live.length) return [];
  let acc: Array<Record<string, string>> = [{}];
  for (const axis of live) {
    const next: Array<Record<string, string>> = [];
    for (const partial of acc) {
      for (const val of axis.values) {
        next.push({ ...partial, [axis.name.trim()]: val });
        if (next.length > MAX_COMBOS) return next.slice(0, MAX_COMBOS);
      }
    }
    acc = next;
  }
  return acc;
}

const comboKey = (axes: EditorAxis[], opts: Record<string, string>) =>
  axes.filter((a) => a.name.trim()).map((a) => opts[a.name.trim()] ?? '').join(SEP);
const comboLabel = (axes: EditorAxis[], opts: Record<string, string>) =>
  axes.filter((a) => a.name.trim()).map((a) => opts[a.name.trim()]).filter(Boolean).join(' / ');

export default function VariantsEditor({ defaultPriceDollars = 0, initialAxes, initialVariants, onChange }: Props) {
  const [enabled, setEnabled] = React.useState<boolean>(!!(initialAxes && initialAxes.length));
  const [axes, setAxes] = React.useState<Array<{ name: string; valuesText: string }>>(
    initialAxes && initialAxes.length
      ? initialAxes.map((a) => ({ name: a.name, valuesText: a.values.join(', ') }))
      : [{ name: '', valuesText: '' }],
  );
  // Per-combo price (dollars), keyed by the combo signature.
  const [prices, setPrices] = React.useState<Record<string, number>>(() => {
    const seed: Record<string, number> = {};
    if (initialAxes && initialVariants) {
      for (const v of initialVariants) {
        if (v.options) seed[comboKey(initialAxes, v.options)] = (v.price_cents || 0) / 100;
      }
    }
    return seed;
  });
  // Per-combo stock (units); '' = untracked/unlimited.
  const [stocks, setStocks] = React.useState<Record<string, number | ''>>(() => {
    const seed: Record<string, number | ''> = {};
    if (initialAxes && initialVariants) {
      for (const v of initialVariants) {
        if (v.options) seed[comboKey(initialAxes, v.options)] = typeof v.stock === 'number' ? v.stock : '';
      }
    }
    return seed;
  });
  // Per-combo image URL (optional); '' = use the item's main image.
  const [images, setImages] = React.useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {};
    if (initialAxes && initialVariants) {
      for (const v of initialVariants) {
        if (v.options && v.image) seed[comboKey(initialAxes, v.options)] = v.image;
      }
    }
    return seed;
  });

  const parsedAxes: EditorAxis[] = React.useMemo(
    () => axes.map((a) => ({ name: a.name.trim(), values: parseValues(a.valuesText) })),
    [axes],
  );
  const grid = React.useMemo(() => (enabled ? combos(parsedAxes) : []), [enabled, parsedAxes]);

  // Emit the normalized payload whenever the grid or prices change.
  const emitSig = React.useRef('');
  React.useEffect(() => {
    const variants: EditorVariant[] = grid.map((opts) => {
      const key = comboKey(parsedAxes, opts);
      const dollars = prices[key] ?? defaultPriceDollars;
      const s = stocks[key];
      return {
        label: comboLabel(parsedAxes, opts),
        priceCents: Math.max(0, Math.round((Number(dollars) || 0) * 100)),
        options: opts,
        stock: s === '' || s === undefined ? null : Math.max(0, Math.floor(Number(s) || 0)),
        image: (images[key] ?? '').trim() || null,
      };
    });
    const payload: VariantsPayload = {
      variantOptions: enabled ? parsedAxes.filter((a) => a.name && a.values.length) : [],
      variants: enabled ? variants : [],
    };
    const sig = JSON.stringify(payload);
    if (sig !== emitSig.current) { emitSig.current = sig; onChange(payload); }
  }, [grid, prices, stocks, images, parsedAxes, enabled, defaultPriceDollars, onChange]);

  if (!enabled) {
    return (
      <div className="mt-2 rounded-lg bg-neutral-900/60 p-3 ring-1 ring-neutral-800">
        <button type="button" onClick={() => setEnabled(true)} className="text-xs text-purple-300 hover:underline">
          + Add options / variants (e.g. Size, Color)
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2 grid gap-3 rounded-lg bg-neutral-900/60 p-3 ring-1 ring-neutral-800">
      <div className="flex items-center justify-between">
        <span className="text-xs text-neutral-400">Options</span>
        <button type="button" onClick={() => { setEnabled(false); setAxes([{ name: '', valuesText: '' }]); }} className="text-xs text-neutral-500 hover:underline">
          Remove all options
        </button>
      </div>

      {axes.map((axis, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            value={axis.name}
            onChange={(e) => setAxes((a) => a.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))}
            placeholder="Axis (e.g. Size)"
            className="w-32 rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800"
          />
          <input
            value={axis.valuesText}
            onChange={(e) => setAxes((a) => a.map((x, k) => (k === i ? { ...x, valuesText: e.target.value } : x)))}
            placeholder="Values, comma-separated (S, M, L)"
            className="flex-1 rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800"
          />
          {axes.length > 1 && (
            <button type="button" onClick={() => setAxes((a) => a.filter((_, k) => k !== i))} className="rounded px-2 py-1 text-neutral-500 hover:bg-neutral-900" aria-label="Remove axis">✕</button>
          )}
        </div>
      ))}

      {axes.length < MAX_AXES && (
        <button type="button" onClick={() => setAxes((a) => [...a, { name: '', valuesText: '' }])} className="w-fit text-xs text-purple-300 hover:underline">
          + Add another axis
        </button>
      )}

      {grid.length > 0 && (
        <div className="mt-1 grid gap-1">
          <div className="text-[11px] text-neutral-500">{grid.length} combination{grid.length === 1 ? '' : 's'} — price each (defaults to base) and optional stock (blank = unlimited):</div>
          <div className="flex items-center gap-2 text-[11px] text-neutral-500">
            <span className="flex-1" />
            <span className="w-24 text-right">Price</span>
            <span className="w-20 text-right">Stock</span>
          </div>
          {grid.map((opts) => {
            const key = comboKey(parsedAxes, opts);
            return (
              <div key={key} className="grid gap-1">
                <div className="flex items-center gap-2">
                  <span className="flex-1 truncate text-sm">{comboLabel(parsedAxes, opts)}</span>
                  <input
                    type="number" step="0.01" min="0" placeholder="$"
                    value={prices[key] ?? defaultPriceDollars}
                    onChange={(e) => setPrices((p) => ({ ...p, [key]: Number(e.target.value) }))}
                    className="w-24 rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800"
                  />
                  <input
                    type="number" step="1" min="0" placeholder="∞"
                    value={stocks[key] ?? ''}
                    onChange={(e) => setStocks((s) => ({ ...s, [key]: e.target.value === '' ? '' : Math.max(0, Math.floor(Number(e.target.value))) }))}
                    className="w-20 rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800"
                  />
                </div>
                <input
                  type="url" placeholder="Image URL for this option (optional)"
                  value={images[key] ?? ''}
                  onChange={(e) => setImages((im) => ({ ...im, [key]: e.target.value }))}
                  className="rounded bg-neutral-900 px-3 py-2 text-xs ring-1 ring-neutral-800"
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
