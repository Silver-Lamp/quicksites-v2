'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import toast from 'react-hot-toast';
import { COMMON_CUISINES } from '@/lib/cuisines';
import MealsTableEditable from '@/components/admin/chef/meals-table-editable';
import WaitlistTab from '@/components/admin/chef/waitlist-tab';
import { slugify, RESERVED_SLUGS } from '@/lib/slug';
import PostScheduleTab from '@/components/admin/chef/post-schedule-tab';
import SocialConnectors from '@/components/admin/chef/social-connectors';
import StickerDesigner from '@/components/admin/chef/sticker-designer';
import ComplianceMissingCard from '@/components/chef/compliance-missing-card';
import ChefProfileManager from '@/components/admin/chef/chef-profile-manager';
import ImageUrlPreview from '@/components/ui/image-url-preview';

type MeResp = {
  merchant: { id: string; name: string; default_platform_fee_bps: number } | null;
  stripeAccountId: string | null;
  sites: { site_id: string; status: string; role: string }[];
};

type Meal = {
  id: string;
  title: string;
  price_cents: number;
  is_active: boolean;
  qty_available: number | null;
  max_per_order: number | null;
  created_at: string;
  site_id: string;
  hashtags: string | null;
  hashtags_mode: 'append' | 'replace' | null;
};

const isDev = process.env.NODE_ENV !== 'production';

const DEFAULT_SITE_HINT =
  process.env.NEXT_PUBLIC_DEFAULT_SITE_HINT || 'deliveredmenu';

async function resolveSite(hint: string): Promise<string | null> {
  try {
    const r = await fetch(`/api/public/site/resolve?hint=${encodeURIComponent(hint)}`);
    if (!r.ok) return null;
    const d = await r.json();
    return d?.site_id ?? null;
  } catch {
    return null;
  }
}

