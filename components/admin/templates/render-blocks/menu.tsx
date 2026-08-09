// components/admin/templates/render-blocks/menu.tsx
'use client';

import * as React from 'react';
import {
  assessFreshness,
  freshnessNote,
  priceOrConfirm,
  type MenuFreshness,
} from '@/lib/menu/menuFreshness';

// Mobile-first restaurant menu: a sticky category chip-bar that jump-links to each
// section, then sections of items (name + price row, description, optional thumbnail
// + tags). Display-only until a menu item carries `catalog_item_id` — then it shows
// an "Add" button wired to the shared cart event (qs:cart:add), same as products_grid.

type MenuOption = { label: string; price?: string; price_cents?: number; variant_id?: string };
type MenuAddon = { id?: string; label: string; price_cents?: number };
type MenuItem = {
  name: string;
  description?: string;
  price?: string;
  image_url?: string;
  tags?: string[];
  options?: MenuOption[];
  addons?: MenuAddon[];
  catalog_item_id?: string;
  price_cents?: number;
};
type MenuSection = { name: string; description?: string; items?: MenuItem[] };

function slugId(s: string, i: number) {
  const base = (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return `menu-${base || 'section'}-${i}`;
}

function readMerchantId(): string | null {
  try {
    const w = window as any;
    if (w.__QS_ECOM__?.merchantId) return String(w.__QS_ECOM__.merchantId);
    const tpl = w.__QS_TPL_REF__?.current ?? w.__QS_TEMPLATE__ ?? null;
    const metaE = tpl?.data?.meta?.ecom ?? tpl?.data?.meta?.ecommerce ?? {};
    const id = metaE?.merchant_id ?? tpl?.data?.ecommerce?.merchant_id ?? '';
    return id ? String(id) : null;
  } catch {
    return null;
  }
}

function priceLabel(it: MenuItem): string {
  if (it.price && it.price.trim()) return it.price.trim();
  if (typeof it.price_cents === 'number') return `$${(it.price_cents / 100).toFixed(2)}`;
  return '';
}

/** Options that are actually orderable (published → have a variant id). */
function orderableOptions(it: MenuItem): MenuOption[] {
  return (Array.isArray(it.options) ? it.options : []).filter((o) => o?.label && o?.variant_id);
}
/** Add-ons that are orderable (published → have an id). */
function orderableAddons(it: MenuItem): MenuAddon[] {
  return (Array.isArray(it.addons) ? it.addons : []).filter((a) => a?.label && a?.id);
}

function addToOrder(it: MenuItem, option?: MenuOption, addons: MenuAddon[] = []) {
  if (!it.catalog_item_id) return;
  const base = option
    ? (typeof option.price_cents === 'number' ? option.price_cents : 0)
    : (typeof it.price_cents === 'number' ? it.price_cents : 0);
  const addonTotal = addons.reduce((s, a) => s + (typeof a.price_cents === 'number' ? a.price_cents : 0), 0);
  try {
    window.dispatchEvent(
      new CustomEvent('qs:cart:add', {
        detail: {
          id: it.catalog_item_id,
          variant_id: option?.variant_id ?? null,
          variant_label: option?.label ?? null,
          addon_ids: addons.map((a) => a.id),
          addons: addons.map((a) => ({ id: a.id, label: a.label, price_cents: a.price_cents ?? 0 })),
          qty: 1,
          price_cents: base + addonTotal,
          title: it.name,
          image_url: it.image_url ?? null,
          product_type: 'meal',
          merchantId: readMerchantId(),
        },
      }),
    );
  } catch {
    /* noop */
  }
}

/** One menu item row — holds its own selected-option state for "choose one" items. */
function MenuItemRow({
  item,
  rowKey,
  freshness,
}: {
  item: MenuItem;
  rowKey: string;
  freshness: MenuFreshness;
}) {
  const options = orderableOptions(item);
  const hasOptions = options.length > 0;
  const addons = orderableAddons(item);
  const [sel, setSel] = React.useState(0);
  const [selAddonIds, setSelAddonIds] = React.useState<string[]>([]);
  const selected = hasOptions ? options[Math.min(sel, options.length - 1)] : undefined;
  const chosenAddons = addons.filter((a) => a.id && selAddonIds.includes(a.id));
  const addonTotal = chosenAddons.reduce((s, a) => s + (a.price_cents ?? 0), 0);

  const baseCents = selected
    ? (typeof selected.price_cents === 'number' ? selected.price_cents : undefined)
    : (typeof item.price_cents === 'number' ? item.price_cents : undefined);
  // ⚠️ A PRICE WE CANNOT DATE IS NOT A FACT ABOUT THIS BUSINESS. These menus are read by a model
  // from a diner's photo of unknown age; the restaurant never asked us to quote a number on their
  // behalf. `priceOrConfirm` replaces an undatable price with "call to confirm" — the rule is DROP
  // THE PRICE, NEVER THE DISH, so the menu still does its job.
  //
  // An ORDERABLE item (one with `price_cents`, meaning an owner published it to the catalog and
  // the checkout will charge exactly that) keeps its number: that price is server-authoritative
  // and owner-confirmed, not something we inferred from a photograph.
  const price =
    typeof baseCents === 'number'
      ? centsDisplay(baseCents + addonTotal)
      : priceOrConfirm(priceLabel(item), freshness);

  const toggleAddon = (id: string) =>
    setSelAddonIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <li className="flex gap-4 py-4">
      {item.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.image_url} alt={item.name} loading="lazy" className="h-16 w-16 shrink-0 rounded-lg object-cover sm:h-20 sm:w-20" />
      ) : null}

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-medium">{item.name}</span>
          {price && <span className="shrink-0 tabular-nums text-muted-foreground">{price}</span>}
        </div>
        {item.description && <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>}

        {Array.isArray(item.tags) && item.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {item.tags.map((t, ti) => (
              <span key={ti} className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t}</span>
            ))}
          </div>
        )}

        {/* Choose-one option selector */}
        {hasOptions && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {options.map((o, oi) => (
              <button
                key={oi}
                type="button"
                onClick={() => setSel(oi)}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                  oi === sel
                    ? 'border-transparent bg-primary text-primary-foreground'
                    : 'border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                {o.label}{typeof o.price_cents === 'number' ? ` · ${centsDisplay(o.price_cents)}` : ''}
              </button>
            ))}
          </div>
        )}

        {/* Add-on multi-select */}
        {addons.length > 0 && item.catalog_item_id && (
          <div className="mt-2 flex flex-col gap-1.5">
            {addons.map((a) => (
              <label key={a.id} className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={!!a.id && selAddonIds.includes(a.id)}
                  onChange={() => a.id && toggleAddon(a.id)}
                  className="h-4 w-4"
                  style={{ accentColor: 'hsl(var(--primary))' }}
                />
                <span>{a.label}</span>
                {typeof a.price_cents === 'number' && a.price_cents > 0 && (
                  <span className="text-muted-foreground">+{centsDisplay(a.price_cents)}</span>
                )}
              </label>
            ))}
          </div>
        )}

        {item.catalog_item_id && (hasOptions ? selected != null : true) && (
          <button
            type="button"
            onClick={() => addToOrder(item, selected, chosenAddons)}
            className="mt-3 inline-flex items-center rounded-md border border-border px-3 py-1 text-sm font-medium transition hover:bg-muted"
          >
            Add to order{addonTotal > 0 ? ` · ${centsDisplay((baseCents ?? 0) + addonTotal)}` : ''}
          </button>
        )}
      </div>
    </li>
  );
}

