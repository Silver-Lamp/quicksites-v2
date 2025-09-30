'use client';

/**
 * Domain Panel (programmatic Vercel connect + verify + remove)
 * - Preference: www is primary; apex 307-redirects to www
 * - Requires API routes:
 *    - POST /api/domains/connect   { domain: string, redirectToWWW?: boolean, autoConfigure?: boolean | 'detect' }
 *    - POST /api/domains/verify    { domain: string }      // domain = primary (www.example.com)
 *    - POST /api/domains/remove    { domain: string }      // domain = apex (example.com)
 *    - POST /api/templates/[id]/custom-domain { custom_domain: string | null } // persists via RPC + syncs published_sites
 */

import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import Collapsible from '@/components/ui/collapsible-panel';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import DomainInstructions from '@/components/admin/domain-instructions';
import type { Template } from '@/types/template';
import { supabase } from '@/lib/supabase/client';
import { Copy, Loader2, CheckCircle2, AlertTriangle, RefreshCcw, Trash2 } from 'lucide-react';
import { useVerifyDomain } from '@/hooks/useVerifyDomain';

/* -------------------- utils -------------------- */
function sanitizeSlug(base: string) {
  return String(base || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .trim();
}
function uniqueSuffix() {
  return Math.random().toString(36).slice(2, 6);
}
function randomSlug(base: string) {
  const s = sanitizeSlug(base || 'site');
  return s ? `${s}-${uniqueSuffix()}` : `site-${uniqueSuffix()}`;
}

// Ensure anything we render inside <code>…</code> is a string (never an object)
function inlineText(x: any): string {
  if (x == null) return '';
  const t = typeof x;
  if (t === 'string' || t === 'number' || t === 'boolean') return String(x);
  if (t === 'object') {
    const cand = (x as any).value ?? (x as any).name ?? (x as any).domain ?? null;
    if (cand != null) return String(cand);
    try { return JSON.stringify(x); } catch { return '[object]'; }
  }
  return String(x);
}

// Flatten Vercel responses into a string list (handles arrays, {rank,value}, nested arrays, etc.)
function flattenToStrings(input: any): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (v: any) => {
    if (v == null) return;
    if (Array.isArray(v)) { v.forEach(add); return; }
    const t = typeof v;
    if (t === 'string' || t === 'number' || t === 'boolean') {
      const s = String(v).trim();
      if (s && !seen.has(s)) { seen.add(s); out.push(s); }
      return;
    }
    if (t === 'object') {
      if ('value' in v) { add((v as any).value); return; }
      if ('values' in v) { add((v as any).values); return; }
      const s = inlineText(v);
      if (s && !seen.has(s)) { seen.add(s); out.push(s); }
    }
  };
  add(input);
  return out;
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {}
}

const DOMAIN_RX = /^([a-z0-9-]+\.)+[a-z]{2,}$/i;
const stripProto = (d: string) => d.replace(/^https?:\/\//i, '');
const stripTrailingDot = (d: string) => d.replace(/\.$/, '');
const stripWww = (d: string) => d.replace(/^www\./i, '');
const normalizeApex = (d: string) =>
  stripTrailingDot(stripWww(stripProto(String(d || '').trim().toLowerCase())));

/* Tolerant POST helper that always returns JSON-shaped data */
async function postJson<T = any>(url: string, body: any): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const text = await res.text();
  let json: any;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { ok: false, error: text || `HTTP ${res.status}` };
  }
  if (!res.ok || json?.ok === false) {
    throw new Error(json?.error || `HTTP ${res.status}`);
  }
  return json as T;
}

/* -------------------- types -------------------- */
type ConnectResponse = {
  ok: boolean;
  primary: string;
  redirectFrom: string;
  verified: boolean;
  verification?: Array<{ type: any; domain: any; value: any }>;
  recommended?: { ipv4?: any; cname?: any };
  next?: { verifyEndpoint: string; method: string; body: { domain: string } } | null;
  error?: string;
  autoConfigured?: { provider: 'namecheap'; applied: boolean; reason?: string };
};