export default function ChefDashboardPage() {
  const [me, setMe] = useState<MeResp | null>(null);
  const [loadingMe, setLoadingMe] = useState(true);
  const [siteId, setSiteId] = useState<string>('');
  const [busyOnboard, setBusyOnboard] = useState(false);
  const [busyManage, setBusyManage] = useState(false);

  // Create Meal form
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [priceUsd, setPriceUsd] = useState('12.00');
  const [imageUrl, setImageUrl] = useState('');
  const [availableFrom, setAvailableFrom] = useState('');
  const [availableTo, setAvailableTo] = useState('');
  const [maxPerOrder, setMaxPerOrder] = useState('5');
  const [qtyAvailable, setQtyAvailable] = useState('');

  const [meals, setMeals] = useState<Meal[]>([]);
  const [loadingMeals, setLoadingMeals] = useState(false);

  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([]);
  const [cuisineOptions, setCuisineOptions] = useState<string[]>(COMMON_CUISINES);

  const [autoDeactivate, setAutoDeactivate] = useState(true);

  const [slugInput, setSlugInput] = useState('');
  const [autoSlug, setAutoSlug] = useState(true);
  const [slugStatus, setSlugStatus] = useState<{
    state: 'idle' | 'checking' | 'ok' | 'taken' | 'err';
    normalized?: string;
    suggestion?: string;
  }>({ state: 'idle' });
  const [hashtags, setHashtags] = useState('');
  const [hashtagsMode, setHashtagsMode] = useState<'append' | 'replace'>('append');

  const [listNonce, setListNonce] = useState(0);
  // NEW: Test mode
  const [testMode, setTestMode] = useState<boolean>(true); // default ON; auto-forced when not approved
  useEffect(() => {
    try {
      const saved = localStorage.getItem('chef.testMode');
      if (saved === '0') setTestMode(false);
      if (saved === '1') setTestMode(true);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem('chef.testMode', testMode ? '1' : '0');
    } catch {}
  }, [testMode]);


  const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function resolveSite(hint: string): Promise<string | null> {
  try {
    const r = await fetch(`/api/public/site/resolve?hint=${encodeURIComponent(hint)}`);
    if (!r.ok) return null;
    const d = await r.json();
    return d?.site_id ?? null;
  } catch { return null; }
}

  // When siteId is present but not a UUID, resolve and replace
  useEffect(() => {
    if (!siteId || UUID_RE.test(siteId)) return;
    let cancelled = false;
    (async () => {
      const id = await resolveSite(siteId);
      if (!cancelled && id) setSiteId(id);
    })();
    return () => { cancelled = true; };
  }, [siteId]);

  // Only persist when it’s a UUID, so we don’t save "deliveredmenu" to localStorage
  useEffect(() => {
    if (siteId && UUID_RE.test(siteId)) localStorage.setItem('chef.siteId', siteId);
  }, [siteId]);

  useEffect(() => {
    if (!autoSlug) return;
    const base = slugify(title || '');
    setSlugInput(base);
  }, [title, autoSlug]);

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
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [siteId, slugInput]);

  useEffect(() => {
    const storedSite = localStorage.getItem('chef.siteId');
    if (storedSite) setSiteId(storedSite);
    (async () => {
      setLoadingMe(true);
      try {
        const r = await fetch('/api/chef/me');
        if (r.status === 401) {
          toast.error('Please sign in first.');
          return;
        }
        const data = (await r.json()) as MeResp;
        setMe(data);
      } catch (e: any) {
        toast.error(e.message || 'Failed to load');
      } finally {
        setLoadingMe(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (siteId) localStorage.setItem('chef.siteId', siteId);
  }, [siteId]);

  useEffect(() => {
    // already set? keep it
    if (siteId) return;
  
    (async () => {
      // 1) localStorage
      const stored = localStorage.getItem('chef.siteId');
      if (stored) { setSiteId(stored); return; }
  
      // 2) URL ?site or ?siteId
      const params = new URLSearchParams(window.location.search);
      const fromQuery = params.get('site') || params.get('siteId');
      if (fromQuery) {
        const resolved = await resolveSite(fromQuery);
        if (resolved) { setSiteId(resolved); return; }
      }
  
      // 3) Linked sites (prefer approved)
      if (me?.sites?.length) {
        const approved = me.sites.find(s => s.status === 'approved')?.site_id
          || me.sites[0]?.site_id;
        if (approved) { setSiteId(approved); return; }
      }
  
      // 4) Current hostname
      const host = window.location.hostname;
      const byHost = await resolveSite(host);
      if (byHost) { setSiteId(byHost); return; }
  
      // 5) Env/default hint (e.g. "deliveredmenu")
      const fallback = await resolveSite(DEFAULT_SITE_HINT);
      if (fallback) { setSiteId(fallback); return; }
    })();
  }, [siteId, me]);
  
  const approvedForSite = useMemo(() => {
    if (!me || !siteId) return false;
    return me.sites?.some((s) => s.site_id === siteId && s.status === 'approved');
  }, [me, siteId]);

  // If they aren’t approved, force test mode on (can’t create live yet)
  useEffect(() => {
    if (!approvedForSite) setTestMode(true);
  }, [approvedForSite]);

  const canCreateMeal = approvedForSite || testMode;

  async function refreshMeals() {
    if (!siteId) return;
    setLoadingMeals(true);
    try {
      const r = await fetch(`/api/chef/meals/list?siteId=${encodeURIComponent(siteId)}`);
      const data = await r.json();
      setMeals(data?.meals ?? []);
    } finally {
      setLoadingMeals(false);
    }
  }

  useEffect(() => {
    if (approvedForSite) refreshMeals();
  }, [approvedForSite]);

  useEffect(() => {
    if (!siteId) return;
    (async () => {
      try {
        const p = new URLSearchParams({ siteId });
        const r = await fetch(`/api/public/cuisines?${p.toString()}`);
        const data = await r.json();
        const arr =
          Array.isArray(data?.cuisines) && data.cuisines.length ? data.cuisines : COMMON_CUISINES;
        setCuisineOptions(arr);
      } catch {
        setCuisineOptions(COMMON_CUISINES);
      }
    })();
  }, [siteId]);

  async function startOnboarding() {
    if (!siteId) return toast.error('Enter Site ID first');
    setBusyOnboard(true);
    try {
      const r = await fetch('/api/chef/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || 'Onboarding failed');
      if (data.url) window.location.href = data.url;
    } catch (e: any) {
      toast.error(e.message || 'Failed to start onboarding');
    } finally {
      setBusyOnboard(false);
    }
  }

  async function managePayouts() {
    if (!me?.merchant?.id) return;
    setBusyManage(true);
    try {
      const r = await fetch('/api/connect/login-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchantId: me.merchant.id })
      });
      const data = await r.json();
      if (data?.url) window.location.href = data.url;
      else toast.error('Could not open dashboard');
    } finally {
      setBusyManage(false);
    }
  }

  async function createMeal() {
    if (!siteId) return toast.error('Enter Site ID first');
    if (!title.trim()) return toast.error('Title required');
    const cents = Math.round(parseFloat(priceUsd || '0') * 100);
    if (!Number.isFinite(cents) || cents <= 0) return toast.error('Price must be > 0');

    try {
      const finalSlug =
        slugStatus.state === 'taken' && slugStatus.suggestion ? slugStatus.suggestion : slugInput || undefined;

      const is_test = !approvedForSite || testMode; // <-- key line

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
          is_test, // <-- send through
        })
      });

      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || 'Create failed');
      toast.success(is_test ? 'Test meal created' : 'Meal created');

      setTitle('');
      setDesc('');
      setImageUrl('');
      setQtyAvailable('');
      setListNonce(listNonce + 1);
      await refreshMeals();
    } catch (e: any) {
      toast.error(e.message || 'Error creating meal');
    }
  }

  async function fillRandomAndMaybeCreate(autoCreate = false) {
    // lightweight randoms so you can test quickly
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
    setSelectedCuisines([pick(cuisineOptions)]);
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
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <ComplianceMissingCard />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Chef Dashboard</h1>
        {!loadingMe && (
          <Badge variant={me?.stripeAccountId ? 'default' : 'secondary'}>
            {me?.stripeAccountId ? 'Payouts Connected' : 'Payouts Not Connected'}
          </Badge>
        )}
      </div>

      {/* Social */}
      <div className="rounded-2xl border p-4">
        <h2 className="text-base font-semibold mb-2">Social</h2>
        <p className="text-sm text-muted-foreground mb-2">
          Connect your X (Twitter) to enable scheduled posts.
        </p>
        <a className="rounded-md border px-3 py-1 text-sm" href="/api/social/x/connect">
          Connect X
        </a>
      </div>

      {/* Site selector */}
      <div className="rounded-2xl border p-4">
        <h2 className="text-base font-semibold mb-2">Site</h2>
        <p className="text-sm text-muted-foreground mb-3">
          Enter the delivered.menu <code>site_id</code> for testing.
        </p>
        <div className="flex items-end gap-3 max-w-xl">
          <div className="flex-1">
            <Label htmlFor="siteId">Site ID</Label>
            <Input id="siteId" value={siteId} onChange={(e) => setSiteId(e.target.value)} placeholder="UUID…" />
          </div>
          {!me?.stripeAccountId ? (
            <Button onClick={startOnboarding} disabled={!siteId || busyOnboard}>
              {busyOnboard ? 'Starting…' : 'Join & Connect payouts'}
            </Button>
          ) : (
            <Button variant="outline" onClick={managePayouts} disabled={busyManage}>
              {busyManage ? 'Opening…' : 'Manage payouts'}
            </Button>
          )}
        </div>
        {!!me?.sites?.length && (
          <p className="text-xs text-muted-foreground mt-2">
            Linked sites: {me.sites.map((s) => `${s.site_id.slice(0, 8)}… (${s.status})`).join(', ')}
          </p>
        )}
      </div>

      {/* Chef Profile */}
      <div className="rounded-2xl border p-4">
        <h2 className="text-base font-semibold mb-2">My Profile</h2>
        <p className="text-sm text-muted-foreground mb-3">Update your public profile shown on delivered.menu.</p>
        <ChefProfileManager />
      </div>

      {/* Create Meal */}
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
              Creating: {testMode ? 'Test' : 'Live'}
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
                      bucket: 'meals'
                    };
                    const r = await fetch('/api/chef/meals/generate-image', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(body)
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
          <Button variant="outline" onClick={refreshMeals}>
            Refresh
          </Button>

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

      {/* Meals list */}
      <div className="rounded-2xl border p-4">
        <h2 className="text-base font-semibold mb-2">My Meals</h2>
        <Button variant="outline" onClick={() => setListNonce(n => n + 1)}>
            Refresh
        </Button>
        {!siteId ? <p className="text-sm text-muted-foreground">Enter a Site ID above.</p> : <MealsTableEditable siteId={siteId} reloadKey={listNonce} />}
      </div>

      <div className="rounded-2xl border p-4">
        <h2 className="text-base font-semibold mb-2">Waitlist</h2>
        {!siteId ? <p className="text-sm text-muted-foreground">Enter a Site ID above.</p> : <WaitlistTab siteId={siteId} />}
      </div>

      <div className="rounded-2xl border p-4">
        <h2 className="text-base font-semibold mb-2">Post Scheduling</h2>
        {!siteId ? <p className="text-sm text-muted-foreground">Enter a Site ID above.</p> : <PostScheduleTab siteId={siteId} />}
      </div>

      <div className="rounded-2xl border p-4">
        <h2 className="text-base font-semibold mb-2">Social Connectors</h2>
        <p className="text-sm text-muted-foreground mb-3">Add Slack, Discord, or any service that accepts a webhook (Zapier/Make/IFTTT/Buffer).</p>
        <SocialConnectors siteId={siteId} />
      </div>

      <div className="rounded-2xl border p-4">
        <h2 className="text-base font-semibold mb-2">Stickers</h2>
        <StickerDesigner merchantId={me?.merchant?.id || ''} merchantName={me?.merchant?.name || ''} />
      </div>
    </div>
  );
}
