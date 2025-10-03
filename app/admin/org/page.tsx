// app/admin/org/page.tsx
'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { useOrg } from '@/app/providers';
import { supabase } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import OrgDomainPanel from '@/components/admin/org/OrgDomainPanel';

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
  bio?: string | null; // plain text; split on blank lines when rendering
  links?: BrandingOwnerLinks | null;
};

type Branding = {
  name?: string; // Display brand ("QuickSites" | "CedarSites")
  domain?: string; // Public domain for footer/title
  logoUrl?: string | null; // optional overrides (you already have logo fields separately too)
  darkLogoUrl?: string | null;
  faviconUrl?: string | null;
  colors?: { gradient?: string[]; primary?: string };
  hero?: { headline?: string; subhead?: string };
  copy?: { featuresTitle?: string; featuresSubtitle?: string };
  flags?: BrandingFlags;
  // NEW: optional owner bio section (rendered on org homepage if present)
  owner?: BrandingOwner | null;
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

  branding?: Branding | null;

  primary_domain?: string | null;
  wildcard_enabled?: boolean | null;
  canonical_host?: string | null;
};

type OrgStats = {
  templates: number;
  domains: number;
  members: number;
};

const STORAGE_BUCKET =
  process.env.NEXT_PUBLIC_ORG_ASSETS_BUCKET?.trim() || 'logos';

