// app/admin/org/page.tsx
'use client';

import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useOrg } from '@/app/providers';
import { supabase } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import OrgDomainPanel from '@/components/admin/org/OrgDomainPanel';

/* ───────────────────────── Types ───────────────────────── */

type BrandingFlags = {
  showPuppyWidget?: boolean;
  showGlow?: boolean;
  showMobileWidget?: boolean;
  showMobileGradients?: boolean;
  forceWidgetVariant?: string | null;
};

type BrandingOwnerLinks = {
  website?: string | null;
  email?: string | null;
  github?: string | null;
  twitter?: string | null;
  linkedin?: string | null;
};

type BrandingOwner = {
  name?: string | null;
  title?: string | null;
  photoUrl?: string | null;
  bio?: string | null; // plain text
  links?: BrandingOwnerLinks | null;
};

type Branding = {
  name?: string;
  domain?: string;
  logoUrl?: string | null;
  darkLogoUrl?: string | null;
  faviconUrl?: string | null;
  colors?: { gradient?: string[]; primary?: string };
  hero?: { headline?: string; subhead?: string };
  copy?: { featuresTitle?: string; featuresSubtitle?: string };
  flags?: BrandingFlags;
  owner?: BrandingOwner | null;
  /** Service-area contact auto-pointed onto org-branded geo-sites until they set their own. */
  address?: { line1?: string; city?: string; region?: string; postal?: string; phone?: string };
};

type OrgRow = {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  dark_logo_url: string | null;
  favicon_url: string | null;
  support_email: string | null;
  support_url: string | null;
  billing_mode: 'central' | 'reseller' | 'none' | null;
  branding?: Branding | string | null;
  primary_domain?: string | null;
  wildcard_enabled?: boolean | null;
  canonical_host?: string | null;
};

type OrgStats = { templates: number; domains: number; members: number };

/* ───────────────────── Utilities ───────────────────── */

function parseBranding(b: unknown): Branding | null {
  if (!b) return null;
  if (typeof b === 'string') {
    try { return JSON.parse(b) as Branding; } catch { return null; }
  }
  return b as Branding;
}

/* ───────────────────── Upload Field ───────────────────── */

