// components/admin/templates/domain-panel.tsx
'use client';

/**
 * Domain Panel (programmatic Vercel connect + verify + remove)
 * - Lightweight Unpublish dialog (no shadcn AlertDialog)
 * - Soft vs Hard unpublish
 * - Hydrates publish state from /api/templates/state AND directly from published_sites
 * - Slug input uses local state so it's responsive even if parent onChange is momentarily unavailable
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
import {
  Copy, Loader2, CheckCircle2, AlertTriangle, RefreshCcw, Trash2, Globe,
} from 'lucide-react';
import { useVerifyDomain } from '@/hooks/useVerifyDomain';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

/* -------------------- Lightweight dialog (no external deps) -------------------- */
function ConfirmDialog({
  open,
  title,
  description,
  onClose,
  onConfirm,
  busy = false,
  error,
  mode,
  setMode,
}: {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  onClose: () => void;
  onConfirm: () => void;
  busy?: boolean;
  error?: string | null;
  mode: 'soft' | 'hard';
  setMode: (m: 'soft' | 'hard') => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[1000] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={() => !busy && onClose()} />
      <div className="relative w-full max-w-lg rounded-xl border border-white/10 bg-neutral-900 p-4 shadow-2xl">
        <div className="mb-2">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          {description ? <p className="mt-1 text-sm text-white/70">{description}</p> : null}
        </div>

        <div className="mt-3 space-y-3">
          <Alert className="bg-neutral-950 border-white/10">
            <AlertTitle className="text-amber-300">Heads up</AlertTitle>
            <AlertDescription className="text-white/80">
              <strong>Soft</strong> keeps the <code>published_sites</code> row but clears
              <code> domain</code> and <code> snapshot_id</code> and marks it <code>unpublished</code>.<br />
              <strong>Hard</strong> deletes the row entirely (frees <code>*.quicksites.ai</code> immediately).
            </AlertDescription>
          </Alert>

          <div className="grid gap-2">
            <label className="flex items-start gap-2 rounded-md border border-white/10 p-2">
              <input type="radio" name="unpub-mode" value="soft" checked={mode === 'soft'} onChange={() => setMode('soft')} className="mt-0.5" />
              <div>
                <div className="font-medium text-white">Soft (keep row, clear pointers)</div>
                <p className="text-xs text-white/70">Safer; preserves audit history in <code>published_sites</code>.</p>
              </div>
            </label>
            <label className="flex items-start gap-2 rounded-md border border-white/10 p-2">
              <input type="radio" name="unpub-mode" value="hard" checked={mode === 'hard'} onChange={() => setMode('hard')} className="mt-0.5" />
              <div>
                <div className="font-medium text-white">Hard (delete row)</div>
                <p className="text-xs text-white/70">Immediate cleanup; frees the platform subdomain now.</p>
              </div>
            </label>
          </div>

          {error && (
            <div className="text-amber-300 text-sm flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5" /> {error}
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm unpublish'}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* -------------------- utils -------------------- */
function sanitizeSlug(base: string) {
  return String(base || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').trim();
}
function uniqueSuffix() { return Math.random().toString(36).slice(2, 6); }
function randomSlug(base: string) { const s = sanitizeSlug(base || 'site'); return s ? `${s}-${uniqueSuffix()}` : `site-${uniqueSuffix()}`; }
async function copy(text: string) { try { await navigator.clipboard.writeText(text); } catch {} }
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
function flattenToStrings(input: any): string[] {
  const out: string[] = []; const seen = new Set<string>();
  const add = (v: any) => {
    if (v == null) return;
    if (Array.isArray(v)) { v.forEach(add); return; }
    const t = typeof v;
    if (t === 'string' || t === 'number' || t === 'boolean') {
      const s = String(v).trim(); if (s && !seen.has(s)) { seen.add(s); out.push(s); }
      return;
    }
    if (t === 'object') {
      if ('value' in v) { add((v as any).value); return; }
      if ('values' in v) { add((v as any).values); return; }
      const s = inlineText(v); if (s && !seen.has(s)) { seen.add(s); out.push(s); }
    }
  };
  add(input); return out;
}

const DOMAIN_RX = /^([a-z0-9-]+\.)+[a-z]{2,}$/i;
const stripProto = (d: string) => d.replace(/^https?:\/\//i, '');
const stripTrailingDot = (d: string) => d.replace(/\.$/, '');
const stripWww = (d: string) => d.replace(/^www\./i, '');
const normalizeApex = (d: string) =>
  stripTrailingDot(stripWww(stripProto(String(d || '').trim().toLowerCase())));

/* Tolerant POST helper that always returns JSON-shaped data */
async function postJson<T = any>(url: string, body: any): Promise<T> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' });
  const text = await res.text();
  let json: any;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { ok: false, error: text || `HTTP ${res.status}` }; }
  if (!res.ok || json?.ok === false) throw new Error(json?.error || `HTTP ${res.status}`);
  return json as T;
}

/* API types */
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

/* Snapshot-only publish detector (do NOT trust domain strings) */
function computeIsPublishedFromStateOnly(t: any): boolean {
  const snap =
    t?.publishedSnapshotId ??
    t?.published_snapshot_id ??
    t?.published_version_id ??
    null;
  const flag = Boolean(t?.published);
  return Boolean(snap) || flag;
}

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
  const lastPushedSlugRef = useRef<string>(String(template.slug || ''));
  const lastLocalSaveAtRef = useRef<number>(0);

  // --- base/authority detection ---
  const isVersion = Boolean((template as any)?.is_version);
  const baseSlugKey = ((template as any)?.base_slug ?? null) as string | null;
  const [baseInfo, setBaseInfo] = useState<{ id: string; slug: string } | null>(null);
  const authSlugIdRef = useRef<string | null>(null); // authority (base) id when known

  /* ---- Slug editor state ---- */
  const siteTitle = useMemo(
    () => String((template?.data as any)?.meta?.siteTitle ?? template?.template_name ?? ''),
    [template]
  );

  const [locked, setLocked] = useState(false);
  const [manuallyEdited, setManuallyEdited] = useState(() => Boolean(template.slug && template.slug !== 'untitled'));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // in-flight save guard to avoid repeated PATCH spam
  const saveBusyRef = useRef(false);
  const lastRequestedSlugRef = useRef<string | null>(null);

  // Fetch authority/base row when editing a version; prefer its slug for display
  useEffect(() => {
    let cancelled = false;
    async function loadBase() {
      if (!isVersion || !baseSlugKey) {
        setBaseInfo(null);
        authSlugIdRef.current = null;
        return;
      }
      const { data, error } = await supabase
        .from('templates')
        .select('id, slug')
        .eq('base_slug', baseSlugKey)
        .eq('is_version', false)
        .limit(1)
        .maybeSingle();
      if (!cancelled && !error && data) {
        const baseSlug = String(data.slug || '');
        setBaseInfo({ id: data.id, slug: baseSlug });
        authSlugIdRef.current = data.id;
        setSlugLocal(baseSlug);
        lastPushedSlugRef.current = baseSlug;
      }
    }
    void loadBase();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVersion, baseSlugKey, template.id]);

  // Local slug so typing always responds; when version, prefer authority/base slug if known
  const [slugLocal, setSlugLocal] = useState<string>(String(template.slug || ''));
  useEffect(() => {
    const incoming = String(template.slug || '');
    lastPushedSlugRef.current = incoming;
    if (isVersion) {
      setSlugLocal(baseInfo?.slug ?? incoming);
    } else {
      setSlugLocal(incoming);
      authSlugIdRef.current = String((template as any)?.id || null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template.id, template.slug, isVersion, baseInfo?.slug]);

  // Auto-suggest slug only when empty and not locked/manual
  useEffect(() => {
    if (!locked && !manuallyEdited && !slugLocal) {
      const suggested = sanitizeSlug(siteTitle);
      if (suggested && suggested !== slugLocal) {
        setSlugLocal(suggested);
        lastPushedSlugRef.current = suggested;
        doChange({ slug: suggested });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteTitle, locked, manuallyEdited]);

  const [verifyPollingEnabled, setVerifyPollingEnabled] = useState(false);
  
  /* ---- URL previews ---- */
  const isSite = isSiteProp ?? Boolean((template as any)?.is_site);
  const previewSlug = (isVersion && baseInfo?.slug) ? baseInfo.slug : (slugLocal || 'slug');

  const publishedDomain =
    (template as any)?.site?.domain && String((template as any).site.domain).trim()
      ? String((template as any).site.domain).trim()
      : (template as any)?.domain && String((template as any).domain).trim()
      ? String((template as any).domain).trim()
      : null;

  const defaultSubdomain = previewSlug ? `${previewSlug}.quicksites.ai` : 'your-subdomain.quicksites.ai';

  const prodPreview = isSite
    ? `https://${publishedDomain || defaultSubdomain}`
    : `https://quicksites.ai/templates/${previewSlug}`;

  const isDevHost =
    typeof window !== 'undefined' && /(^|\.)(localhost|127\.0\.0\.1|lvh\.me|nip\.io)$/i.test(window.location.hostname);
  const port = typeof window !== 'undefined' ? window.location.port || '3000' : '3000';
  const devSubdomain = previewSlug ? `http://${previewSlug}.localhost:${port}/` : '';
  const devPath = previewSlug ? `http://localhost:${port}/sites/${previewSlug}` : '';

  /* ---- Published state (robust + hydrated) ---- */
  const [statePublished, setStatePublished] = useState<boolean | null>(null);         // from Truth API (snapshot-only)
  const [publishedRowExists, setPublishedRowExists] = useState<boolean | null>(null); // from published_sites

  const isPublished =
    (publishedRowExists === true)
      ? true
      : (publishedRowExists === false)
        ? false
        : (statePublished ?? computeIsPublishedFromStateOnly(template as any));

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      try {
        const res = await fetch(`/api/templates/state?id=${encodeURIComponent(template.id)}`, { cache: 'no-store' });
        if (res.ok) {
          const j = await res.json();
          const t = j?.template ?? j;
          if (!cancelled && t) {
            const snapPublished = computeIsPublishedFromStateOnly(t);
            setStatePublished(snapPublished);

            // Client-wins for a short window after save; if we are on a version and know the base, prefer base slug.
            const tId = String((t as any).id);
            const incomingSlug = String((t as any).slug || '');
            const justSaved = Date.now() - lastLocalSaveAtRef.current < 5000;
            const editingAuthorityElsewhere = authSlugIdRef.current && tId !== authSlugIdRef.current;

            if (!justSaved) {
              if (editingAuthorityElsewhere) {
                if (baseInfo?.slug) {
                  setSlugLocal(baseInfo.slug);
                  lastPushedSlugRef.current = baseInfo.slug;
                }
              } else {
                setSlugLocal(incomingSlug);
                lastPushedSlugRef.current = incomingSlug;
              }
            }

            // Avoid bubbling slug back up
            const safePatch: Partial<Template> = { ...(t as any) };
            delete (safePatch as any).slug;
            if (onChange) onChange(safePatch);
          }
        }
      } catch {}

      try {
        const { data, error } = await supabase
          .from('published_sites')
          .select('id', { head: false })
          .eq('template_id', template.id)
          .limit(1);
        if (!cancelled) {
          if (error) setPublishedRowExists(null);
          else setPublishedRowExists((data?.length ?? 0) > 0);
        }
      } catch {
        if (!cancelled) setPublishedRowExists(null);
      }
    }

    void hydrate();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template.id, baseInfo?.slug]);

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

  const [autoConfigure, setAutoConfigure] = useState(true);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);

  const apex = normalizeApex(domainInput || '');

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

  const rxSlug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  async function checkAndSaveSlug(current: string) {
    const slug = (current || '').trim();
    if (!slug) { setError('Slug is required'); return; }
    if (!rxSlug.test(slug)) { setError('Slug must be lowercase letters, numbers and dashes'); return; }

    // in-flight & duplicate guards
    if (saveBusyRef.current) return;
    if (slug === lastPushedSlugRef.current) return;
    if (slug === lastRequestedSlugRef.current) return;

    saveBusyRef.current = true;
    lastRequestedSlugRef.current = slug;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/templates/${template.id}/slug`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to save slug');

      lastPushedSlugRef.current = json.slug;
      lastLocalSaveAtRef.current = Date.now();
      // Keep local + base in sync
      setSlugLocal(json.slug);
      if (json?.targetId) authSlugIdRef.current = json.targetId as string;
      setBaseInfo(prev => prev ? { ...prev, slug: json.slug } : prev);

      // Optional: reflect to parent
      doChange?.({ slug: json.slug });
    } catch (e: any) {
      setError(e?.message || 'Failed to save slug');
    } finally {
      setSaving(false);
      saveBusyRef.current = false;
      // keep lastRequestedSlugRef so subsequent identical clicks are ignored briefly
      setTimeout(() => { if (lastRequestedSlugRef.current === slug) lastRequestedSlugRef.current = null; }, 2000);
    }
  }
  

  async function refreshTemplateState() {
    try {
      const res = await fetch(`/api/templates/state?id=${encodeURIComponent(template.id)}`, { cache: 'no-store' });
      if (res.ok) {
        const j = await res.json();
        const t = j?.template ?? j;
        if (t) {
          setStatePublished(computeIsPublishedFromStateOnly(t));

          // Client-wins window & base-preference when editing version
          const tId = String((t as any).id);
          const incomingSlug = String((t as any).slug || '');
          const justSaved = Date.now() - lastLocalSaveAtRef.current < 5000;
          const editingAuthorityElsewhere = authSlugIdRef.current && tId !== authSlugIdRef.current;

          if (!justSaved) {
            if (editingAuthorityElsewhere) {
              if (baseInfo?.slug) {
                setSlugLocal(baseInfo.slug);
                lastPushedSlugRef.current = baseInfo.slug;
              }
            } else {
              setSlugLocal(incomingSlug);
              lastPushedSlugRef.current = incomingSlug;
            }
          }

          const safePatch: Partial<Template> = { ...(t as any) };
          delete (safePatch as any).slug;
          if (onChange) onChange(safePatch);
        }
      }
    } catch {}
    
    try {
      const { data, error } = await supabase
        .from('published_sites')
        .select('id', { head: false })
        .eq('template_id', template.id)
        .limit(1);
      if (!error) setPublishedRowExists((data?.length ?? 0) > 0);
    } catch {}
  }

  /** ---------------- Unpublish dialog state + action ---------------- */
  const [unpubOpen, setUnpubOpen] = useState(false);
  const [unpubBusy, setUnpubBusy] = useState(false);
  const [unpubMode, setUnpubMode] = useState<'soft' | 'hard'>('hard');
  const [unpubError, setUnpubError] = useState<string | null>(null);

  async function doUnpublish(mode: 'soft' | 'hard') {
    setUnpubBusy(true);
    setUnpubError(null);
    try {
      const res = await fetch(`/api/admin/sites/unpublish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ templateId: template.id, mode }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok === false) throw new Error(json?.error || `HTTP ${res.status}`);
      await refreshTemplateState();
      setUnpubOpen(false);
    } catch (e: any) {
      setUnpubError(e?.message || 'Unpublish failed.');
    } finally {
      setUnpubBusy(false);
    }
  }

  /* ---------------- Domain connect helpers ---------------- */
  async function persistApex(apexDomain: string | null) {
    try {
      await postJson(`/api/templates/${template.id}/custom-domain`, { custom_domain: apexDomain });
      await refreshTemplateState();
    } catch (e) { console.warn('persistApex failed', e); }
  }

  async function connectDomain() {
    setConnectError(null);
    const d = normalizeApex(domainInput);
    if (!d || !DOMAIN_RX.test(d)) { setConnectError('Enter a valid domain like example.com (no https://).'); return; }
    setConnectBusy(true);
    try {
      const json = await postJson<ConnectResponse>('/api/domains/connect', {
        domain: d, redirectToWWW: true, autoConfigure: autoConfigure ? 'detect' : false,
      });
      setConnectResp(json as ConnectResponse);
      setVerifyPollingEnabled(true); // <- arm polling only after a real connect
      await persistApex(d);
    } catch (e: any) {
      setConnectError(e?.message || 'Failed to connect domain.');
    } finally { setConnectBusy(false); }
  }
  
  async function verifyDomain() {
    if (!connectResp?.primary) return;
    setVerifyBusy(true);
    setConnectError(null);
    try {
      const json = await postJson<{ ok: boolean; verified: boolean }>('/api/domains/verify', { domain: connectResp.primary });
      setConnectResp((prev) => (prev ? { ...prev, verified: !!json?.verified } : prev));
      setLastCheckedAt(Date.now());
      setVerifyPollingEnabled(true); // ensure polling is armed after manual verify click too
    } catch (e: any) {
      setConnectError(e?.message || 'Could not verify yet.');
    } finally { setVerifyBusy(false); }
  }
  
  async function removeFromVercel() {
    const d = apex;
    if (!d) { setConnectError('Enter a domain first.'); return; }
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
      await persistApex(null);
      setDomainInput('');
    } catch (e: any) {
      setConnectError(e?.message || 'Remove failed.');
    } finally { setRemoveBusy(false); }
  }

  async function clearSavedDomain() {
    try { await persistApex(null); setDomainInput(''); setConnectResp(null); } catch {}
  }

  // Recommended DNS lists
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

  // Auto-verify polling
  const verifyTarget = connectResp?.primary ?? null;

  const { status: verifyStatus } = useVerifyDomain(verifyTarget, {
    enabled: verifyPollingEnabled && !!verifyTarget && !(connectResp?.verified),
    intervalMs: 10_000,
    maxAttempts: 18,
    onVerified: () => {
      setConnectResp(prev => (prev ? { ...prev, verified: true } : prev));
      setVerifyPollingEnabled(false);
    },
  });
  useEffect(() => { if (verifyStatus === 'verifying') setLastCheckedAt(Date.now()); }, [verifyStatus]);
  useEffect(() => {
    // If user starts typing a different domain, stop background checks until they connect again
    setVerifyPollingEnabled(false);
  }, [domainInput]);
  
  return (
    <Collapsible title="URL, Publishing & Domain" id="publishing-domain">
      <div className="space-y-6">
        {/* -------------------- Slug editor + Unpublish -------------------- */}
        <div className="rounded-lg border border-white/10 bg-neutral-900/50 p-3">
          <div className="flex flex-wrap justify-between items-center mb-2 gap-2">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-white/70" />
              <Label>Slug</Label>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-2 items-center text-sm text-muted-foreground">
                <span>Lock Slug</span>
                <Switch checked={locked} onCheckedChange={(v) => setLocked(v)} disabled={isPublished} />
              </div>

              {isPublished && (
                <>
                  <Button variant="destructive" size="sm" onClick={() => setUnpubOpen(true)}>
                    Unpublish
                  </Button>
                  <ConfirmDialog
                    open={unpubOpen}
                    title="Unpublish this site?"
                    description="Unpublishing removes the live pointer so you can safely change the slug and republish."
                    onClose={() => setUnpubOpen(false)}
                    onConfirm={() => void doUnpublish(unpubMode)}
                    busy={unpubBusy}
                    error={unpubError}
                    mode={unpubMode}
                    setMode={setUnpubMode}
                  />
                </>
              )}
            </div>
          </div>

          <Input
            value={slugLocal}
            disabled={isPublished}
            onChange={(e) => {
              const normalized = sanitizeSlug(e.target.value);
              setSlugLocal(normalized);
              setManuallyEdited(true);
            }}
            // ❌ No onBlur save — we only save on Enter or the button
            onKeyDown={(e) => {
              if (!isPublished && e.key === 'Enter') {
                e.preventDefault();
                void checkAndSaveSlug(slugLocal);
              }
            }}
            placeholder="e.g. roof-cleaning"
            className={`bg-gray-800 text-white border ${error ? 'border-red-500' : 'border-gray-700'}`}
          />
          <div className="mt-2 flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => checkAndSaveSlug(slugLocal)}
              disabled={isPublished || saving}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Check & Save'}
            </Button>
            {error && <span className="text-sm text-red-400">{error}</span>}
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                const unique = randomSlug(siteTitle || 'site');
                setSlugLocal(unique);
                setManuallyEdited(true);
                lastPushedSlugRef.current = unique;
                doChange({ slug: unique });
              }}
              className="text-xs text-blue-400 underline disabled:opacity-50"
              disabled={isPublished}
            >
              Generate Random Slug
            </button>
            <button
              type="button"
              onClick={() => {
                const suggested = sanitizeSlug(siteTitle || '');
                setManuallyEdited(false);
                setSlugLocal(suggested);
                lastPushedSlugRef.current = suggested;
                doChange({ slug: suggested });
              }}
              className="text-xs text-gray-400 underline disabled:opacity-50"
              disabled={isPublished}
            >
              Reset to Suggested
            </button>
          </div>

          {isPublished && (
            <p className="text-xs text-white/60 mt-2">
              This template is currently <strong>published</strong> to{' '}
              <code className="bg-neutral-950/70 px-1 py-0.5 rounded">
                {inlineText(publishedDomain || defaultSubdomain)}
              </code>
              . Unpublish to edit the slug.
            </p>
          )}
        </div>

        {/* -------------------- URL preview & copies -------------------- */}
        <div className="rounded-lg border border-white/10 bg-neutral-900/50 p-3 text-sm text-white/90">
          <Label className="block text-xs text-white/70 mb-1">Live URL</Label>
          <div className="flex items-center gap-2">
            <code className="rounded bg-neutral-950/70 px-2 py-1">{inlineText(prodPreview)}</code>
            <Button type="button" size="sm" variant="outline" onClick={() => copy(inlineText(prodPreview))}>
              <Copy className="h-4 w-4 mr-1" /> Copy
            </Button>
            <a href={inlineText(prodPreview)} target="_blank" rel="noopener noreferrer">
              <Button type="button" size="sm" variant="default">Open</Button>
            </a>
          </div>

          {isDevHost && previewSlug && (
            <div className="mt-3 grid gap-2">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-white/70 w-28">Dev subdomain</Label>
                <code className="rounded bg-neutral-950/70 px-2 py-1">{inlineText(devSubdomain)}</code>
                <Button type="button" size="sm" variant="outline" onClick={() => copy(inlineText(devSubdomain))}>
                  <Copy className="h-4 w-4 mr-1" /> Copy
                </Button>
                <a href={inlineText(devSubdomain)} target="_blank" rel="noopener noreferrer">
                  <Button type="button" size="sm" variant="default">Open</Button>
                </a>
              </div>

              <div className="flex items-center gap-2">
                <Label className="text-xs text-white/70 w-28">Dev path</Label>
                <code className="rounded bg-neutral-950/70 px-2 py-1">{inlineText(devPath)}</code>
                <Button type="button" size="sm" variant="outline" onClick={() => copy(inlineText(devPath))}>
                  <Copy className="h-4 w-4 mr-1" /> Copy
                </Button>
                <a href={inlineText(devPath)} target="_blank" rel="noopener noreferrer">
                  <Button type="button" size="sm" variant="default">Open</Button>
                </a>
              </div>
            </div>
          )}

          {!isPublished && (
            <p className="mt-2 text-xs text-white/60">
              This template isn’t published yet. Use the <strong>Versions</strong> menu (bottom toolbar) to create a snapshot and publish.
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

              <Button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); void connectDomain(); }} disabled={connectBusy} size="sm">
                {connectBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Connect'}
              </Button>

              {connectResp && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); void verifyDomain(); }}
                  disabled={verifyBusy || verifyStatus === 'verifying'}
                  size="sm"
                >
                  {(verifyBusy || verifyStatus === 'verifying') ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><RefreshCcw className="h-4 w-4 mr-1" /> Verify DNS</>)}
                </Button>
              )}

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

              {connectResp && (
                <Button type="button" variant="outline" size="sm" onClick={() => copyAllRecords()} title="Copy A and CNAME values">
                  <Copy className="h-4 w-4 mr-1" /> Copy all records
                </Button>
              )}

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
                Preference: <code>www.{inlineText(apex)}</code> serves the site. <code>{inlineText(apex)}</code> 307-redirects to <code>www.{inlineText(apex)}</code>.
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

                {connectResp?.autoConfigured && (
                  <p className="mt-2 text-xs">
                    Auto-configure:{' '}
                    <span className={connectResp.autoConfigured.applied ? 'text-emerald-400' : 'text-white/70'}>
                      {connectResp.autoConfigured.applied ? 'applied via Namecheap' : `skipped (${connectResp.autoConfigured.reason || 'not supported'})`}
                    </span>
                  </p>
                )}

                {!connectResp?.verified && verifyTarget && (
                  <p className="mt-1 text-[11px] text-white/60">
                    Checking DNS{verifyStatus === 'verifying' ? '…' : ''}{' '}
                    {lastCheckedAt ? `· last check ${new Date(lastCheckedAt).toLocaleTimeString()}` : null}
                  </p>
                )}

                <div className="mt-3">
                  <Label className="text-xs text-white/70">Add these DNS records</Label>

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
                      After adding the records, click <em>Verify DNS</em>. Some providers update quickly; others are slower.
                      We also auto-check every ~10s and flip this to verified once DNS is live.
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