/* -------------------- component -------------------- */
export default function DomainPanel({
  template,
  isSite: isSiteProp,
  onChange,
  variant,
}: {
  template: Template;
  isSite?: boolean;
  onChange?: (patch: Partial<Template>) => void;
  variant?: 'inline' | 'drawer';
}) {
  const doChange = onChange ?? (() => {});

  /* ---- Slug editor state ---- */
  const siteTitle = useMemo(
    () => String((template?.data as any)?.meta?.siteTitle ?? template?.template_name ?? ''),
    [template]
  );

  const [locked, setLocked] = useState(false);
  const [manuallyEdited, setManuallyEdited] = useState(
    () => Boolean(template.slug && template.slug !== 'untitled')
  );
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-suggest slug
  useEffect(() => {
    if (!onChange) return;
    if (!locked && !manuallyEdited) {
      const suggested = sanitizeSlug(siteTitle);
      if (suggested && suggested !== template.slug) doChange({ slug: suggested });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteTitle, locked, manuallyEdited]);

  // Validate + uniqueness check (checks templates.slug + published_sites.domain)
  useEffect(() => {
    const slug = template.slug || '';
    const rx = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!slug) {
      setError('Slug is required');
      return;
    }
    if (!rx.test(slug)) {
      setError('Slug must be lowercase letters, numbers and dashes (e.g. roof-cleaning)');
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        setChecking(true);
        // 1) same slug on a different template?
        const { data: tHits } = await supabase
          .from('templates')
          .select('id')
          .eq('slug', slug)
          .neq('id', template.id);

        // 2) domain collision on platform subdomain?
        const platformDomain = `${slug}.quicksites.ai`;
        const { data: psHits } = await supabase
          .from('published_sites')
          .select('id')
          .ilike('domain', platformDomain);

        const taken = (tHits?.length ?? 0) > 0 || (psHits?.length ?? 0) > 0;
        setError(taken ? `Slug is taken. Suggested: ${slug}-${uniqueSuffix()}` : null);
      } catch {
        setError(null);
      } finally {
        setChecking(false);
      }
    }, 450);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template.slug, template.id]);

  /* ---- URL previews ---- */
  const isSite = isSiteProp ?? !!(template as any)?.is_site;
  const slug = String(template.slug || '').trim();

  // prefer live domain (from /api/templates/state) if present
  const publishedDomain =
    (template as any)?.site?.domain && String((template as any).site.domain).trim()
      ? String((template as any).site.domain).trim()
      : (template as any)?.domain && String((template as any).domain).trim()
      ? String((template as any).domain).trim()
      : null;

  const defaultSubdomain = slug ? `${slug}.quicksites.ai` : 'your-subdomain.quicksites.ai';

  const prodPreview = isSite
    ? `https://${publishedDomain || defaultSubdomain}`
    : `https://quicksites.ai/templates/${slug || 'slug'}`;

  const isDevHost =
    typeof window !== 'undefined' &&
    /(^|\.)(localhost|127\.0\.0\.1|lvh\.me|nip\.io)$/i.test(window.location.hostname);
  const port = typeof window !== 'undefined' ? window.location.port || '3000' : '3000';
  const devSubdomain = slug ? `http://${slug}.localhost:${port}/` : '';
  const devPath = slug ? `http://localhost:${port}/sites/${slug}` : '';

  // Published flag from state (publishedSnapshotId)
  const isPublished = Boolean((template as any)?.publishedSnapshotId);

  /* ---- Domain connect state ---- */
  const initialCustom =
    (template as any)?.custom_domain ||
    (template as any)?.domain ||
    '';

  const [domainInput, setDomainInput] = useState(initialCustom as string);
  const [connectBusy, setConnectBusy] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [connectResp, setConnectResp] = useState<ConnectResponse | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);

  // Auto-configure toggle & last-checked display
  const [autoConfigure, setAutoConfigure] = useState(true);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);

  const apex = normalizeApex(domainInput || '');
  const primary = connectResp?.primary || (apex ? `www.${apex}` : '');

  const onDomainBlur = () => {
    const n = normalizeApex(domainInput || '');
    if (n && n !== domainInput) setDomainInput(n);
  };

  function copyAllRecords() {
    const parts: string[] = [];
    aValues.forEach(ip => parts.push(`A @ ${inlineText(ip)}`));
    cnameValues.forEach(cn => parts.push(`CNAME www ${inlineText(cn)}`));
    void copy(parts.join('\n'));
  }

  /**
   * Persist apex via server route, then refresh /api/templates/state
   * so UI reflects published_sites.domain & normalized state.
   */
  async function persistApex(apexDomain: string | null) {
    try {
      await postJson(`/api/templates/${template.id}/custom-domain`, {
        custom_domain: apexDomain,
      });

      // Refresh template state
      const res = await fetch(`/api/templates/state?id=${encodeURIComponent(template.id)}`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const j = await res.json();
        if (j?.template) {
          // push fresh template object up to parent if possible
          doChange(j.template as Partial<Template>);
        }
      }
    } catch (e) {
      console.warn('persistApex failed', e);
    }
  }

  async function connectDomain() {
    setConnectError(null);
    const d = normalizeApex(domainInput);
    if (!d || !DOMAIN_RX.test(d)) {
      setConnectError('Enter a valid domain like example.com (no https://).');
      return;
    }
    setConnectBusy(true);
    try {
      const json = await postJson<ConnectResponse>('/api/domains/connect', {
        domain: d,
        redirectToWWW: true,
        autoConfigure: autoConfigure ? 'detect' : false,
      });
      setConnectResp(json);
      await persistApex(d); // save to template + sync published_sites.domain (if published)
    } catch (e: any) {
      setConnectError(e?.message || 'Failed to connect domain.');
    } finally {
      setConnectBusy(false);
    }
  }

  async function verifyDomain() {
    if (!primary) return;
    setVerifyBusy(true);
    setConnectError(null);
    try {
      const json = await postJson<{ ok: boolean; verified: boolean }>(
        '/api/domains/verify',
        { domain: primary },
      );
      setConnectResp((prev) => (prev ? { ...prev, verified: !!json?.verified } : prev));
      setLastCheckedAt(Date.now());
    } catch (e: any) {
      setConnectError(e?.message || 'Could not verify yet.');
    } finally {
      setVerifyBusy(false);
    }
  }

  async function removeFromVercel() {
    const d = apex;
    if (!d) {
      setConnectError('Enter a domain first.');
      return;
    }
    const ok = window.confirm(
      `Remove ${d} and www.${d} from your Vercel project?\n\nThis only detaches them in Vercel and does not change your DNS.`,
    );
    if (!ok) return;
    setRemoveBusy(true);
    setConnectError(null);
    try {
      const json = await postJson<{ ok: true }>('/api/domains/remove', { domain: d });
      if (!json?.ok) throw new Error('Failed to remove domain(s).');
      setConnectResp(null);

      // clear on template, refresh state
      await persistApex(null);
      setDomainInput('');
    } catch (e: any) {
      setConnectError(e?.message || 'Remove failed.');
    } finally {
      setRemoveBusy(false);
    }
  }

  // Clear saved domain (doesn't touch Vercel)
  async function clearSavedDomain() {
    try {
      await persistApex(null);
      setDomainInput('');
      setConnectResp(null);
    } catch (e) {
      console.warn('clearSavedDomain failed', e);
    }
  }

  // Normalize recommended DNS records into clean lists
  const aValues = useMemo(() => {
    const raw = (connectResp?.recommended?.ipv4 ?? '76.76.21.21');
    const list = flattenToStrings(raw);
    return list.length ? list : ['76.76.21.21'];
  }, [connectResp?.recommended?.ipv4]);

  const cnameValues = useMemo(() => {
    const raw = (connectResp?.recommended?.cname ?? 'cname.vercel-dns.com');
    const list = flattenToStrings(raw);
    return list.length ? list : ['cname.vercel-dns.com'];
  }, [connectResp?.recommended?.cname]);

  // Toolbar/panel events
  const openVersionsMenu = () => { try { window.dispatchEvent(new CustomEvent('qs:versions:open')); } catch {} };
  const openIdentityPanel = () => {
    try {
      window.dispatchEvent(new CustomEvent('qs:settings:set-open', { detail: true }));
      window.dispatchEvent(new CustomEvent('qs:open-settings-panel', {
        detail: { panel: 'identity', openEditor: true, scroll: true, spotlightMs: 900 } as any,
      }));
    } catch {}
  };

  // Auto-verify polling
  const verifyTarget = connectResp?.primary || (apex ? `www.${apex}` : null);
  const { status: verifyStatus, verified: verifiedNow } = useVerifyDomain(verifyTarget, {
    enabled: !!verifyTarget && !(connectResp?.verified),
    intervalMs: 10_000,
    maxAttempts: 18,
    onVerified: () => {
      setConnectResp(prev => (prev ? { ...prev, verified: true } : prev));
    },
  });
  useEffect(() => {
    if (verifyStatus === 'verifying') setLastCheckedAt(Date.now());
  }, [verifyStatus]);

  return (
    <Collapsible title="URL, Publishing & Domain" id="publishing-domain">
      <div className="space-y-6">
        {/* -------------------- Slug editor -------------------- */}
        <div className="rounded-lg border border-white/10 bg-neutral-900/50 p-3">
          <div className="flex justify-between items-center mb-2">
            <Label>Slug</Label>
            <div className="flex gap-2 items-center text-sm text-muted-foreground">
              <span>Lock Slug</span>
              <Switch checked={locked} onCheckedChange={(v) => setLocked(v)} disabled={isPublished || !onChange} />
            </div>
          </div>

          <Input
            value={template.slug || ''}
            disabled={isPublished || !onChange}
            onChange={(e) => {
              if (!onChange) return;
              const normalized = sanitizeSlug(e.target.value);
              setManuallyEdited(true);
              doChange({ slug: normalized });
            }}
            placeholder="e.g. roof-cleaning"
            className={`bg-gray-800 text-white border ${error ? 'border-red-500' : 'border-gray-700'}`}
          />

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                if (!onChange) return;
                const unique = randomSlug(siteTitle || 'site');
                setManuallyEdited(true);
                doChange({ slug: unique });
              }}
              className="text-xs text-blue-400 underline disabled:opacity-50"
              disabled={!onChange}
            >
              Generate Random Slug
            </button>
            <button
              type="button"
              onClick={() => {
                if (!onChange) return;
                const suggested = sanitizeSlug(siteTitle || '');
                setManuallyEdited(false);
                doChange({ slug: suggested });
              }}
              className="text-xs text-gray-400 underline disabled:opacity-50"
              disabled={!onChange}
            >
              Reset to Suggested
            </button>

            {error?.startsWith('Slug is taken') && onChange && (
              <button
                type="button"
                onClick={() => {
                  const suggestion = error.split(':').pop()?.trim() || randomSlug(siteTitle);
                  doChange({ slug: suggestion });
                  setManuallyEdited(true);
                  setError(null);
                }}
                className="text-xs text-amber-400 underline"
              >
                Use Suggestion
              </button>
            )}
          </div>

          {checking && <p className="text-sm text-yellow-400 mt-2">Checking slug availability…</p>}
          {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
        </div>

        {/* -------------------- URL preview & copies -------------------- */}
        <div className="rounded-lg border border-white/10 bg-neutral-900/50 p-3 text-sm text-white/90">
          <Label className="block text-xs text-white/70 mb-1">Live URL</Label>
          <div className="flex items-center gap-2">
            <code className="rounded bg-neutral-950/70 px-2 py-1">{inlineText(prodPreview)}</code>
            <Button type="button" size="sm" variant="outline" onClick={() => copy(inlineText(prodPreview))}>
              <Copy className="h-4 w-4 mr-1" /> Copy
            </Button>
          </div>

          {isDevHost && slug && (
            <div className="mt-3 grid gap-2">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-white/70 w-28">Dev subdomain</Label>
                <code className="rounded bg-neutral-950/70 px-2 py-1">{inlineText(devSubdomain)}</code>
                <Button type="button" size="sm" variant="outline" onClick={() => copy(inlineText(devSubdomain))}>
                  <Copy className="h-4 w-4 mr-1" /> Copy
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-white/70 w-28">Dev path</Label>
                <code className="rounded bg-neutral-950/70 px-2 py-1">{inlineText(devPath)}</code>
                <Button type="button" size="sm" variant="outline" onClick={() => copy(inlineText(devPath))}>
                  <Copy className="h-4 w-4 mr-1" /> Copy
                </Button>
              </div>
            </div>
          )}

          {!isSite && (
            <p className="mt-2 text-xs text-white/60">
              This template isn’t published as a site yet. Use the <strong>Versions</strong> menu (bottom toolbar) to
              create a snapshot and publish.
            </p>
          )}
        </div>

        {/* -------------------- Connect Custom Domain (Programmatic) -------------------- */}
        <div className="rounded-lg border border-white/10 bg-neutral-900/50 p-3">
          <Label className="block text-xs text-white/70 mb-2">Custom Domain</Label>

          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2 items-center">
              <Input
                value={domainInput}
                onChange={(e) => setDomainInput(e.target.value)}
                onBlur={onDomainBlur}
                placeholder="yourbusiness.com"
                className="bg-gray-800 text-white border border-gray-700"
              />

              {/* CONNECT */}
              <Button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); void connectDomain(); }}
                disabled={connectBusy}
                size="sm"
              >
                {connectBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Connect'}
              </Button>

              {/* VERIFY */}
              {connectResp && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); void verifyDomain(); }}
                  disabled={verifyBusy || verifyStatus === 'verifying'}
                  size="sm"
                >
                  {(verifyBusy || verifyStatus === 'verifying')
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : (<><RefreshCcw className="h-4 w-4 mr-1" /> Verify DNS</>)
                  }
                </Button>
              )}

              {/* REMOVE */}
              <Button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); void removeFromVercel(); }}
                disabled={removeBusy || !apex}
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white"
                title="Detach apex and www from Vercel"
              >
                {removeBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
                Remove from Vercel
              </Button>

              {/* Copy all DNS records */}
              {connectResp && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => copyAllRecords()}
                  title="Copy A and CNAME values"
                >
                  <Copy className="h-4 w-4 mr-1" /> Copy all records
                </Button>
              )}

              {/* Clear saved domain (doesn't touch Vercel) */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); void clearSavedDomain(); }}
                title="Clear saved domain (does not detach in Vercel)"
                className="text-white/70 hover:text-white"
              >
                Clear saved
              </Button>
            </div>

            {/* Auto-configure toggle */}
            <div className="flex items-center gap-2 text-xs text-white/70">
              <Switch checked={autoConfigure} onCheckedChange={setAutoConfigure} />
              <span>Auto-configure DNS (Namecheap)</span>
            </div>

            {connectError && (
              <div className="flex items-start gap-2 text-amber-300 text-sm">
                <AlertTriangle className="h-4 w-4 mt-0.5" />
                <span>{connectError}</span>
              </div>
            )}

            {apex && (
              <p className="text-xs text-white/60">
                Preference: <code>www.{inlineText(apex)}</code> serves the site. <code>{inlineText(apex)}</code> 307-redirects to{' '}
                <code>www.{inlineText(apex)}</code>.
              </p>
            )}

            {connectResp && (
              <div className="mt-2 rounded-md border border-white/10 bg-neutral-950/40 p-3 text-sm text-white/90">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  {connectResp.verified ? (
                    <span className="inline-flex items-center text-emerald-400">
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Verified for <code className="px-1 py-0.5 bg-neutral-900 rounded">https://{inlineText(connectResp.primary)}</code>
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-yellow-300">
                      <AlertTriangle className="h-4 w-4 mr-1" />
                      Pending verification for <code className="px-1 py-0.5 bg-neutral-900 rounded">https://{inlineText(connectResp.primary)}</code>
                    </span>
                  )}
                </div>

                {/* auto-configure result (optional from /connect) */}
                {connectResp?.autoConfigured && (
                  <p className="mt-2 text-xs">
                    Auto-configure:{' '}
                    <span className={connectResp.autoConfigured.applied ? 'text-emerald-400' : 'text-white/70'}>
                      {connectResp.autoConfigured.applied
                        ? 'applied via Namecheap'
                        : `skipped (${connectResp.autoConfigured.reason || 'not supported'})`}
                    </span>
                  </p>
                )}

                {/* verify polling hint */}
                {!connectResp?.verified && verifyTarget && (
                  <p className="mt-1 text-[11px] text-white/60">
                    Checking DNS{verifyStatus === 'verifying' ? '…' : ''}{' '}
                    {lastCheckedAt ? `· last check ${new Date(lastCheckedAt).toLocaleTimeString()}` : null}
                  </p>
                )}

                {/* Recommended DNS */}
                <div className="mt-3">
                  <Label className="text-xs text-white/70">Add these DNS records</Label>

                  {/* A records */}
                  <div className="mt-2 overflow-hidden rounded border border-white/10">
                    <div className="grid grid-cols-[auto_auto_auto_1fr_auto] items-center gap-2 p-2 border-b border-white/10">
                      <span className="text-xs px-1 py-0.5 rounded bg-neutral-900">Type</span><code className="px-1">A</code>
                      <span className="text-xs px-1 py-0.5 rounded bg-neutral-900">Name</span><code className="px-1">@</code>
                      <span className="text-xs text-white/60">Add each value below</span>
                    </div>
                    {aValues.map((ip, i) => (
                      <div key={`a-${i}`} className="grid grid-cols-[auto_auto_auto_1fr_auto] items-center gap-2 p-2 border-t border-white/5">
                        <span className="text-xs text-white/60">Value</span>
                        <span className="text-xs text-white/60 col-span-2"></span>
                        <code className="px-1">{inlineText(ip)}</code>
                        <Button type="button" size="sm" variant="outline" onClick={() => copy(inlineText(ip))}>
                          <Copy className="h-4 w-4 mr-1" /> Copy value
                        </Button>
                      </div>
                    ))}
                  </div>

                  {/* CNAME records */}
                  <div className="mt-3 overflow-hidden rounded border border-white/10">
                    <div className="grid grid-cols-[auto_auto_auto_1fr_auto] items-center gap-2 p-2 border-b border-white/10">
                      <span className="text-xs px-1 py-0.5 rounded bg-neutral-900">Type</span><code className="px-1">CNAME</code>
                      <span className="text-xs px-1 py-0.5 rounded bg-neutral-900">Name</span><code className="px-1">www</code>
                      <span className="text-xs text-white/60">Add one of the values below</span>
                    </div>
                    {cnameValues.map((cn, i) => (
                      <div key={`cn-${i}`} className="grid grid-cols-[auto_auto_auto_1fr_auto] items-center gap-2 p-2 border-t border-white/5">
                        <span className="text-xs text-white/60">Value</span>
                        <span className="text-xs text-white/60 col-span-2"></span>
                        <code className="px-1">{inlineText(cn)}</code>
                        <Button type="button" size="sm" variant="outline" onClick={() => copy(inlineText(cn))}>
                          <Copy className="h-4 w-4 mr-1" /> Copy value
                        </Button>
                      </div>
                    ))}
                  </div>

                  {/* Verification records, if any */}
                  {(connectResp?.verification?.length ?? 0) > 0 && (
                    <div className="mt-3">
                      <Label className="text-xs text-white/70">If prompted, add these verification records</Label>
                      <div className="mt-2 space-y-2">
                        {connectResp!.verification!.map((v, i) => (
                          <div key={`ver-${i}`} className="flex flex-wrap items-center gap-2 rounded border border-white/10 p-2">
                            <span className="text-xs px-1 py-0.5 rounded bg-neutral-900">Type</span>
                            <code className="px-1">{inlineText(v.type)}</code>
                            <span className="text-xs px-1 py-0.5 rounded bg-neutral-900">Name</span>
                            <code className="px-1">{inlineText(v.domain)}</code>
                            <span className="text-xs px-1 py-0.5 rounded bg-neutral-900">Value</span>
                            <code className="px-1 break-all">{inlineText(v.value)}</code>
                            <Button type="button" size="sm" variant="outline" onClick={() => copy(inlineText(v.value))}>
                              <Copy className="h-4 w-4 mr-1" /> Copy value
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!connectResp?.verified && verifyTarget && (
                    <p className="mt-2 text-xs text-white/60">
                      After adding the records, click <em>Verify DNS</em>. Some DNS providers update quickly; others can be slower.
                      We’ll also auto-check every ~10s and flip this to verified once DNS is live.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {!apex && (
            <p className="mt-2 text-xs text-white/60">
              If you don’t have a custom domain yet, you can stay on{' '}
              <code className="rounded bg-neutral-950/70 px-1 py-0.5">{inlineText(defaultSubdomain)}</code>.
            </p>
          )}
        </div>

        {/* -------------------- Workflow steps -------------------- */}
        <div className="rounded-lg border border-white/10 bg-neutral-900/50 p-3 text-sm">
          <Label className="block text-xs text-white/70 mb-2">How to go live</Label>
          <ol className="list-decimal list-inside space-y-1 text-white/90">
            <li><strong>Save</strong> your edits (autosave runs automatically).</li>
            <li>
              Open the <strong>Versions</strong> menu (bottom toolbar) → <em>Create snapshot</em>{' '}
              <span className="text-white/60">(captures the current draft)</span>.{' '}
              <Button type="button" size="sm" variant="ghost" className="ml-1 h-7 px-2" onClick={() => { try { window.dispatchEvent(new CustomEvent('qs:versions:open')); } catch {} }}>
                Open Versions
              </Button>
            </li>
            <li>In <strong>Versions</strong>, select the snapshot → <em>Publish</em>.</li>
            <li>
              Visit your live subdomain:{' '}
              <code className="rounded bg-neutral-950/70 px-1 py-0.5">
                {inlineText(`https://${defaultSubdomain}`)}
              </code>
              .
            </li>
            <li>(Optional) Connect a <strong>custom domain</strong> using the tool above.</li>
          </ol>
        </div>

        {/* -------------------- DNS Help -------------------- */}
        <div className="rounded-lg border border-white/10 bg-neutral-900/50 p-3">
          <Label className="block text-xs text-white/70 mb-2">DNS Help (General)</Label>
          <p className="text-sm text-white/80 mb-2">
            Point your domain to your live site. If you haven’t already set your business address, open{' '}
            <button
              type="button"
              onClick={() => {
                try {
                  window.dispatchEvent(new CustomEvent('qs:settings:set-open', { detail: true }));
                  window.dispatchEvent(new CustomEvent('qs:open-settings-panel', {
                    detail: { panel: 'identity', openEditor: true, scroll: true, spotlightMs: 900 } as any,
                  }));
                } catch {}
              }}
              className="underline text-blue-300 hover:text-blue-200"
              title="Open Template Identity"
            >
              Template Identity
            </button>{' '}
            to set your contact info and branding.
          </p>
          <DomainInstructions domain={apex} />
        </div>

        {/* -------------------- Helpful notes -------------------- */}
        <div className="rounded-lg border border-white/10 bg-neutral-900/50 p-3 text-xs text-white/60 leading-relaxed">
          <ul className="list-disc list-inside space-y-1">
            <li>Publishing is snapshot-based. The live site always reads from a snapshot, not your mutable draft.</li>
            <li>After publishing, SEO and share images are generated from your current metadata. Update title/description in <em>Identity</em> or your SEO panel as needed.</li>
            <li>Favicon and logo live in <code>data.meta</code> (set via the Header/Identity panels).</li>
          </ul>
        </div>
      </div>
    </Collapsible>
  );
}