function centsDisplay(cents: number | undefined): string {
  if (typeof cents !== 'number') return '';
  return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;
}

export default function RenderMenu(props: any) {
  const content: any = props?.block?.content ?? props?.content ?? props ?? {};
  const title: string = content.title || 'Menu';
  const note: string = content.note || '';
  const sections: MenuSection[] = Array.isArray(content.sections) ? content.sections : [];

  // ⚠️ THE RULE EXISTED AND HAD EXACTLY ONE CALLER — the city SEARCH index — so prices aged out
  // in search results while the restaurant's OWN page quoted them as fact forever. That is
  // backwards: the page presents as the business's site, so an unverifiable number is a stronger
  // claim there than in a list of results. Wired here 2026-08-09 after an import batch added 14
  // more undated menus.
  const freshness = assessFreshness(content);
  const staleNote = freshnessNote(freshness);

  const nonEmpty = sections.filter((s) => s && s.name && Array.isArray(s.items) && s.items.length > 0);
  if (nonEmpty.length === 0) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-10 text-center text-sm text-muted-foreground">
        Add sections and dishes to build your menu.
      </section>
    );
  }

  const jump = (id: string) => {
    const el = typeof document !== 'undefined' ? document.getElementById(id) : null;
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-14">
      <div className="text-center">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
        {note && <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">{note}</p>}
      </div>

      {/* Sticky category chip-bar — jump to a section (great on mobile). */}
      {nonEmpty.length > 1 && (
        <nav
          className="sticky top-0 z-10 -mx-4 mt-6 overflow-x-auto border-b border-border bg-background/80 px-4 py-3 backdrop-blur"
          aria-label="Menu sections"
        >
          <ul className="flex gap-2 whitespace-nowrap">
            {nonEmpty.map((s, i) => (
              <li key={slugId(s.name, i)}>
                <button
                  type="button"
                  onClick={() => jump(slugId(s.name, i))}
                  className="rounded-full border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-muted"
                >
                  {s.name}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {/* ⚠️ Said ONCE, at the top, not stamped on every row. Repeating "call to confirm" beside
          forty dishes reads as a broken page rather than an honest one, and a visitor stops seeing
          it by the third line. */}
      {staleNote && (
        <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-center text-sm text-foreground">
          {staleNote}
        </p>
      )}

      <div className="mt-8 space-y-12">
        {nonEmpty.map((section, si) => (
          <div key={slugId(section.name, si)} id={slugId(section.name, si)} className="scroll-mt-20">
            <div className="border-b border-border pb-2">
              <h3 className="text-xl font-semibold tracking-tight sm:text-2xl">{section.name}</h3>
              {section.description && (
                <p className="mt-1 text-sm text-muted-foreground">{section.description}</p>
              )}
            </div>

            <ul className="mt-4 divide-y divide-border">
              {(section.items ?? []).map((it, ii) => (
                <MenuItemRow key={`${slugId(section.name, si)}-${ii}`} item={it} rowKey={`${slugId(section.name, si)}-${ii}`} freshness={freshness} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