function UploadField({
  label, value, onChange, orgId, orgSlug, tag, accept = 'image/*',
}: {
  label: string;
  value?: string | null;
  onChange: (next: string | null) => void;
  orgId: string;
  orgSlug: string;
  tag: string;
  accept?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imgError, setImgError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pickFile = () => inputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    setError(null);
    if (!file.type.startsWith('image/')) return setError('Please select an image file.');
    if (file.size > 5 * 1024 * 1024) return setError('File too large (max 5MB).');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('org_id', orgId);
      fd.append('org_slug', orgSlug);
      fd.append('tag', tag);
      const res = await fetch('/api/admin/org/upload', { method: 'POST', body: fd });

      let payload: any = null;
      let rawText: string | null = null;
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      if (ct.includes('application/json')) payload = await res.json();
      else {
        rawText = await res.text();
        try { payload = JSON.parse(rawText); } catch {}
      }
      if (!res.ok) {
        const msg = payload?.error || payload?.message || rawText || `Upload failed (HTTP ${res.status})`;
        if (res.status === 413 || /too large/i.test(String(msg))) {
          throw new Error('Upload too large. Increase serverActions.bodySizeLimit or upload a smaller image.');
        }
        throw new Error(String(msg));
      }
      const url: string | null = payload?.url ?? payload?.signedUrl ?? payload?.data?.signedUrl ?? null;
      onChange(url);
      setImgError(null);
      if (inputRef.current) inputRef.current.value = '';
    } catch (e: any) {
      setError(String(e?.message || 'Upload failed'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-1.5 mt-2 mb-2 border-b border-zinc-700 pb-2 pl-10">
      <label className="block text-sm">{label}</label>
      <div className="flex items-start gap-3">
        <div className="w-28 h-16 rounded border border-zinc-700 bg-zinc-900 flex items-center justify-center overflow-hidden">
          {value
            ? (
              // key forces re-render when URL changes
              <img
                key={value}
                src={value}
                alt=""
                className="max-w-full max-h-full object-contain"
                onError={() => setImgError('Preview failed')}
              />
            )
            : <span className="text-xs text-zinc-500">No image</span>}
        </div>

        <div className="flex-1 grid grid-cols-2 gap-2">
          <Input value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} placeholder="https://…/image.png" className="col-span-2" />
          <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleFileChange} />
          <div className="col-span-2 flex items-center gap-2">
            <Button type="button" onClick={pickFile} disabled={uploading}>{uploading ? 'Uploading…' : 'Upload / Replace'}</Button>
            <Button type="button" variant="secondary" disabled={!value} onClick={() => value && window.open(value, '_blank')}>Open</Button>
            <Button type="button" variant="outline" disabled={!value} onClick={() => onChange(null)}>Remove</Button>
          </div>
          {error && <div className="col-span-2 text-xs text-red-400 whitespace-pre-wrap">{error}</div>}
          {imgError && value && <div className="col-span-2 text-[11px] text-amber-400">Couldn’t load preview — the URL may be expired. Re-upload to refresh.</div>}
          <div className="col-span-2 text-[11px] text-zinc-500">Accepted: PNG, JPG, SVG, WebP, AVIF (≤ 5MB).</div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────── Settings Page ───────────────────── */

export default function OrgSettings() {
  const current = useOrg();
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [isHydrating, setIsHydrating] = useState(true);
  const [selectedId, setSelectedId] = useState<string>(current.id);

  // the org record used to hydrate the form (from API GET)
  const [selFromApi, setSelFromApi] = useState<OrgRow | null>(null);

  // pick list item by id for selector labels
  const selListItem = useMemo(() => orgs.find((o) => o.id === selectedId) || null, [orgs, selectedId]);

  const [draft, setDraft] = useState<Partial<OrgRow>>({});
  const [stats, setStats] = useState<OrgStats | null>(null);
  const [confirmSlug, setConfirmSlug] = useState('');
  const [confirmDeleteWord, setConfirmDeleteWord] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const brandingWasStringRef = useRef(false);

  // little clipboard helper
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (t: string) => { try { await navigator.clipboard.writeText(t); setCopied(t); setTimeout(() => setCopied(null), 1200); } catch {} };

  /* ── Admin detection ── */
  useEffect(() => {
    (async () => {
      try {
        const { data: me } = await supabase.auth.getUser();
        const uid = me?.user?.id;
        if (!uid) return setIsPlatformAdmin(false);
        const { data } = await supabase.from('admin_users').select('user_id').eq('user_id', uid).maybeSingle();
        setIsPlatformAdmin(!!data);
      } catch {
        setIsPlatformAdmin(false);
      }
    })();
  }, []);

  /* ── Fetch org list for selector ── */
  const loadOrgList = useCallback(async () => {
    if (isPlatformAdmin) {
      const { data } = await supabase
        .from('organizations_public')
        .select('id, slug, name, logo_url, dark_logo_url, favicon_url, support_email, support_url, billing_mode, branding, primary_domain, wildcard_enabled, canonical_host')
        .order('name', { ascending: true });
      setOrgs((data ?? []) as OrgRow[]);
      if (data && data.length && !data.some((o: any) => o.id === selectedId)) {
        setSelectedId((data[0] as any).id);
      }
    } else {
      setOrgs([{
        id: current.id,
        slug: current.slug,
        name: current.name,
        logo_url: current.logo_url ?? null,
        dark_logo_url: current.dark_logo_url ?? null,
        favicon_url: current.favicon_url ?? null,
        support_email: current.support_email ?? null,
        support_url: current.support_url ?? null,
        billing_mode: (current.billing_mode ?? 'central') as OrgRow['billing_mode'],
        branding: (current as any).branding ?? null,
        primary_domain: (current as any).primary_domain ?? null,
        wildcard_enabled: (current as any).wildcard_enabled ?? null,
        canonical_host: (current as any).canonical_host ?? null,
      }]);
      setSelectedId(current.id);
    }
  }, [isPlatformAdmin, current, selectedId]);

  /* ── Fetch the selected org via API (authoritative JSON) ── */
  const hydrateSelectedFromApi = useCallback(async (orgId: string) => {
    try {
      const res = await fetch(`/api/admin/org/update?org_id=${encodeURIComponent(orgId)}&stats=1`);
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Failed to load org');
      // j is the row (plus stats); keep them separate
      const { stats: s, ...row } = j;
      setSelFromApi(row as OrgRow);
      setStats(s as OrgStats ?? null);
    } catch {
      setSelFromApi(null);
      setStats(null);
    }
  }, []);

  /* ── Initial load and when admin-state changes ── */
  useEffect(() => { setIsHydrating(true); (async () => { await loadOrgList(); setIsHydrating(false); })(); }, [loadOrgList]);

  /* ── When selection changes, hydrate the form from API row ── */
  useEffect(() => {
    if (!selectedId) return;
    void hydrateSelectedFromApi(selectedId);
  }, [selectedId, hydrateSelectedFromApi]);

  /* ── Rehydrate draft whenever the API org changes ── */
  useEffect(() => {
    const sel = selFromApi;
    if (!sel) return;

    const existing = parseBranding(sel.branding);
    brandingWasStringRef.current = typeof sel.branding === 'string';

    const defaults: Branding = {
      name: sel.slug === 'quicksites' ? 'QuickSites' : sel.name,
      domain: sel.slug === 'quicksites' ? 'QuickSites.ai' : undefined,
      flags: { showPuppyWidget: sel.slug === 'quicksites', showGlow: true, showMobileWidget: true, showMobileGradients: true, forceWidgetVariant: 'puppy' },
      hero: { headline: 'Your Website. One Click Away.', subhead: 'Turn your local business into a digital presence in minutes. No code. No hassle.' },
      copy: { featuresTitle: 'Featured demos', featuresSubtitle: `Hand-picked highlights from what ${(sel.slug === 'quicksites' ? 'QuickSites' : 'your brand')} can do.` },
      owner: null,
    };

    const nextBranding: Branding = existing ?? defaults;

    setDraft({
      id: sel.id,
      name: sel.name,
      slug: sel.slug,
      logo_url: sel.logo_url ?? '',
      dark_logo_url: sel.dark_logo_url ?? '',
      favicon_url: sel.favicon_url ?? '',
      support_email: sel.support_email ?? '',
      support_url: sel.support_url ?? '',
      billing_mode: sel.billing_mode ?? 'central',
      branding: nextBranding,
      primary_domain: sel.primary_domain ?? null,
      wildcard_enabled: sel.wildcard_enabled ?? null,
      canonical_host: sel.canonical_host ?? 'www',
    });

    setConfirmSlug('');
    setConfirmDeleteWord('');
  }, [selFromApi?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Field helpers ── */
  const onField =
    (k: keyof OrgRow) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setDraft((d) => ({ ...d, [k]: e.target.value }));

  function setBrandingField<K extends keyof Branding>(key: K, value: Branding[K]) {
    setDraft((d) => ({ ...d, branding: { ...(parseBranding(d.branding) || {}), [key]: value } as Branding }));
  }
  function setBrandFlag<K extends keyof BrandingFlags>(key: K, value: BrandingFlags[K]) {
    setDraft((d) => ({
      ...d,
      branding: { ...(parseBranding(d.branding) || {}), flags: { ...((parseBranding(d.branding)?.flags) || {}), [key]: value } },
    }));
  }
  function setBrandHero<K extends keyof NonNullable<Branding['hero']>>(key: K, value: NonNullable<Branding['hero']>[K]) {
    setDraft((d) => ({
      ...d,
      branding: { ...(parseBranding(d.branding) || {}), hero: { ...((parseBranding(d.branding)?.hero) || {}), [key]: value } },
    }));
  }
  function setBrandCopy<K extends keyof NonNullable<Branding['copy']>>(key: K, value: NonNullable<Branding['copy']>[K]) {
    setDraft((d) => ({
      ...d,
      branding: { ...(parseBranding(d.branding) || {}), copy: { ...((parseBranding(d.branding)?.copy) || {}), [key]: value } },
    }));
  }
  function setBrandAddress<K extends keyof NonNullable<Branding['address']>>(key: K, value: NonNullable<Branding['address']>[K]) {
    setDraft((d) => ({
      ...d,
      branding: { ...(parseBranding(d.branding) || {}), address: { ...((parseBranding(d.branding)?.address) || {}), [key]: value } },
    }));
  }
  function setBrandOwner<K extends keyof NonNullable<Branding['owner']>>(key: K, value: NonNullable<Branding['owner']>[K]) {
    setDraft((d) => ({
      ...d,
      branding: { ...(parseBranding(d.branding) || {}), owner: { ...((parseBranding(d.branding)?.owner) || {}), [key]: value } },
    }));
  }
  function setBrandOwnerLink<K extends keyof BrandingOwnerLinks>(key: K, value: BrandingOwnerLinks[K]) {
    setDraft((d) => {
      const cur = (parseBranding(d.branding)?.owner?.links) || {};
      return { ...d, branding: { ...(parseBranding(d.branding) || {}), owner: { ...((parseBranding(d.branding)?.owner) || {}), links: { ...cur, [key]: value } } } };
    });
  }

  /* ── Save without hard reload ── */
  async function save() {
    const sel = selFromApi;
    if (!sel) return;
    setSaving(true);

    const brandingPayload =
      brandingWasStringRef.current
        ? JSON.stringify(parseBranding(draft.branding) ?? null)
        : (parseBranding(draft.branding) ?? null);

    const updates: Partial<OrgRow> = {
      name: (draft.name ?? '').trim(),
      slug: (draft.slug ?? '').trim(),
      logo_url: (draft.logo_url ?? '').trim() || null,
      dark_logo_url: (draft.dark_logo_url ?? '').trim() || null,
      favicon_url: (draft.favicon_url ?? '').trim() || null,
      support_email: (draft.support_email ?? '').trim() || null,
      support_url: (draft.support_url ?? '').trim() || null,
      billing_mode: (draft.billing_mode as any) ?? 'central',
      branding: brandingPayload as any,
    };

    try {
      const res = await fetch('/api/admin/org/update', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: sel.id, updates }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Save failed');

      // Re-hydrate from API so tokens/URLs (like signed image URLs) refresh
      await hydrateSelectedFromApi(sel.id);
      // Also refresh list (names/slugs may have changed)
      await loadOrgList();
    } catch (err: any) {
      alert(err?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function createOrg() {
    const name = prompt('New organization name?');
    if (!name) return;
    const slug = prompt('Slug (letters, numbers, dashes only)?');
    if (!slug) return;
    try {
      const res = await fetch('/api/admin/org/update', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'create', values: { name, slug } }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Create failed');
      await loadOrgList();
      const created = j.data as OrgRow | undefined;
      if (created?.id) setSelectedId(created.id);
    } catch (err: any) {
      alert(err?.message || 'Create failed');
    }
  }

  async function deleteOrg() {
    const sel = selFromApi;
    if (!sel) return;
    const canDelete =
      isPlatformAdmin && !!stats && stats.templates === 0 &&
      confirmSlug.trim() === sel.slug &&
      confirmDeleteWord.trim().toUpperCase() === 'DELETE';
    if (!canDelete) return;

    try {
      setDeleting(true);
      const res = await fetch('/api/admin/org/update', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id: sel.id }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Delete failed');

      await loadOrgList();
      setSelectedId(current.id);
    } catch (e: any) {
      alert(e?.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }

  const b = parseBranding(draft.branding) || ({} as Branding);

  const devHost = selListItem ? `${selListItem.slug}.localhost:3000` : '';
  const devUrl = selListItem ? `http://${devHost}/` : '';
  const devOrgRoute = selListItem ? `http://localhost:3000/orgs/${selListItem.slug}` : '';
  const devWwwUrl = selListItem ? `http://www.${selListItem.slug}.localhost:3000/` : '';

  /* ── Render ── */
  if (isHydrating || !selectedId) {
    return (
      <div className="max-w-4xl mt-12 text-sm text-zinc-400">
        Loading organization…
      </div>
    );
  }

  return (
    <div className="max-w-4xl mt-12">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Organization Settings</h1>
        {isPlatformAdmin && (
          <Button variant="default" onClick={createOrg}>
            + New Organization
          </Button>
        )}
      </div>

      {isPlatformAdmin && (
        <div className="mb-6">
          <label className="block text-sm mb-1">Select organization</label>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full max-w-md rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
          >
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} — {o.slug}
              </option>
            ))}
          </select>

          <div className="mt-2 flex gap-2">
            <Button variant="outline" onClick={() => selListItem && setSelectedId(selListItem.id)}>
              Switch to this org
            </Button>
            <Button variant="outline" onClick={() => selectedId && hydrateSelectedFromApi(selectedId)}>
              Refresh stats
            </Button>
          </div>

          {selListItem && (
            <div className="mt-4 rounded-lg border border-zinc-700 bg-zinc-900/40 p-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Developer Test Links (localhost)</h3>
                {copied && <span className="text-[11px] text-emerald-400">Copied: <code>{copied}</code></span>}
              </div>
              <div className="mt-2 grid gap-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-36 text-zinc-400">Org domain:</span>
                  <code className="px-2 py-1 rounded bg-zinc-950/60 border border-zinc-800">{devUrl}</code>
                  <Button size="sm" variant="outline" onClick={() => copy(devUrl)}>Copy</Button>
                  <a href={devUrl} target="_blank" rel="noreferrer"><Button size="sm">Open</Button></a>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-36 text-zinc-400">Org domain (www):</span>
                  <code className="px-2 py-1 rounded bg-zinc-950/60 border border-zinc-800">{devWwwUrl}</code>
                  <Button size="sm" variant="outline" onClick={() => copy(devWwwUrl)}>Copy</Button>
                  <a href={devWwwUrl} target="_blank" rel="noreferrer"><Button size="sm">Open</Button></a>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-36 text-zinc-400">Direct org route:</span>
                  <code className="px-2 py-1 rounded bg-zinc-950/60 border border-zinc-800">{devOrgRoute}</code>
                  <Button size="sm" variant="outline" onClick={() => copy(devOrgRoute)}>Copy</Button>
                  <a href={devOrgRoute} target="_blank" rel="noreferrer"><Button size="sm">Open</Button></a>
                </div>
              </div>
              <p className="mt-2 text-[11px] text-zinc-500">
                These links assume middleware maps org domains to <code>/orgs/{'{slug}'}</code> and that
                <code>{'{slug}'}.localhost</code> is in <code>ORG_DOMAINS</code> for dev.
              </p>
            </div>
          )}
        </div>
      )}

      {selFromApi ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* General */}
            <div className="space-y-3">
              <label className="block text-sm">Display Name</label>
              <Input value={draft.name ?? ''} onChange={onField('name')} />
              <label className="block text-sm">Slug</label>
              <Input value={draft.slug ?? ''} onChange={onField('slug')} />
              <label className="block text-sm">Support Email</label>
              <Input value={draft.support_email ?? ''} onChange={onField('support_email')} />
              <label className="block text-sm">Support URL</label>
              <Input value={draft.support_url ?? ''} onChange={onField('support_url')} />
              <label className="block text-sm">Billing Mode</label>
              <select
                value={draft.billing_mode ?? 'central'}
                onChange={onField('billing_mode')}
                className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
              >
                <option value="central">Central (platform billed)</option>
                <option value="reseller">Reseller (Stripe Connect)</option>
                <option value="none">None</option>
              </select>
            </div>

            {/* Logos */}
            <div className="space-y-4">
              <UploadField label="Logo (light UI)" value={draft.logo_url as string} onChange={(u) => setDraft((d) => ({ ...d, logo_url: u ?? '' }))} orgId={selFromApi.id} orgSlug={selFromApi.slug} tag="logo" />
              <UploadField label="Logo (dark UI)" value={draft.dark_logo_url as string} onChange={(u) => setDraft((d) => ({ ...d, dark_logo_url: u ?? '' }))} orgId={selFromApi.id} orgSlug={selFromApi.slug} tag="logo-dark" />
              <UploadField label="Favicon" value={draft.favicon_url as string} onChange={(u) => setDraft((d) => ({ ...d, favicon_url: u ?? '' }))} orgId={selFromApi.id} orgSlug={selFromApi.slug} tag="favicon" accept="image/png,image/x-icon,image/svg+xml,image/webp" />
              <div className="pt-1">
                <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
              </div>
              <OrgDomainPanel
                orgId={selFromApi.id}
                orgSlug={selFromApi.slug}
                initialDomain={(draft.primary_domain as any) || ''}
                initialWildcard={Boolean(draft.wildcard_enabled)}
                initialCanonical={(draft.canonical_host as any) ?? 'www'}
              />
            </div>
          </div>

          {/* Branding */}
          <div className="mt-10 rounded-lg border border-zinc-700 p-4 bg-zinc-900/40">
            <h2 className="text-lg font-semibold mb-2">Branding (White-Label)</h2>
            <p className="text-xs text-zinc-400 mb-4">Controls the public marketing look/feel for this org.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="block text-sm">Brand Display Name</label>
                <Input value={b?.name ?? ''} onChange={(e) => setBrandingField('name', e.target.value)} placeholder="Point Seven Studio" />

                <label className="block text-sm">Public Domain</label>
                <Input value={b?.domain ?? ''} onChange={(e) => setBrandingField('domain', e.target.value)} placeholder="pointsevenstudio.com" />

                <label className="block text-sm">Hero Headline</label>
                <Input value={b?.hero?.headline ?? ''} onChange={(e) => setBrandHero('headline', e.target.value)} placeholder="Selected Work & Case Studies" />

                <label className="block text-sm">Hero Subhead</label>
                <Input value={b?.hero?.subhead ?? ''} onChange={(e) => setBrandHero('subhead', e.target.value)} placeholder="Custom software, rapid launches…" />

                <div className="mt-4 border-t border-neutral-800 pt-3">
                  <div className="text-sm font-medium">Service-area address</div>
                  <p className="mb-2 text-xs text-neutral-500">
                    Auto-pointed onto this org’s geo-sites (“Serving {b?.address?.city || 'City'}, {b?.address?.region || 'ST'}”) until each site sets its own.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <Input value={b?.address?.city ?? ''} onChange={(e) => setBrandAddress('city', e.target.value)} placeholder="City (Renton)" />
                    <Input value={b?.address?.region ?? ''} onChange={(e) => setBrandAddress('region', e.target.value)} placeholder="State (WA)" />
                  </div>
                  <Input className="mt-2" value={b?.address?.phone ?? ''} onChange={(e) => setBrandAddress('phone', e.target.value)} placeholder="Phone (425-555-0100)" />
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-sm">Features Section Title</label>
                <Input value={b?.copy?.featuresTitle ?? ''} onChange={(e) => setBrandCopy('featuresTitle', e.target.value)} placeholder="Featured demos" />

                <label className="block text-sm">Features Section Subtitle</label>
                <Input value={b?.copy?.featuresSubtitle ?? ''} onChange={(e) => setBrandCopy('featuresSubtitle', e.target.value)} placeholder="Hand-picked highlights…" />

                <div className="mt-2 grid grid-cols-1 gap-3 rounded-md border border-zinc-700 p-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm">Show Glow/Gradients</label>
                    <Switch checked={!!b?.flags?.showGlow} onCheckedChange={(v) => setBrandFlag('showGlow', !!v)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm">Show Puppy Widget</label>
                    <Switch checked={!!b?.flags?.showPuppyWidget} onCheckedChange={(v) => setBrandFlag('showPuppyWidget', !!v)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm">Allow Widget on Mobile</label>
                    <Switch checked={b?.flags?.showMobileWidget ?? true} onCheckedChange={(v) => setBrandFlag('showMobileWidget', !!v)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm">Allow Gradients on Mobile</label>
                    <Switch checked={b?.flags?.showMobileGradients ?? true} onCheckedChange={(v) => setBrandFlag('showMobileGradients', !!v)} />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Branding'}</Button>
            </div>
          </div>

          {/* Owner Bio */}
          <div className="mt-10 rounded-lg border border-zinc-700 p-4 bg-zinc-900/40">
            <h2 className="text-lg font-semibold mb-2">Owner Bio (optional)</h2>
            <p className="text-xs text-zinc-400 mb-4">Appears at the bottom of the org homepage.</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1">
                <UploadField
                  label="Headshot / Photo"
                  value={b?.owner?.photoUrl ?? ''}
                  onChange={(u) => setBrandOwner('photoUrl', u ?? null)}
                  orgId={selFromApi.id}
                  orgSlug={selFromApi.slug}
                  tag="owner-photo"
                  accept="image/png,image/jpeg,image/webp,image/avif,image/svg+xml"
                />
              </div>

              <div className="md:col-span-2 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="block text-sm">Owner Name</Label>
                    <Input value={b?.owner?.name ?? ''} onChange={(e) => setBrandOwner('name', e.target.value)} placeholder="Sandon Jurowski" />
                  </div>
                  <div>
                    <Label className="block text-sm">Title</Label>
                    <Input value={b?.owner?.title ?? ''} onChange={(e) => setBrandOwner('title', e.target.value)} placeholder="Founder, Point Seven Studio" />
                  </div>
                </div>

                <div>
                  <Label className="block text-sm">Short Bio (plain text)</Label>
                  <Textarea
                    rows={6}
                    value={b?.owner?.bio ?? ''}
                    onChange={(e) => setBrandOwner('bio', e.target.value)}
                    placeholder={`I build fast, pragmatic software—SaaS, e-commerce, and AI features.\n\nPreviously @ ...`}
                  />
                  <p className="mt-1 text-[11px] text-zinc-500">Tip: use a blank line to start a new paragraph.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="block text-sm">Website</Label>
                    <Input value={b?.owner?.links?.website ?? ''} onChange={(e) => setBrandOwnerLink('website', e.target.value || null)} placeholder="https://pixblaze.com" />
                  </div>
                  <div>
                    <Label className="block text-sm">Email</Label>
                    <Input value={b?.owner?.links?.email ?? ''} onChange={(e) => setBrandOwnerLink('email', e.target.value || null)} placeholder="hello@pointsevenstudio.com" />
                  </div>
                  <div>
                    <Label className="block text-sm">GitHub</Label>
                    <Input value={b?.owner?.links?.github ?? ''} onChange={(e) => setBrandOwnerLink('github', e.target.value || null)} placeholder="https://github.com/your-handle" />
                  </div>
                  <div>
                    <Label className="block text-sm">LinkedIn</Label>
                    <Input value={b?.owner?.links?.linkedin ?? ''} onChange={(e) => setBrandOwnerLink('linkedin', e.target.value || null)} placeholder="https://www.linkedin.com/in/..." />
                  </div>
                  <div>
                    <Label className="block text-sm">Twitter / X</Label>
                    <Input value={b?.owner?.links?.twitter ?? ''} onChange={(e) => setBrandOwnerLink('twitter', e.target.value || null)} placeholder="https://x.com/..." />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Owner Bio'}</Button>
            </div>
          </div>

          {/* Danger Zone */}
          {isPlatformAdmin && (
            <div className="mt-8 rounded-lg border border-red-900/40 bg-red-950/40 p-4">
              <h2 className="text-red-300 font-semibold">Danger Zone</h2>
              <p className="text-red-200/80 text-sm mt-1">
                Deleting <b>{selFromApi.name}</b> (<code>{selFromApi.slug}</code>) is permanent.
              </p>
              <div className="mt-3 text-sm text-red-100/80">
                <div className="flex gap-6">
                  <div>Templates: <b>{stats?.templates ?? '—'}</b></div>
                  <div>Domains: <b>{stats?.domains ?? '—'}</b></div>
                  <div>Members: <b>{stats?.members ?? '—'}</b></div>
                </div>
                <p className="mt-2">You must remove or transfer all templates before deletion.</p>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-red-200/80 mb-1">Type the slug (<code>{selFromApi.slug}</code>)</label>
                  <Input value={confirmSlug} onChange={(e) => setConfirmSlug(e.target.value)} placeholder={selFromApi.slug} className="border-red-900/60 bg-red-950/40" />
                </div>
                <div>
                  <label className="block text-xs text-red-200/80 mb-1">Type <code>DELETE</code></label>
                  <Input value={confirmDeleteWord} onChange={(e) => setConfirmDeleteWord(e.target.value)} placeholder="DELETE" className="border-red-900/60 bg-red-950/40" />
                </div>
                <div className="flex items-end">
                  <Button variant="destructive" disabled={deleting} onClick={deleteOrg} className="w-full">
                    {deleting ? 'Deleting…' : 'Delete Organization'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-sm text-zinc-400">No organization loaded.</div>
      )}
    </div>
  );
}