/* ---------------- Reusable upload field ---------------- */
function UploadField({
  label,
  value,
  onChange,
  orgId,
  orgSlug,
  tag, // 'logo' | 'logo-dark' | 'favicon' | 'owner-photo'
  accept = 'image/*',
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
      if (ct.includes('application/json')) {
        payload = await res.json();
      } else {
        rawText = await res.text();
        try { payload = JSON.parse(rawText); } catch {}
      }

      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('Upload endpoint not found. Create app/api/admin/org/upload/route.ts and restart the dev server.');
        }
        const msg =
          payload?.error ||
          payload?.message ||
          rawText ||
          `Upload failed (HTTP ${res.status})`;

        if (res.status === 413 || /body exceeded|too large/i.test(msg)) {
          throw new Error('Upload too large for server setting. Increase next.config serverActions.bodySizeLimit or upload a smaller image.');
        }
        throw new Error(msg);
      }

      const url: string | null =
        payload?.url ?? payload?.signedUrl ?? payload?.data?.signedUrl ?? null;

      onChange(url);
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
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="max-w-full max-h-full object-contain" />
          ) : (
            <span className="text-xs text-zinc-500">No image</span>
          )}
        </div>

        <div className="flex-1 grid grid-cols-2 gap-2">
          <Input
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value || null)}
            placeholder="https://…/image.png"
            className="col-span-2"
          />

          <input
            ref={inputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={handleFileChange}
          />

          <div className="col-span-2 flex items-center gap-2">
            <Button type="button" onClick={pickFile} disabled={uploading}>
              {uploading ? 'Uploading…' : 'Upload / Replace'}
            </Button>

            <Button
              type="button"
              variant="secondary"
              disabled={!value}
              onClick={() => value && window.open(value, '_blank')}
            >
              Open
            </Button>

            <Button
              type="button"
              variant="outline"
              disabled={!value}
              onClick={() => onChange(null)}
            >
              Remove
            </Button>
          </div>

          {error && <div className="col-span-2 text-xs text-red-400 whitespace-pre-wrap">{error}</div>}

          <div className="col-span-2 text-[11px] text-zinc-500">
            Accepted: PNG, JPG, SVG, WebP, ICO (≤ 5MB). Uploaded securely to your Storage bucket.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ========================================================================== */

export default function OrgSettings() {
  const current = useOrg(); // current org from resolver/provider
  const [isPlatformAdmin, setIsPlatformAdmin] = useState<boolean>(false);

  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [selectedId, setSelectedId] = useState<string>(current.id);

  // Editable fields
  const sel = useMemo(() => orgs.find((o) => o.id === selectedId), [orgs, selectedId]);
  const [draft, setDraft] = useState<Partial<OrgRow>>({});

  // Danger zone UI
  const [stats, setStats] = useState<OrgStats | null>(null);
  const [confirmSlug, setConfirmSlug] = useState('');
  const [confirmDeleteWord, setConfirmDeleteWord] = useState('');
  const [deleting, setDeleting] = useState(false);

  // 🔹 NEW: copy helper + tiny toast state
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(null), 1200);
    } catch {
      // no-op
    }
  };

  useEffect(() => {
    if (sel) {
      setDraft({
        name: sel.name,
        slug: sel.slug,
        logo_url: sel.logo_url ?? '',
        dark_logo_url: sel.dark_logo_url ?? '',
        favicon_url: sel.favicon_url ?? '',
        support_email: sel.support_email ?? '',
        support_url: sel.support_url ?? '',
        billing_mode: sel.billing_mode ?? 'central',
        branding: sel.branding ?? {
          // sensible defaults so QuickSites continues to look the same
          name: sel.slug === 'quicksites' ? 'QuickSites' : sel.name,
          domain: sel.slug === 'quicksites' ? 'QuickSites.ai' : undefined,
          flags: { showPuppyWidget: sel.slug === 'quicksites', showGlow: true, showMobileWidget: true, showMobileGradients: true, forceWidgetVariant: 'puppy' },
          hero: { headline: 'Your Website. One Click Away.', subhead: 'Turn your local business into a digital presence in minutes. No code. No hassle.' },
          copy: { featuresTitle: 'Featured demos', featuresSubtitle: `Hand-picked highlights from what ${(sel.slug === 'quicksites' ? 'QuickSites' : 'your brand')} can do.` },
          owner: null,
        } as Branding,
      });
      fetchStats(sel.id);
      setConfirmSlug('');
      setConfirmDeleteWord('');
    } else {
      setStats(null);
    }
  }, [sel?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Determine platform admin (uses your admin_users table)
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

  // Load orgs
  useEffect(() => {
    (async () => {
      try {
        if (isPlatformAdmin) {
          // ⚠️ Ensure your organizations_public view includes the branding column.
          const { data } = await supabase
            .from('organizations_public')
            .select('id, slug, name, logo_url, dark_logo_url, favicon_url, support_email, support_url, billing_mode, branding, primary_domain, wildcard_enabled, canonical_host')
            .order('name', { ascending: true });
          setOrgs((data ?? []) as OrgRow[]);
          if (data && data.length && !data.some((o: any) => o.id === selectedId)) {
            setSelectedId((data[0] as any).id);
          }
        } else {
          // Regular org admin – only current org
          setOrgs([
            {
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
            },
          ]);
          setSelectedId(current.id);
        }
      } catch {
        // ignore
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlatformAdmin, current.id]);

  const onField =
    (k: keyof OrgRow) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setDraft((d) => ({ ...d, [k]: e.target.value }));

  // Small helpers for nested branding editing
  function setBranding<K extends keyof Branding>(key: K, value: Branding[K]) {
    setDraft((d) => ({ ...d, branding: { ...(d.branding as Branding || {}), [key]: value } }));
  }
  function setBrandFlag<K extends keyof BrandingFlags>(key: K, value: BrandingFlags[K]) {
    setDraft((d) => ({
      ...d,
      branding: {
        ...(d.branding as Branding || {}),
        flags: { ...((d.branding as Branding)?.flags || {}), [key]: value },
      },
    }));
  }
  function setBrandHero<K extends keyof NonNullable<Branding['hero']>>(key: K, value: NonNullable<Branding['hero']>[K]) {
    setDraft((d) => ({
      ...d,
      branding: {
        ...(d.branding as Branding || {}),
        hero: { ...((d.branding as Branding)?.hero || {}), [key]: value },
      },
    }));
  }
  function setBrandCopy<K extends keyof NonNullable<Branding['copy']>>(key: K, value: NonNullable<Branding['copy']>[K]) {
    setDraft((d) => ({
      ...d,
      branding: {
        ...(d.branding as Branding || {}),
        copy: { ...((d.branding as Branding)?.copy || {}), [key]: value },
      },
    }));
  }

  // NEW: owner setters
  function setBrandOwner<K extends keyof NonNullable<Branding['owner']>>(key: K, value: NonNullable<Branding['owner']>[K]) {
    setDraft((d) => ({
      ...d,
      branding: {
        ...(d.branding as Branding || {}),
        owner: { ...((d.branding as Branding)?.owner || {}), [key]: value },
      },
    }));
  }
  function setBrandOwnerLink<K extends keyof BrandingOwnerLinks>(key: K, value: BrandingOwnerLinks[K]) {
    setDraft((d) => {
      const cur = (d.branding as Branding)?.owner?.links || {};
      return {
        ...d,
        branding: {
          ...(d.branding as Branding || {}),
          owner: { ...((d.branding as Branding)?.owner || {}), links: { ...cur, [key]: value } },
        },
      };
    });
  }

  async function fetchStats(orgId: string) {
    try {
      const res = await fetch(`/api/admin/org/update?org_id=${encodeURIComponent(orgId)}&stats=1`);
      const j = await res.json();
      if (res.ok) setStats(j as OrgStats);
      else setStats(null);
    } catch {
      setStats(null);
    }
  }

  async function save() {
    if (!sel) return;
    const updates: Partial<OrgRow> = {
      name: (draft.name ?? '').trim(),
      slug: (draft.slug ?? '').trim(),
      logo_url: (draft.logo_url ?? '').trim() || null,
      dark_logo_url: (draft.dark_logo_url ?? '').trim() || null,
      favicon_url: (draft.favicon_url ?? '').trim() || null,
      support_email: (draft.support_email ?? '').trim() || null,
      support_url: (draft.support_url ?? '').trim() || null,
      billing_mode: (draft.billing_mode as any) ?? 'central',
      branding: draft.branding || null,
    };

    try {
      if (isPlatformAdmin) {
        const res = await fetch('/api/admin/org/update', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: sel.id, updates }),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j?.error || 'Save failed');
      } else {
        const { error } = await supabase.from('organizations').update(updates).eq('id', sel.id);
        if (error) throw error as any;
      }
      location.reload();
    } catch (err: any) {
      alert(err?.message || 'Save failed');
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
        body: JSON.stringify({
          action: 'create',
          values: { name, slug },
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Create failed');
      const url = new URL(window.location.href);
      url.searchParams.set('org', slug);
      window.location.assign(url.toString());
    } catch (err: any) {
      alert(err?.message || 'Create failed');
    }
  }

  function switchToSelected() {
    if (!sel) return;
    const url = new URL(window.location.href);
    url.searchParams.set('org', sel.slug);
    window.location.assign(url.toString());
  }

  const canDelete =
    !!sel &&
    isPlatformAdmin &&
    !!stats &&
    stats.templates === 0 &&
    confirmSlug.trim() === sel.slug &&
    confirmDeleteWord.trim().toUpperCase() === 'DELETE';

  async function deleteOrg() {
    if (!sel) return;
    if (!canDelete) return;
    try {
      setDeleting(true);
      const res = await fetch('/api/admin/org/update', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          id: sel.id,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Delete failed');
      const fallback = 'quicksites';
      const url = new URL(window.location.href);
      url.searchParams.set('org', sel.slug === current.slug ? fallback : current.slug);
      window.location.assign(url.toString());
    } catch (e: any) {
      alert(e?.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }

  const b = (draft.branding || {}) as Branding;

  // 🔹 NEW: compute dev URLs for quick testing
  const devHost = sel ? `${sel.slug}.localhost:3000` : '';
  const devUrl = sel ? `http://${devHost}/` : '';
  const devOrgRoute = sel ? `http://localhost:3000/orgs/${sel.slug}` : '';
  const devWwwHost = sel ? `www.${sel.slug}.localhost:3000` : '';
  const devWwwUrl = sel ? `http://${devWwwHost}/` : '';

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
            <Button variant="outline" onClick={switchToSelected}>
              Switch to this org
            </Button>
            <Button variant="outline" onClick={() => sel && fetchStats(sel.id)}>
              Refresh stats
            </Button>
          </div>

          {/* 🔹 NEW: Developer Test Links */}
          {sel && (
            <div className="mt-4 rounded-lg border border-zinc-700 bg-zinc-900/40 p-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Developer Test Links (localhost)</h3>
                {copied && (
                  <span className="text-[11px] text-emerald-400">
                    Copied: <code>{copied}</code>
                  </span>
                )}
              </div>

              <div className="mt-2 grid gap-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-36 text-zinc-400">Org domain:</span>
                  <code className="px-2 py-1 rounded bg-zinc-950/60 border border-zinc-800">{devUrl}</code>
                  <Button size="sm" variant="outline" onClick={() => copy(devUrl)}>Copy</Button>
                  <a href={devUrl} target="_blank" rel="noreferrer">
                    <Button size="sm">Open</Button>
                  </a>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-36 text-zinc-400">Org domain (www):</span>
                  <code className="px-2 py-1 rounded bg-zinc-950/60 border border-zinc-800">{devWwwUrl}</code>
                  <Button size="sm" variant="outline" onClick={() => copy(devWwwUrl)}>Copy</Button>
                  <a href={devWwwUrl} target="_blank" rel="noreferrer">
                    <Button size="sm">Open</Button>
                  </a>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-36 text-zinc-400">Direct org route:</span>
                  <code className="px-2 py-1 rounded bg-zinc-950/60 border border-zinc-800">{devOrgRoute}</code>
                  <Button size="sm" variant="outline" onClick={() => copy(devOrgRoute)}>Copy</Button>
                  <a href={devOrgRoute} target="_blank" rel="noreferrer">
                    <Button size="sm">Open</Button>
                  </a>
                </div>
              </div>
              <p className="mt-2 text-[11px] text-zinc-500">
                These links assume your middleware maps org domains to <code>/orgs/{'{slug}'}</code> and that
                you’ve added <code>{'{slug}'}.localhost</code> to <code>ORG_DOMAINS</code> for dev.
              </p>
            </div>
          )}
        </div>
      )}

      {sel ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* ---------------- General org profile ---------------- */}
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

            {/* ---------------- Logos / favicon ---------------- */}
            <div className="space-y-4">
              <UploadField
                label="Logo (light UI)"
                value={draft.logo_url as string}
                onChange={(u) => setDraft((d) => ({ ...d, logo_url: u ?? '' }))}
                orgId={sel.id}
                orgSlug={sel.slug}
                tag="logo"
              />
              <UploadField
                label="Logo (dark UI)"
                value={draft.dark_logo_url as string}
                onChange={(u) => setDraft((d) => ({ ...d, dark_logo_url: u ?? '' }))}
                orgId={sel.id}
                orgSlug={sel.slug}
                tag="logo-dark"
              />
              <UploadField
                label="Favicon"
                value={draft.favicon_url as string}
                onChange={(u) => setDraft((d) => ({ ...d, favicon_url: u ?? '' }))}
                orgId={sel.id}
                orgSlug={sel.slug}
                tag="favicon"
                accept="image/png,image/x-icon,image/svg+xml,image/webp"
              />

              <div className="pt-1">
                <Button onClick={save}>Save</Button>
              </div>

              <OrgDomainPanel
                orgId={sel.id}
                orgSlug={sel.slug}
                initialDomain={(sel as any).primary_domain || ''}
                initialWildcard={Boolean((sel as any).wildcard_enabled)}
                initialCanonical={((sel as any).canonical_host ?? 'www')}
              />
            </div>
          </div>

          {/* ---------------- Branding (white-label) ---------------- */}
          <div className="mt-10 rounded-lg border border-zinc-700 p-4 bg-zinc-900/40">
            <h2 className="text-lg font-semibold mb-2">Branding (White-Label)</h2>
            <p className="text-xs text-zinc-400 mb-4">
              Configure the public marketing experience for this organization (logo, name, hero copy, and widget/glow toggles).
              These values power the homepage and related marketing pages when requests are served on this org’s domain.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="block text-sm">Brand Display Name</label>
                <Input
                  value={b.name ?? ''}
                  onChange={(e) => setBranding('name', e.target.value)}
                  placeholder="QuickSites or CedarSites"
                />

                <label className="block text-sm">Public Domain (footer/title)</label>
                <Input
                  value={b.domain ?? ''}
                  onChange={(e) => setBranding('domain', e.target.value)}
                  placeholder="QuickSites.ai or CedarSites.com"
                />

                <label className="block text-sm">Hero Headline</label>
                <Input
                  value={b.hero?.headline ?? ''}
                  onChange={(e) => setBrandHero('headline', e.target.value)}
                  placeholder="Your Website. One Click Away."
                />

                <label className="block text-sm">Hero Subhead</label>
                <Input
                  value={b.hero?.subhead ?? ''}
                  onChange={(e) => setBrandHero('subhead', e.target.value)}
                  placeholder="Turn your local business into a digital presence in minutes…"
                />
              </div>

              <div className="space-y-3">
                <label className="block text-sm">Features Section Title</label>
                <Input
                  value={b.copy?.featuresTitle ?? ''}
                  onChange={(e) => setBrandCopy('featuresTitle', e.target.value)}
                  placeholder="Featured demos"
                />

                <label className="block text-sm">Features Section Subtitle</label>
                <Input
                  value={b.copy?.featuresSubtitle ?? ''}
                  onChange={(e) => setBrandCopy('featuresSubtitle', e.target.value)}
                  placeholder="Hand-picked highlights from what CedarSites can do."
                />

                <div className="mt-2 grid grid-cols-1 gap-3 rounded-md border border-zinc-700 p-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm">Show Glow/Gradients</label>
                    <Switch
                      checked={!!b.flags?.showGlow}
                      onCheckedChange={(v) => setBrandFlag('showGlow', !!v)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm">Show Puppy Widget</label>
                    <Switch
                      checked={!!b.flags?.showPuppyWidget}
                      onCheckedChange={(v) => setBrandFlag('showPuppyWidget', !!v)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm">Allow Widget on Mobile</label>
                    <Switch
                      checked={b.flags?.showMobileWidget ?? true}
                      onCheckedChange={(v) => setBrandFlag('showMobileWidget', !!v)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm">Allow Gradients on Mobile</label>
                    <Switch
                      checked={b.flags?.showMobileGradients ?? true}
                      onCheckedChange={(v) => setBrandFlag('showMobileGradients', !!v)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Widget Variant (optional)</label>
                    <Input
                      value={b.flags?.forceWidgetVariant ?? 'puppy'}
                      onChange={(e) => setBrandFlag('forceWidgetVariant', e.target.value || null)}
                      placeholder="puppy"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <Button onClick={save}>Save Branding</Button>
            </div>
          </div>

          {/* ---------------- Owner Bio (optional) ---------------- */}
          <div className="mt-10 rounded-lg border border-zinc-700 p-4 bg-zinc-900/40">
            <h2 className="text-lg font-semibold mb-2">Owner Bio (optional)</h2>
            <p className="text-xs text-zinc-400 mb-4">
              Add a founder/owner section that appears at the bottom of the org homepage. Plain text is recommended;
              paragraphs are split on blank lines.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Photo */}
              <div className="md:col-span-1">
                <UploadField
                  label="Headshot / Photo"
                  value={(b.owner?.photoUrl ?? '') as string}
                  onChange={(u) => setBrandOwner('photoUrl', u ?? null)}
                  orgId={sel.id}
                  orgSlug={sel.slug}
                  tag="owner-photo"
                  accept="image/png,image/jpeg,image/webp,image/avif,image/svg+xml"
                />
              </div>

              {/* Textual fields */}
              <div className="md:col-span-2 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="block text-sm">Owner Name</Label>
                    <Input
                      value={b.owner?.name ?? ''}
                      onChange={(e) => setBrandOwner('name', e.target.value)}
                      placeholder="Sandon Jurowski"
                    />
                  </div>
                  <div>
                    <Label className="block text-sm">Title</Label>
                    <Input
                      value={b.owner?.title ?? ''}
                      onChange={(e) => setBrandOwner('title', e.target.value)}
                      placeholder="Founder, Point Seven Studio"
                    />
                  </div>
                </div>

                <div>
                  <Label className="block text-sm">Short Bio (plain text)</Label>
                  <Textarea
                    rows={6}
                    value={b.owner?.bio ?? ''}
                    onChange={(e) => setBrandOwner('bio', e.target.value)}
                    placeholder={`I build fast, pragmatic software—SaaS, e-commerce, and AI features.\n\nPreviously @ ...`}
                  />
                  <p className="mt-1 text-[11px] text-zinc-500">
                    Tip: use a blank line to start a new paragraph.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="block text-sm">Website</Label>
                    <Input
                      value={b.owner?.links?.website ?? ''}
                      onChange={(e) => setBrandOwnerLink('website', e.target.value || null)}
                      placeholder="https://pixblaze.com"
                    />
                  </div>
                  <div>
                    <Label className="block text-sm">Email</Label>
                    <Input
                      value={b.owner?.links?.email ?? ''}
                      onChange={(e) => setBrandOwnerLink('email', e.target.value || null)}
                      placeholder="hello@pointsevenstudio.com"
                    />
                  </div>
                  <div>
                    <Label className="block text-sm">GitHub</Label>
                    <Input
                      value={b.owner?.links?.github ?? ''}
                      onChange={(e) => setBrandOwnerLink('github', e.target.value || null)}
                      placeholder="https://github.com/your-handle"
                    />
                  </div>
                  <div>
                    <Label className="block text-sm">LinkedIn</Label>
                    <Input
                      value={b.owner?.links?.linkedin ?? ''}
                      onChange={(e) => setBrandOwnerLink('linkedin', e.target.value || null)}
                      placeholder="https://www.linkedin.com/in/..."
                    />
                  </div>
                  <div>
                    <Label className="block text-sm">Twitter / X</Label>
                    <Input
                      value={b.owner?.links?.twitter ?? ''}
                      onChange={(e) => setBrandOwnerLink('twitter', e.target.value || null)}
                      placeholder="https://x.com/..."
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <Button onClick={save}>Save Owner Bio</Button>
            </div>
          </div>

          {/* ---------------- Danger Zone ---------------- */}
          {isPlatformAdmin && (
            <div className="mt-8 rounded-lg border border-red-900/40 bg-red-950/40 p-4">
              <h2 className="text-red-300 font-semibold">Danger Zone</h2>
              <p className="text-red-200/80 text-sm mt-1">
                Deleting <b>{sel.name}</b> (<code>{sel.slug}</code>) is permanent. This action cannot be undone.
              </p>
              <div className="mt-3 text-sm text-red-100/80">
                <div className="flex gap-6">
                  <div>Templates: <b>{stats?.templates ?? '—'}</b></div>
                  <div>Domains: <b>{stats?.domains ?? '—'}</b></div>
                  <div>Members: <b>{stats?.members ?? '—'}</b></div>
                </div>
                <p className="mt-2">
                  You must remove or transfer all templates before deletion. Domains and members will be removed automatically.
                </p>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-red-200/80 mb-1">
                    Type the slug (<code>{sel.slug}</code>)
                  </label>
                  <Input
                    value={confirmSlug}
                    onChange={(e) => setConfirmSlug(e.target.value)}
                    placeholder={sel.slug}
                    className="border-red-900/60 bg-red-950/40"
                  />
                </div>
                <div>
                  <label className="block text-xs text-red-200/80 mb-1">
                    Type <code>DELETE</code>
                  </label>
                  <Input
                    value={confirmDeleteWord}
                    onChange={(e) => setConfirmDeleteWord(e.target.value)}
                    placeholder="DELETE"
                    className="border-red-900/60 bg-red-950/40"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    variant="destructive"
                    disabled={!canDelete || deleting}
                    onClick={deleteOrg}
                    className="w-full"
                    title={
                      stats?.templates
                        ? 'Delete blocked: templates must be 0.'
                        : 'Delete this organization'
                    }
                  >
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
