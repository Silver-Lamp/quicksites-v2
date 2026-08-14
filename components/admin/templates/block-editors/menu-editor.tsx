// components/admin/templates/block-editors/menu-editor.tsx
'use client';

import * as React from 'react';
import type { Block } from '@/types/blocks';
import type { BlockEditorProps } from '@/components/admin/templates/block-editors';
import { parsePriceToCents, centsToDisplay } from '@/lib/commerce/menuPrice';
import { applyCatalogLinks } from '@/lib/commerce/menuCatalog';
import ImageUploadField from '@/components/merchant/ImageUploadField';

// Owner-asserted tags (badges on the rendered menu). Kept short + fixed so dietary
// claims are the owner's assertion, never an AI guess.
const PRESET_TAGS = ['Popular', 'New', 'Vegetarian', 'Vegan', 'GF', 'Spicy'];

type Option = { label: string; price?: string; price_cents?: number; variant_id?: string };
type Addon = { id?: string; label: string; price?: string; price_cents?: number };
type Item = { name: string; description?: string; price?: string; image_url?: string; options?: Option[]; addons?: Addon[]; catalog_item_id?: string; price_cents?: number; tags?: string[] };
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
          image_url: it?.image_url ?? '',
          options: Array.isArray(it?.options)
            ? it.options.map((o: any) => ({
                label: String(o?.label ?? ''),
                price: o?.price ?? '',
                price_cents: o?.price_cents,
                variant_id: o?.variant_id,
              }))
            : [],
          addons: Array.isArray(it?.addons)
            ? it.addons.map((a: any) => ({ id: a?.id, label: String(a?.label ?? ''), price: a?.price ?? '', price_cents: a?.price_cents }))
            : [],
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
  /**
   * ⚠️ READ `content` OR `props`. A MENU LIVES IN BOTH, DEPENDING ON WHAT LAST TOUCHED IT.
   *
   * Reported from real use: an owner opened the menu editor on a stand whose page was visibly
   * showing three priced drinks, and got an empty editor — default title, no sections, and a
   * "Create 0 products & enable ordering" button. The items were never lost. They were under
   * `props`, because the block had passed through the Zod block schema (admin/lib/zod/
   * blockSchema.ts), which emits the schema shape and defaults `currency: 'USD'` — the
   * fingerprint that identified it. The RENDERER reads both, so the page looked perfect while
   * the editor showed nothing.
   *
   * 172 of 173 imported restaurant menus carry `content`; exactly one carried `props`. That
   * ratio is why this reads as "impossible" until it happens to you, and why tolerance beats
   * picking a winner: whichever key holds the data, the owner must be able to edit their menu.
   */
  const initial = ((block as any)?.content && Object.keys((block as any).content).length
    ? (block as any).content
    : (block as any)?.props) ?? {};
  const [title, setTitle] = React.useState<string>(initial.title || 'Menu');
  const [note, setNote] = React.useState<string>(initial.note || '');
  const [sections, setSections] = React.useState<Section[]>(() => cloneSections(initial));

  const [confirming, setConfirming] = React.useState(false);
  const [publishing, setPublishing] = React.useState(false);
  const [connecting, setConnecting] = React.useState(false);
  const [result, setResult] = React.useState<{ count: number; merchantId: string } | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // A merchant from a prior "Enable ordering" run (so returning owners can connect
  // Stripe without re-publishing).
  const existingMerchantId: string =
    (template as any)?.data?.meta?.ecom?.merchant_id ??
    (template as any)?.data?.meta?.ecommerce?.merchant_id ??
    '';

  /** Start Stripe Connect onboarding for this merchant and hand off to Stripe. */
  const connectStripe = async (merchantId: string) => {
    if (!merchantId || connecting) return;
    setConnecting(true);
    setError(null);
    try {
      const res = await fetch('/api/connect/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchantId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.url) {
        setError(json?.error || 'Could not start Stripe setup. Please try again.');
        setConnecting(false);
        return;
      }
      window.location.href = json.url; // hand off to Stripe onboarding
    } catch (e: any) {
      setError(e?.message || 'Something went wrong.');
      setConnecting(false);
    }
  };

  const buildContent = React.useCallback(
    (secs: Section[]) => ({
      ...initial,
      title,
      note,
      sections: secs,
      // ⚠️ THE ONE PLACE A HUMAN ACTUALLY VERIFIES A PRICE, AND NOTHING WAS RECORDING IT.
      // `lib/menu/menuFreshness.ts` reads `verified_at` to decide whether a price may be quoted
      // as fact — and no writer in the codebase ever set it, so EVERY imported menu was
      // permanently unverifiable while the field sat unused. This is the honest event to stamp:
      // an owner in their own editor looking at their own prices. It is NOT stamped at import,
      // because reading a diner's undated photograph today tells us when WE looked, never when
      // the menu was current, and converting "unknown age" into "verified now" is the exact lie
      // the rule exists to prevent.
      verified_at: new Date().toISOString(),
    }),
    [initial, title, note],
  );

  const commit = (secs: Section[] = sections) => {
    const next = buildContent(secs);
    // Write BOTH keys, the way the hero editor does. Saving only `content` would leave a stale
    // `props.sections` behind it — and the renderer prefers whichever it finds first, so the
    // page could keep showing the pre-edit menu while the editor showed the new one. Two copies
    // of one truth is what caused this; leaving one of them stale would keep causing it.
    const updated: Block = { ...(block as Block), type: 'menu', content: next, props: next } as Block;
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

  // option (choose-one) helpers
  const setOption = (si: number, ii: number, oi: number, patch: Partial<Option>) =>
    setItem(si, ii, {
      options: (sections[si].items[ii].options ?? []).map((o, j) => (j === oi ? { ...o, ...patch } : o)),
    });
  const addOption = (si: number, ii: number) =>
    setItem(si, ii, { options: [...(sections[si].items[ii].options ?? []), { label: '', price: '' }] });
  const removeOption = (si: number, ii: number, oi: number) =>
    setItem(si, ii, { options: (sections[si].items[ii].options ?? []).filter((_, j) => j !== oi) });

  // tag helpers (owner-asserted labels; the renderer shows them as badges)
  const toggleTag = (si: number, ii: number, tag: string) => {
    const cur = sections[si].items[ii].tags ?? [];
    setItem(si, ii, { tags: cur.includes(tag) ? cur.filter((t) => t !== tag) : [...cur, tag] });
  };

  // add-on (multi-select) helpers
  const setAddon = (si: number, ii: number, ai: number, patch: Partial<Addon>) =>
    setItem(si, ii, { addons: (sections[si].items[ii].addons ?? []).map((a, j) => (j === ai ? { ...a, ...patch } : a)) });
  const addAddon = (si: number, ii: number) =>
    setItem(si, ii, { addons: [...(sections[si].items[ii].addons ?? []), { label: '', price: '' }] });
  const removeAddon = (si: number, ii: number, ai: number) =>
    setItem(si, ii, { addons: (sections[si].items[ii].addons ?? []).filter((_, j) => j !== ai) });

  // ---- price confirmation model ----
  // Each item's confirmable cents, prefilled from its display price.
  const [confirmCents, setConfirmCents] = React.useState<Record<string, number | null>>({});
  const keyOf = (si: number, ii: number) => `${si}:${ii}`;

  const optKey = (si: number, ii: number, oi: number) => `${si}:${ii}:${oi}`;
  const addonKey = (si: number, ii: number, ai: number) => `${si}:${ii}:a${ai}`;

  const openConfirm = () => {
    const seed: Record<string, number | null> = {};
    sections.forEach((s, si) =>
      s.items.forEach((it, ii) => {
        if (it.options?.length) {
          it.options.forEach((o, oi) => {
            seed[optKey(si, ii, oi)] = o.price_cents ?? parsePriceToCents(o.price);
          });
        } else {
          seed[keyOf(si, ii)] = it.price_cents ?? parsePriceToCents(it.price);
        }
        (it.addons ?? []).forEach((a, ai) => {
          seed[addonKey(si, ii, ai)] = a.price_cents ?? parsePriceToCents(a.price) ?? 0;
        });
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
        items: s.items.map((it, ii) => {
          const addons = (it.addons ?? [])
            .filter((a) => a.label.trim())
            .map((a, ai) => ({ label: a.label, price_cents: confirmCents[addonKey(si, ii, ai)] ?? 0 }));
          const base = it.options?.length
            ? {
                name: it.name,
                description: it.description ?? '',
                image_url: it.image_url ?? '',
                options: it.options.map((o, oi) => ({ label: o.label, price_cents: confirmCents[optKey(si, ii, oi)] ?? null })),
              }
            : {
                name: it.name,
                description: it.description ?? '',
                image_url: it.image_url ?? '',
                price_cents: confirmCents[keyOf(si, ii)] ?? null,
              };
          return addons.length ? { ...base, addons } : base;
        }),
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
                <div key={ii} className="rounded-md border border-zinc-800/70 p-2">
                  <div className="grid grid-cols-[1fr,88px,auto] gap-2">
                    <input className={inputCls} value={it.name} onChange={(e) => setItem(si, ii, { name: e.target.value })} placeholder="Dish name" />
                    <input className={inputCls} value={it.price ?? ''} onChange={(e) => setItem(si, ii, { price: e.target.value })} placeholder="$12" />
                    <button onClick={() => removeItem(si, ii)} className="rounded-md border border-zinc-700 px-2 text-xs text-zinc-400 hover:text-red-300">
                      ✕
                    </button>
                  </div>
                  <input
                    className={`${inputCls} mt-2`}
                    value={it.description ?? ''}
                    onChange={(e) => setItem(si, ii, { description: e.target.value })}
                    placeholder="Description (optional)"
                  />

                  {/* Tags — owner-asserted badges shown on the menu. */}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {PRESET_TAGS.map((tag) => {
                      const active = (it.tags ?? []).includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleTag(si, ii, tag)}
                          className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition ${
                            active
                              ? 'border-transparent bg-sky-500 text-zinc-950'
                              : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
                          }`}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-2">
                    <ImageUploadField
                      value={it.image_url ?? ''}
                      onChange={(url) => setItem(si, ii, { image_url: url })}
                      folder="menu"
                      placeholder="Photo URL, or upload →"
                    />
                  </div>

                  {/* Choose-one options (sizes / half-full). When present they set the price. */}
                  <div className="mt-2 border-l border-zinc-800 pl-2">
                    <div className="text-[11px] text-zinc-500">Options — choose one (e.g. Small / Large). Overrides the price above.</div>
                    {(it.options ?? []).map((o, oi) => (
                      <div key={oi} className="mt-1 grid grid-cols-[1fr,72px,auto] gap-2">
                        <input className={inputCls} value={o.label} onChange={(e) => setOption(si, ii, oi, { label: e.target.value })} placeholder="Option (e.g. Large)" />
                        <input className={inputCls} value={o.price ?? ''} onChange={(e) => setOption(si, ii, oi, { price: e.target.value })} placeholder="$14" />
                        <button onClick={() => removeOption(si, ii, oi)} className="rounded-md border border-zinc-700 px-2 text-xs text-zinc-400 hover:text-red-300">✕</button>
                      </div>
                    ))}
                    <button onClick={() => addOption(si, ii)} className="mt-1 text-[11px] text-sky-400 hover:text-sky-300">+ Add option</button>
                  </div>

                  {/* Multi-select add-ons (extra cheese, bacon). Add to the price. */}
                  <div className="mt-2 border-l border-zinc-800 pl-2">
                    <div className="text-[11px] text-zinc-500">Add-ons — optional extras (e.g. Extra cheese). Each adds to the price.</div>
                    {(it.addons ?? []).map((a, ai) => (
                      <div key={ai} className="mt-1 grid grid-cols-[1fr,72px,auto] gap-2">
                        <input className={inputCls} value={a.label} onChange={(e) => setAddon(si, ii, ai, { label: e.target.value })} placeholder="Add-on (e.g. Bacon)" />
                        <input className={inputCls} value={a.price ?? ''} onChange={(e) => setAddon(si, ii, ai, { price: e.target.value })} placeholder="$2" />
                        <button onClick={() => removeAddon(si, ii, ai)} className="rounded-md border border-zinc-700 px-2 text-xs text-zinc-400 hover:text-red-300">✕</button>
                      </div>
                    ))}
                    <button onClick={() => addAddon(si, ii)} className="mt-1 text-[11px] text-sky-400 hover:text-sky-300">+ Add add-on</button>
                  </div>

                  {it.catalog_item_id && <span className="mt-1 block text-[11px] text-emerald-400">✓ Orderable</span>}
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
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button onClick={openConfirm} className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 hover:opacity-90">
                Enable online ordering →
              </button>
              {existingMerchantId && (
                <button
                  onClick={() => connectStripe(existingMerchantId)}
                  disabled={connecting}
                  className="rounded-md border border-indigo-400/50 px-4 py-2 text-sm font-semibold text-indigo-300 hover:bg-indigo-500/10 disabled:opacity-50"
                >
                  {connecting ? 'Opening Stripe…' : 'Connect Stripe to get paid →'}
                </button>
              )}
            </div>
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
                  const rows: { k: string; label: React.ReactNode }[] =
                    it.options?.length
                      ? it.options
                          .filter((o) => o.label.trim())
                          .map((o, oi) => ({
                            k: optKey(si, ii, oi),
                            label: (
                              <><span className="text-zinc-500">{s.name} · </span>{it.name} <span className="text-zinc-500">— {o.label}</span></>
                            ),
                          }))
                      : [{ k: keyOf(si, ii), label: <><span className="text-zinc-500">{s.name} · </span>{it.name}</> }];
                  (it.addons ?? []).forEach((a, ai) => {
                    if (!a.label.trim()) return;
                    rows.push({
                      k: addonKey(si, ii, ai),
                      label: <><span className="text-zinc-500">{it.name} + </span>{a.label} <span className="text-zinc-500">(add-on)</span></>,
                    });
                  });
                  return rows.map(({ k, label }) => {
                    const cents = confirmCents[k];
                    return (
                      <div key={k} className="flex items-center gap-2 text-sm">
                        <span className="flex-1 truncate text-zinc-300">{label}</span>
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
                  });
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
              The menu's "Add to order" buttons are live. Connect Stripe to actually collect payment.
            </p>
            <button
              onClick={() => connectStripe(result.merchantId)}
              disabled={connecting}
              className="mt-3 rounded-md bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {connecting ? 'Opening Stripe…' : 'Connect Stripe to get paid →'}
            </button>
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
