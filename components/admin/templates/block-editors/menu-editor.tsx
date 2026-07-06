// components/admin/templates/block-editors/menu-editor.tsx
'use client';

import * as React from 'react';
import type { Block } from '@/types/blocks';
import type { BlockEditorProps } from '@/components/admin/templates/block-editors';
import { parsePriceToCents, centsToDisplay } from '@/lib/commerce/menuPrice';
import { applyCatalogLinks } from '@/lib/commerce/menuCatalog';

type Item = { name: string; description?: string; price?: string; catalog_item_id?: string; price_cents?: number; tags?: string[] };
type Section = { name: string; description?: string; items: Item[] };

function cloneSections(raw: any): Section[] {
  const arr = Array.isArray(raw?.sections) ? raw.sections : [];
  return arr.map((s: any) => ({
    name: String(s?.name ?? ''),
    description: s?.description ?? '',
    items: Array.isArray(s?.items)
      ? s.items.map((it: any) => ({
          name: String(it?.name ?? ''),
          description: it?.description ?? '',
          price: it?.price ?? '',
          catalog_item_id: it?.catalog_item_id,
          price_cents: it?.price_cents,
          tags: Array.isArray(it?.tags) ? it.tags : [],
        }))
      : [],
  }));
}

function templateSlug(template: any): string {
  return String(template?.slug ?? template?.data?.meta?.siteTitle ?? '').trim();
}

/** Patch the merchant id onto the template meta + broadcast so the live menu picks it
 *  up immediately, then trigger an autosave. Mirrors product-manager-modal. */
function writeMerchantToTemplate(template: any, merchantId: string) {
  const prevData = template?.data ?? {};
  const prevMeta = prevData.meta ?? {};
  const prevEcom = prevMeta.ecom ?? prevMeta.ecommerce ?? {};
  const ecom = { ...prevEcom, merchant_id: merchantId };
  const nextData = { ...prevData, meta: { ...prevMeta, ecom } };
  try {
    window.dispatchEvent(new CustomEvent('qs:template:apply-patch', { detail: { data: nextData } }));
    (window as any).__QS_ECOM__ = { ...((window as any).__QS_ECOM__ ?? {}), merchantId };
    setTimeout(() => window.dispatchEvent(new Event('qs:toolbar:save-now')), 50);
  } catch {
    /* noop */
  }
}

