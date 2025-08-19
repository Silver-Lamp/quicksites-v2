// components/admin/chef/CreateMealCard.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import ImageUrlPreview from '@/components/ui/image-url-preview';
import toast from 'react-hot-toast';
import { slugify, RESERVED_SLUGS } from '@/lib/slug';

// Types for slug-check result
type SlugStatus = {
  state: 'idle' | 'checking' | 'ok' | 'taken' | 'err';
  normalized?: string;
  suggestion?: string;
};

export default function CreateMealCard({
  siteId,
  approvedForSite,
  cuisineOptions,
  onCreated,
  isDev: isDevProp,
}: {
  siteId: string;
  approvedForSite: boolean;
  cuisineOptions: string[];
  onCreated?: () => void; // parent can refresh My Meals list
  isDev?: boolean;
}) {
  // detect dev unless caller overrides
  const isDev = typeof isDevProp === 'boolean' ? isDevProp : process.env.NODE_ENV !== 'production';

  // Test mode — default ON; forced ON when not approved
  const [testMode, setTestMode] = useState<boolean>(true);
  useEffect(() => {
    try {
      const saved = localStorage.getItem('chef.testMode');
      if (saved === '0') setTestMode(false);
      if (saved === '1') setTestMode(true);
    } catch {}
  }, []);
  useEffect(() => {
    if (!approvedForSite && !testMode) setTestMode(true);
  }, [approvedForSite, testMode]);
  useEffect(() => {
    try { localStorage.setItem('chef.testMode', testMode ? '1' : '0'); } catch {}
  }, [testMode]);

  // Form state
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [priceUsd, setPriceUsd] = useState('12.00');
  const [imageUrl, setImageUrl] = useState('');
  const [availableFrom, setAvailableFrom] = useState('');
  const [availableTo, setAvailableTo] = useState('');
  const [maxPerOrder, setMaxPerOrder] = useState('5');
  const [qtyAvailable, setQtyAvailable] = useState('');

  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([]);
  const [autoDeactivate, setAutoDeactivate] = useState(true);

  const [slugInput, setSlugInput] = useState('');
  const [autoSlug, setAutoSlug] = useState(true);
  const [slugStatus, setSlugStatus] = useState<SlugStatus>({ state: 'idle' });

  const [hashtags, setHashtags] = useState('');
  const [hashtagsMode, setHashtagsMode] = useState<'append' | 'replace'>('append');

  const canCreateMeal = approvedForSite || testMode;

  // Auto-slug from title
  useEffect(() => {
    if (!autoSlug) return;
    const base = slugify(title || '');
    setSlugInput(base);
  }, [title, autoSlug]);

  // Slug availability check
  useEffect(() => {
    if (!siteId || !slugInput) {
      setSlugStatus({ state: 'idle' });
      return;
    }
    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        setSlugStatus({ state: 'checking' });
        const u = new URLSearchParams({ siteId, slug: slugInput });
        const r = await fetch(`/api/chef/meals/slug-check?${u.toString()}`, { signal: controller.signal });
        const d = await r.json();
        if (!r.ok) throw new Error(d?.error || 'check failed');
        setSlugStatus({ state: d.available ? 'ok' : 'taken', normalized: d.normalized, suggestion: d.suggestion });
      } catch {
        setSlugStatus({ state: 'err' });
      }
    }, 300);
    return () => { clearTimeout(t); controller.abort(); };
  }, [siteId, slugInput]);

  async function createMeal() {
    if (!siteId) return toast.error('Enter Site ID first');
    if (!title.trim()) return toast.error('Title required');
    const cents = Math.round(parseFloat(priceUsd || '0') * 100);
    if (!Number.isFinite(cents) || cents <= 0) return toast.error('Price must be > 0');

    try {
      const finalSlug = slugStatus.state === 'taken' && slugStatus.suggestion
        ? slugStatus.suggestion
        : slugInput || undefined;

      const is_test = !approvedForSite || testMode;

      const r = await fetch('/api/chef/meals/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId,
          title,
          description: desc,
          price_cents: cents,
          image_url: imageUrl || undefined,
          available_from: availableFrom ? new Date(availableFrom).toISOString() : undefined,
          available_to: availableTo ? new Date(availableTo).toISOString() : undefined,
          max_per_order: maxPerOrder ? parseInt(maxPerOrder, 10) : undefined,
          qty_available: qtyAvailable ? parseInt(qtyAvailable, 10) : undefined,
          cuisines: selectedCuisines,
          auto_deactivate_when_sold_out: autoDeactivate,
          slug: finalSlug,
          hashtags: hashtags || null,
          hashtags_mode: hashtagsMode === 'replace' ? 'replace' : 'append',
          is_test,
        }),
      });

      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || 'Create failed');
      toast.success(is_test ? 'Test meal created' : 'Meal created');

      // reset core fields
      setTitle('');
      setDesc('');
      setImageUrl('');
      setQtyAvailable('');
      setSelectedCuisines([]);
      setAutoDeactivate(true);
      setHashtags('');
      setHashtagsMode('append');
      setAutoSlug(true);
      setSlugInput('');

      onCreated?.();
    } catch (e: any) {
      toast.error(e.message || 'Error creating meal');
    }
  }

  async function fillRandomAndMaybeCreate(autoCreate = false) {
    const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
    const mains = ['Braised lamb', 'Citrus chicken', 'Tofu stir-fry', 'Garlic shrimp', 'Mushroom risotto'];
    const extras = ['with pesto', 'w/ lemon & herbs', '— family style', 'over creamy polenta'];
    const titleR = `${pick(mains)} ${pick(extras)}`;

    setTitle(titleR);
    setDesc('Small batch, limited portions. Fresh today.');
    setPriceUsd((10 + Math.floor(Math.random() * 15)).toFixed(2));
    setImageUrl('');
    setAvailableFrom('');
    setAvailableTo('');
    setMaxPerOrder(String(1 + Math.floor(Math.random() * 5)));
    setQtyAvailable(String(10 + Math.floor(Math.random() * 40)));
    setSelectedCuisines(cuisineOptions.length ? [pick(cuisineOptions)] : []);
    setAutoDeactivate(true);
    setHashtags('#fresh #local');
    setHashtagsMode('append');
    setAutoSlug(false);
    setSlugInput(slugify(titleR));

    if (autoCreate && canCreateMeal) {
      await new Promise((r) => setTimeout(r, 30));
      await createMeal();
    }
  }

  return (
    <div className="rounded-2xl border p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-base font-semibold">Create Meal</h2>

        {/* Test mode switch */}
        <label className="inline-flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={testMode}
            onChange={(e) => setTestMode(e.target.checked)}
            disabled={!approvedForSite}
            title={!approvedForSite ? 'Test mode is required until you are approved.' : 'Toggle test/live'}
          />
          <span>Test mode</span>
          <span className="rounded-full border px-2 py-0.5">
            Creating: {testMode || !approvedForSite ? 'Test' : 'Live'}
          </span>
        </label>
      </div>

      {!approvedForSite && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mb-3">
          You’re not approved/linked to this site yet. You can still create <b>test meals</b> while finishing
          onboarding. Turn off <b>Test mode</b> once approved.
        </p>
      )}

      <div className="grid md:grid-cols-2 gap-4 max-w-3xl">
        <div>
          <Label htmlFor="title">Title</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="World-famous casserole" />
        </div>

        <div className="space-y-1">
          <Label className="text-sm">Hashtags</Label>
          <Input value={hashtags} onChange={(e) => setHashtags(e.target.value)} placeholder="#vegan #glutenfree  (or: vegan, glutenfree)" />
          <div className="flex items-center gap-3 pt-1">
            <Label className="text-xs">Mode</Label>
            <select
              className="rounded-md border px-2 py-1 text-xs bg-background"
              value={hashtagsMode}
              onChange={(e) => setHashtagsMode(e.target.value as any)}
            >
              <option value="append">Append to defaults</option>
              <option value="replace">Replace defaults</option>
            </select>
          </div>
          <p className="text-xs text-muted-foreground">We’ll normalize and de-duplicate; up to ~6 hashtags per post.</p>
        </div>

        <div>
          <Label htmlFor="price">Price (USD)</Label>
          <Input id="price" value={priceUsd} onChange={(e) => setPriceUsd(e.target.value)} inputMode="decimal" />
        </div>

        <div className="md:col-span-2 space-y-2">
          <label className="text-sm font-medium">URL Slug</label>
          <div className="flex items-center gap-2">
            <input
              value={slugInput}
              onChange={(e) => {
                setAutoSlug(false);
                setSlugInput(slugify(e.target.value));
              }}
              className="w-full rounded-md border px-3 py-2 text-sm bg-background"
              placeholder="e.g., lasagna-bolognese"
              maxLength={60}
            />
            <button
              type="button"
              className="rounded-md border px-2 py-1 text-xs bg-background"
              onClick={() => {
                setAutoSlug(true);
                setSlugInput(slugify(title || 'meal'));
              }}
              title="Regenerate from title"
            >
              Auto
            </button>
          </div>
          <div className="text-xs">
            <span className="text-muted-foreground bg-background">
              Preview:&nbsp; <code>/meals/{slugInput || 'meal'}</code>
            </span>
            {slugStatus.state === 'checking' && <span className="ml-2">Checking…</span>}
            {slugStatus.state === 'ok' && <span className="ml-2 text-emerald-700">Available</span>}
            {slugStatus.state === 'taken' && (
              <span className="ml-2 text-rose-700">Taken{slugStatus.suggestion ? ` — try "${slugStatus.suggestion}"` : ''}</span>
            )}
            {RESERVED_SLUGS.has(slugInput) && <span className="ml-2 text-amber-700">Reserved word — will be adjusted</span>}
          </div>
          <p className="text-xs text-muted-foreground">Lowercase letters, numbers, and dashes only (max 60). Final slug must be unique per site.</p>
        </div>

        <div className="md:col-span-2">
          <Label htmlFor="desc">Description</Label>
          <textarea
            id="desc"
            className="w-full bg-background rounded-md border px-3 py-2 text-sm"
            rows={3}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Short description…"
          />
        </div>

        <div className="md:col-span-2">
          <Label htmlFor="image">Image URL (optional)</Label>
          <div className="flex items-end gap-2">
            <Input
              id="image"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://…"
              className="flex-1"
            />
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  const body = {
                    title,
                    description: desc,
                    cuisines: selectedCuisines,
                    style: 'photo',
                    aspect: 'landscape',
                    bucket: 'meals',
                  };
                  const r = await fetch('/api/chef/meals/generate-image', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                  });
                  const d = await r.json();
                  if (!r.ok) throw new Error(d?.error || 'Failed to generate');
                  setImageUrl(d.url);
                } catch (e: any) {
                  toast.error(e.message || 'Generation failed');
                }
              }}
            >
              Generate with OpenAI
            </Button>
          </div>
          <ImageUrlPreview url={imageUrl} onClear={() => setImageUrl('')} />
        </div>

        <div>
          <Label htmlFor="from">Available from</Label>
          <Input id="from" type="datetime-local" value={availableFrom} onChange={(e) => setAvailableFrom(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="to">Available to</Label>
          <Input id="to" type="datetime-local" value={availableTo} onChange={(e) => setAvailableTo(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="max">Max per order</Label>
          <Input id="max" value={maxPerOrder} onChange={(e) => setMaxPerOrder(e.target.value)} inputMode="numeric" />
        </div>
        <div>
          <Label htmlFor="qty">Qty available (optional)</Label>
          <Input id="qty" value={qtyAvailable} onChange={(e) => setQtyAvailable(e.target.value)} inputMode="numeric" />
        </div>
        <div className="md:col-span-2 flex items-center gap-2">
          <input
            id="autoDeactivate"
            type="checkbox"
            checked={autoDeactivate}
            onChange={(e) => setAutoDeactivate(e.target.checked)}
          />
          <label htmlFor="autoDeactivate" className="text-sm">
            Auto-deactivate when sold out
          </label>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button onClick={createMeal} disabled={!canCreateMeal}>
          {testMode || !approvedForSite ? 'Create Test Meal' : 'Create Meal'}
        </Button>

        <Separator orientation="vertical" className="h-6" />
        <Button variant="outline" onClick={() => onCreated?.()}>Refresh</Button>

        {isDev && (
          <>
            <Separator orientation="vertical" className="h-6" />
            <Button type="button" variant="secondary" onClick={() => fillRandomAndMaybeCreate(false)} title="Fill the form with realistic test data">
              Randomize fields
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => fillRandomAndMaybeCreate(true)}
              disabled={!canCreateMeal}
              title="Fill and immediately create"
            >
              Auto-Create Random Meal
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
