// components/admin/templates/render-blocks/menu.tsx
'use client';

import * as React from 'react';

// Mobile-first restaurant menu: a sticky category chip-bar that jump-links to each
// section, then sections of items (name + price row, description, optional thumbnail
// + tags). Display-only until a menu item carries `catalog_item_id` — then it shows
// an "Add" button wired to the shared cart event (qs:cart:add), same as products_grid.

type MenuItem = {
  name: string;
  description?: string;
  price?: string;
  image_url?: string;
  tags?: string[];
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

function addToOrder(it: MenuItem) {
  if (!it.catalog_item_id) return;
  try {
    window.dispatchEvent(
      new CustomEvent('qs:cart:add', {
        detail: {
          id: it.catalog_item_id,
          qty: 1,
          price_cents: typeof it.price_cents === 'number' ? it.price_cents : 0,
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

export default function RenderMenu(props: any) {
  const content: any = props?.block?.content ?? props?.content ?? props ?? {};
  const title: string = content.title || 'Menu';
  const note: string = content.note || '';
  const sections: MenuSection[] = Array.isArray(content.sections) ? content.sections : [];

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
          className="sticky top-0 z-10 -mx-4 mt-6 overflow-x-auto border-b border-black/5 bg-white/70 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:border-white/10 dark:bg-zinc-950/70"
          aria-label="Menu sections"
        >
          <ul className="flex gap-2 whitespace-nowrap">
            {nonEmpty.map((s, i) => (
              <li key={slugId(s.name, i)}>
                <button
                  type="button"
                  onClick={() => jump(slugId(s.name, i))}
                  className="rounded-full border border-black/10 px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:border-black/30 hover:bg-black/5 dark:border-white/15 dark:text-zinc-200 dark:hover:bg-white/10"
                >
                  {s.name}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <div className="mt-8 space-y-12">
        {nonEmpty.map((section, si) => (
          <div key={slugId(section.name, si)} id={slugId(section.name, si)} className="scroll-mt-20">
            <div className="border-b border-black/10 pb-2 dark:border-white/10">
              <h3 className="text-xl font-semibold tracking-tight sm:text-2xl">{section.name}</h3>
              {section.description && (
                <p className="mt-1 text-sm text-muted-foreground">{section.description}</p>
              )}
            </div>

            <ul className="mt-4 divide-y divide-black/5 dark:divide-white/5">
              {(section.items ?? []).map((it, ii) => {
                const price = priceLabel(it);
                return (
                  <li key={`${slugId(section.name, si)}-${ii}`} className="flex gap-4 py-4">
                    {it.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={it.image_url}
                        alt={it.name}
                        loading="lazy"
                        className="h-16 w-16 shrink-0 rounded-lg object-cover sm:h-20 sm:w-20"
                      />
                    ) : null}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-medium">{it.name}</span>
                        {price && (
                          <span className="shrink-0 tabular-nums text-zinc-700 dark:text-zinc-300">{price}</span>
                        )}
                      </div>
                      {it.description && (
                        <p className="mt-1 text-sm text-muted-foreground">{it.description}</p>
                      )}
                      {Array.isArray(it.tags) && it.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {it.tags.map((t, ti) => (
                            <span
                              key={ti}
                              className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-zinc-600 dark:bg-white/10 dark:text-zinc-300"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                      {it.catalog_item_id && (
                        <button
                          type="button"
                          onClick={() => addToOrder(it)}
                          className="mt-3 inline-flex items-center rounded-md border border-black/15 px-3 py-1 text-sm font-medium transition hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
                        >
                          Add to order
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