export default function MenuEditor({ block, onSave, onClose, template }: BlockEditorProps) {
  const initial = (block as any)?.content ?? {};
  const [title, setTitle] = React.useState<string>(initial.title || 'Menu');
  const [note, setNote] = React.useState<string>(initial.note || '');
  const [sections, setSections] = React.useState<Section[]>(() => cloneSections(initial));

  const [confirming, setConfirming] = React.useState(false);
  const [publishing, setPublishing] = React.useState(false);
  const [result, setResult] = React.useState<{ count: number; merchantId: string } | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const buildContent = React.useCallback(
    (secs: Section[]) => ({ ...initial, title, note, sections: secs }),
    [initial, title, note],
  );

  const commit = (secs: Section[] = sections) => {
    const updated: Block = { ...(block as Block), type: 'menu', content: buildContent(secs) } as Block;
    onSave(updated);
  };

  // ---- editing helpers ----
  const setSection = (si: number, patch: Partial<Section>) =>
    setSections((prev) => prev.map((s, i) => (i === si ? { ...s, ...patch } : s)));
  const setItem = (si: number, ii: number, patch: Partial<Item>) =>
    setSections((prev) =>
      prev.map((s, i) =>
        i === si ? { ...s, items: s.items.map((it, j) => (j === ii ? { ...it, ...patch } : it)) } : s,
      ),
    );
  const addItem = (si: number) =>
    setSections((prev) => prev.map((s, i) => (i === si ? { ...s, items: [...s.items, { name: '', price: '' }] } : s)));
  const removeItem = (si: number, ii: number) =>
    setSections((prev) => prev.map((s, i) => (i === si ? { ...s, items: s.items.filter((_, j) => j !== ii) } : s)));
  const addSection = () => setSections((prev) => [...prev, { name: 'New Section', items: [{ name: '', price: '' }] }]);
  const removeSection = (si: number) => setSections((prev) => prev.filter((_, i) => i !== si));

  // ---- price confirmation model ----
  // Each item's confirmable cents, prefilled from its display price.
  const [confirmCents, setConfirmCents] = React.useState<Record<string, number | null>>({});
  const keyOf = (si: number, ii: number) => `${si}:${ii}`;

  const openConfirm = () => {
    const seed: Record<string, number | null> = {};
    sections.forEach((s, si) =>
      s.items.forEach((it, ii) => {
        seed[keyOf(si, ii)] = it.price_cents ?? parsePriceToCents(it.price);
      }),
    );
    setConfirmCents(seed);
    setError(null);
    setResult(null);
    setConfirming(true);
  };

  const pricedCount = React.useMemo(
    () => Object.values(confirmCents).filter((c) => typeof c === 'number' && c > 0).length,
    [confirmCents],
  );

  const publish = async () => {
    if (publishing) return;
    setPublishing(true);
    setError(null);
    try {
      const payloadSections = sections.map((s, si) => ({
        name: s.name,
        items: s.items.map((it, ii) => ({
          name: it.name,
          description: it.description ?? '',
          price_cents: confirmCents[keyOf(si, ii)] ?? null,
        })),
      }));

      const res = await fetch('/api/menu/publish-catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteSlug: templateSlug(template), sections: payloadSections }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        setError(json?.error || 'Could not enable ordering. Please try again.');
        setPublishing(false);
        return;
      }

      // Link catalog ids/prices back onto the menu, save the block, set the merchant.
      const linked = applyCatalogLinks(buildContent(sections), json.items);
      const nextSections = cloneSections(linked);
      setSections(nextSections);
      commit(nextSections);
      writeMerchantToTemplate(template, json.merchantId);

      setResult({ count: json.items.length, merchantId: json.merchantId });
      setConfirming(false);
    } catch (e: any) {
      setError(e?.message || 'Something went wrong.');
    } finally {
      setPublishing(false);
    }
  };

  const inputCls =
    'w-full rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-sm text-white outline-none focus:border-sky-500';

  return (
    <div className="space-y-5 text-white">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs text-zinc-400">Menu title</span>
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-xs text-zinc-400">Note (optional)</span>
          <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Prices subject to change" />
        </label>
      </div>

      {/* Sections + items */}
      <div className="space-y-5">
        {sections.map((section, si) => (
          <div key={si} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
            <div className="flex items-center gap-2">
              <input
                className={`${inputCls} font-semibold`}
                value={section.name}
                onChange={(e) => setSection(si, { name: e.target.value })}
                placeholder="Section (e.g. Breakfast)"
              />
              <button onClick={() => removeSection(si)} className="shrink-0 rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:text-red-300">
                Remove
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {section.items.map((it, ii) => (
                <div key={ii} className="grid grid-cols-[1fr,88px,auto] gap-2">
                  <input className={inputCls} value={it.name} onChange={(e) => setItem(si, ii, { name: e.target.value })} placeholder="Dish name" />
                  <input className={inputCls} value={it.price ?? ''} onChange={(e) => setItem(si, ii, { price: e.target.value })} placeholder="$12" />
                  <button onClick={() => removeItem(si, ii)} className="rounded-md border border-zinc-700 px-2 text-xs text-zinc-400 hover:text-red-300">
                    ✕
                  </button>
                  {it.catalog_item_id && (
                    <span className="col-span-3 -mt-1 text-[11px] text-emerald-400">✓ Orderable</span>
                  )}
                </div>
              ))}
              <button onClick={() => addItem(si)} className="text-xs text-sky-400 hover:text-sky-300">+ Add item</button>
            </div>
          </div>
        ))}
        <button onClick={addSection} className="text-sm text-sky-400 hover:text-sky-300">+ Add section</button>
      </div>

      {/* Enable ordering */}
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
        {!confirming && !result && (
          <>
            <div className="text-sm font-semibold text-emerald-300">Sell your menu online</div>
            <p className="mt-1 text-sm text-zinc-400">
              Turn these dishes into orderable products. You'll confirm each price first — nothing is charged from a
              guessed value.
            </p>
            <button onClick={openConfirm} className="mt-3 rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 hover:opacity-90">
              Enable online ordering →
            </button>
          </>
        )}

        {confirming && (
          <>
            <div className="text-sm font-semibold text-emerald-300">Confirm your prices</div>
            <p className="mt-1 text-xs text-zinc-400">
              Only items with a price are sold. Edit any price below — these are the exact amounts customers pay.
            </p>
            <div className="mt-3 max-h-64 space-y-1.5 overflow-y-auto pr-1">
              {sections.map((s, si) =>
                s.items.map((it, ii) => {
                  if (!it.name.trim()) return null;
                  const k = keyOf(si, ii);
                  const cents = confirmCents[k];
                  return (
                    <div key={k} className="flex items-center gap-2 text-sm">
                      <span className="flex-1 truncate text-zinc-300">
                        <span className="text-zinc-500">{s.name} · </span>{it.name}
                      </span>
                      <span className="text-zinc-500">$</span>
                      <input
                        className="w-20 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-right text-sm text-white outline-none focus:border-emerald-500"
                        value={cents != null ? (cents / 100).toString() : ''}
                        onChange={(e) => {
                          const v = e.target.value.trim();
                          setConfirmCents((prev) => ({ ...prev, [k]: v === '' ? null : parsePriceToCents(v) }));
                        }}
                        placeholder="—"
                      />
                    </div>
                  );
                }),
              )}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={publish}
                disabled={publishing || pricedCount === 0}
                className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 hover:opacity-90 disabled:opacity-50"
              >
                {publishing ? 'Enabling…' : `Create ${pricedCount} product${pricedCount === 1 ? '' : 's'} & enable ordering`}
              </button>
              <button onClick={() => setConfirming(false)} className="text-sm text-zinc-400 hover:text-white">
                Cancel
              </button>
            </div>
          </>
        )}

        {result && (
          <div className="text-sm">
            <div className="font-semibold text-emerald-300">✓ Ordering enabled — {result.count} item{result.count === 1 ? '' : 's'} are now sellable.</div>
            <p className="mt-1 text-zinc-400">
              The menu's "Add to order" buttons are live. To accept card payments, finish Stripe Connect in your
              Payments settings.
            </p>
          </div>
        )}

        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-3 border-t border-zinc-800 pt-4">
        <button onClick={() => commit()} className="rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-sky-400">
          Save menu
        </button>
        <button onClick={onClose} className="text-sm text-zinc-400 hover:text-white">Close</button>
      </div>
    </div>
  );
}
