// lib/commerce/variants.ts
//
// Normalize client-authored variants into the metadata shape the storefront +
// checkout read. Shared by the create (POST) and edit (PATCH) catalog routes so
// both write identical, well-formed data. Pure + testable.
//
// A product may be:
//   • plain          — no variants; a single price_cents.
//   • single-axis    — one axis (e.g. Size: S/M/L); each value is a SKU.
//   • multi-axis      — Size × Color …; each offered combination is a SKU.
// Either way the stored `variants` is a FLAT list of SKUs (each an id + price),
// so pricing/checkout never needs to know about axes; `variant_options` just lets
// the storefront render one selector per axis.

export type InputAxis = { name?: string; values?: unknown };
export type InputVariant = { label?: string; priceCents?: number; status?: string; options?: Record<string, unknown> | null };

export type NormalizedVariant = {
  id: string;
  label: string;
  price_cents: number;
  status: 'active' | 'inactive';
  options?: Record<string, string>;
};
export type NormalizedAxis = { name: string; values: string[] };

export type NormalizedVariants = {
  variant_options: NormalizedAxis[];
  variants: NormalizedVariant[];
  basePriceCents: number; // cheapest SKU, or the fallback base for a plain item
};

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);

const centsOf = (v: unknown) => Math.max(0, Math.round(Number(v) || 0));

/** Clean the axes: trimmed non-empty names, trimmed unique non-empty values. */
function normalizeAxes(axes: InputAxis[]): NormalizedAxis[] {
  const out: NormalizedAxis[] = [];
  for (const a of axes ?? []) {
    const name = String(a?.name ?? '').trim();
    if (!name) continue;
    const values: string[] = [];
    const seen = new Set<string>();
    for (const raw of Array.isArray(a?.values) ? a!.values! : []) {
      const val = String(raw).trim();
      if (val && !seen.has(val)) { seen.add(val); values.push(val); }
    }
    if (values.length) out.push({ name, values });
  }
  return out;
}

/**
 * Normalize a product's variant authoring into stored metadata.
 * @param fallbackBaseCents used as base price only when there are no variants.
 */
export function normalizeVariants(input: {
  variantOptions?: InputAxis[];
  variants?: InputVariant[];
  fallbackBaseCents?: number;
}): NormalizedVariants {
  const axes = normalizeAxes(input.variantOptions ?? []);
  const axisNames = axes.map((a) => a.name);

  const seenIds = new Set<string>();
  const variants: NormalizedVariant[] = [];

  for (const v of input.variants ?? []) {
    // Keep only option keys that correspond to a real axis; coerce to strings.
    let options: Record<string, string> | undefined;
    if (v?.options && axisNames.length) {
      options = {};
      for (const name of axisNames) {
        const val = v.options[name];
        if (val != null && String(val).trim()) options[name] = String(val).trim();
      }
      if (!Object.keys(options).length) options = undefined;
    }

    // Label: explicit → else joined option values (axis order) → else fallback.
    const optLabel = options ? axisNames.map((n) => options![n]).filter(Boolean).join(' / ') : '';
    const label = String(v?.label ?? '').trim() || optLabel;
    if (!label) continue; // a variant with no label and no options is meaningless

    // Stable id from the option combo (axis order) else the label; deduped.
    const idBase = (options ? axisNames.map((n) => options![n]).filter(Boolean).map(slug).join('-') : '') || slug(label) || 'opt';
    let id = idBase;
    for (let i = 2; seenIds.has(id); i++) id = `${idBase}-${i}`;
    seenIds.add(id);

    variants.push({
      id,
      label,
      price_cents: centsOf(v?.priceCents),
      status: v?.status === 'inactive' ? 'inactive' : 'active',
      ...(options ? { options } : {}),
    });
  }

  const basePriceCents = variants.length
    ? Math.min(...variants.map((v) => v.price_cents))
    : centsOf(input.fallbackBaseCents);

  return { variant_options: axes, variants, basePriceCents };
}
