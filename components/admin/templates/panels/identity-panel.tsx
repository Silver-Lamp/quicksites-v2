// components/admin/templates/panels/identity-panel.tsx
'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Collapsible from '@/components/ui/collapsible-panel';
import type { Template } from '@/types/template';
import { Button } from '@/components/ui';
import { RefreshCw, Save } from 'lucide-react';
import {
  getIndustryOptions,
  INDUSTRY_HINTS,
  resolveIndustryKey,
  toIndustryLabel,
} from '@/lib/industries';

/* ---------------- utilities ---------------- */

function isValidEmail(v: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }

const inputGhost =
  'bg-gray-800 text-white border border-gray-700 ' +
  'placeholder:text-white/40 placeholder:italic placeholder-shown:border-white/20 ' +
  'focus:border-gray-600';

function clampLat(v: number) { return Math.max(-90, Math.min(90, v)); }
function clampLon(v: number) { return Math.max(-180, Math.min(180, v)); }

function formatPhoneLive(digits: string) {
  const d = digits.replace(/\D/g, '').slice(0, 10);
  if (!d) return '';
  if (d.length <= 3) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}
function digitsOnly(v?: string | null) { return (v || '').replace(/\D/g, ''); }

function safeObj<T = any>(v: any): T | undefined {
  if (!v) return undefined;
  if (typeof v === 'object') return v as T;
  if (typeof v === 'string') {
    try { return JSON.parse(v) as T; } catch { return undefined; }
  }
  return undefined;
}

function baseSlugFrom(s: string) {
  return (s || '').replace(/(-[a-z0-9]{2,12})+$/i, '');
}
async function upsertBaseDisplayName(base_slug: string, display_name: string) {
  if (!base_slug || !display_name) return;
  try {
    await fetch('/api/templates/base-name', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base_slug, display_name }),
    });
  } catch {}
}

/* Debug flag in localStorage */
function isDebug() {
  return typeof window !== 'undefined' &&
    typeof localStorage !== 'undefined' &&
    localStorage.getItem('debug:identity') === '1';
}
function dbg(...args: any[]) {
  if (isDebug()) console.debug(...args);
}

/* ───────────────── site type options ───────────────── */
const SITE_TYPES = [
  { value: '', label: 'Select site type' },
  { value: 'small_business', label: 'Small Business' },
  { value: 'portfolio', label: 'Portfolio' },
  { value: 'blog', label: 'Blog' },
  { value: 'about_me', label: 'About Me' },
] as const;

/** Prefer top-level column first, then meta.site_type, then any legacy casing. */
function resolveSiteTypeFromTemplate(t: Template): string {
  const data = safeObj<any>((t as any).data) ?? (t as any).data ?? {};
  const meta = safeObj<any>(data.meta) ?? data.meta ?? {};
  return String((t as any).site_type ?? meta?.site_type ?? meta?.siteType ?? '').trim();
}

/* ---------------- draft typing ---------------- */

type Draft = {
  template_name: string;
  business_name: string;
  site_type: string;
  industry: string;
  industry_other: string;
  contact_email: string;
  phone: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  latitude: string;
  longitude: string;
};

/* ---------------- derive draft from template ---------------- */

function toDraft(t: Template): Draft {
  const data = safeObj<any>((t as any).data) ?? (t as any).data ?? {};
  const meta = safeObj<any>(data.meta) ?? data.meta ?? {};
  const contact = safeObj<any>(meta.contact) ?? meta.contact ?? {};

  const siteType = resolveSiteTypeFromTemplate(t);
  const industryKey = resolveIndustryKey((t as any).industry ?? meta?.industry ?? '');
  const industryLabel = String((t as any).industry_label ?? meta?.industry_label ?? '').trim();

  const siteTitle =
    String((t as any).template_name ?? meta?.siteTitle ?? (t as any).business_name ?? '') || '';

  const business =
    String((t as any).business_name ?? meta?.business ?? siteTitle) || '';

  const rawPhone = String((t as any).phone ?? contact?.phone ?? '');
  const addr1 = String((t as any).address_line1 ?? contact?.address ?? '');
  const addr2 = String((t as any).address_line2 ?? contact?.address2 ?? '');

  const d: Draft = {
    template_name: siteTitle,
    business_name: business,
    site_type: siteType,
    industry: industryKey,
    industry_other:
      industryKey === 'other'
        ? (industryLabel && industryLabel.toLowerCase() !== 'other' ? industryLabel : '')
        : '',
    contact_email: String((t as any).contact_email ?? contact?.email ?? ''),
    phone: formatPhoneLive(digitsOnly(rawPhone)),
    address_line1: addr1,
    address_line2: addr2,
    city: String((t as any).city ?? contact?.city ?? ''),
    state: String((t as any).state ?? contact?.state ?? ''),
    postal_code: String((t as any).postal_code ?? contact?.postal ?? ''),
    latitude: (String((t as any).latitude ?? contact?.latitude ?? '') || ''),
    longitude: (String((t as any).longitude ?? contact?.longitude ?? '') || ''),
  };

  dbg('[IDENTITY:UI] toDraft', {
    templateId: (t as any)?.id,
    canonicalId: (t as any)?.canonical_id,
    draft: d,
  });

  return d;
}

/* ---------------- build patch for onChange ---------------- */

/**
 * Build a patch that:
 * - Updates canonical top-level columns (source of truth).
 * - Mirrors identity into BOTH data.identity and meta.identity (for robust reload across readers).
 * - Keeps legacy meta fields (siteTitle, business, contact, etc.) in sync.
 */
function buildDataPatch(d: Draft, tmpl: Template): Partial<Template> {
  const prevData = safeObj<any>((tmpl as any).data) ?? (tmpl as any).data ?? {};
  const prevMeta = safeObj<any>(prevData.meta) ?? prevData.meta ?? {};
  const prevContact = safeObj<any>(prevMeta.contact) ?? prevMeta.contact ?? {};
  const prevIdentity = safeObj<any>(prevData.identity) ?? prevData.identity ?? {};

  const phoneDigits = digitsOnly(d.phone);
  const email = d.contact_email.trim();
  const lat = d.latitude.trim() === '' ? null : clampLat(Number(d.latitude));
  const lon = d.longitude.trim() === '' ? null : clampLon(Number(d.longitude));

  const normKey = resolveIndustryKey(d.industry || (tmpl as any).industry || '');
  const industryLabel =
    normKey === 'other'
      ? (d.industry_other || (prevMeta?.industry_label as string) || 'Other')
      : toIndustryLabel(normKey);

  const identity = {
    template_name: d.template_name || (tmpl as any).template_name || '',
    business_name: d.business_name || (tmpl as any).business_name || '',
    site_type: (d.site_type || (tmpl as any).site_type || null) as string | null,
    industry: normKey || null,
    industry_label: industryLabel || null,
    contact: {
      email: email || null,
      phone: phoneDigits || null,
      address: d.address_line1 || null,
      address2: d.address_line2 || null,
      city: d.city || null,
      state: d.state || null,
      postal: d.postal_code || null,
      latitude: lat,
      longitude: lon,
    },
  };

  // Mirror into meta for old readers and prompt helpers
  const nextMeta = {
    ...prevMeta,
    siteTitle: identity.template_name || prevMeta?.siteTitle || '',
    business: identity.business_name || prevMeta?.business || '',
    site_type: identity.site_type || undefined,
    industry: identity.industry || undefined,
    industry_label: identity.industry_label || undefined,
    contact: {
      ...prevContact,
      email: identity.contact.email || undefined,
      phone: identity.contact.phone || undefined,
      address: identity.contact.address || undefined,
      address2: identity.contact.address2 || undefined,
      city: identity.contact.city || undefined,
      state: identity.contact.state || undefined,
      postal: identity.contact.postal || undefined,
      latitude: identity.contact.latitude ?? undefined,
      longitude: identity.contact.longitude ?? undefined,
    },
    // also keep a normalized meta.identity for any consumers
    identity: { ...(safeObj<any>(prevMeta.identity) ?? prevMeta.identity ?? {}), ...identity },
  };

  const nextData = {
    ...prevData,
    // non-breaking: add/merge identity snapshot at root of data
    identity: { ...prevIdentity, ...identity },
    meta: nextMeta,
  };

  const patch: Partial<Template> & Record<string, any> = {
    // canonical columns (editor read path should prefer these)
    template_name: identity.template_name,
    business_name: identity.business_name || undefined,
    site_type: identity.site_type || undefined,
    industry: identity.industry || undefined,
    industry_label: identity.industry_label || undefined,
    contact_email: email || undefined,
    phone: phoneDigits || undefined,
    address_line1: d.address_line1 || undefined,
    address_line2: d.address_line2 || undefined,
    city: d.city || undefined,
    state: d.state || undefined,
    postal_code: d.postal_code || undefined,
    latitude: identity.contact.latitude ?? undefined,
    longitude: identity.contact.longitude ?? undefined,

    // hydrated data
    data: nextData,
  };

  dbg('[IDENTITY:UI] buildDataPatch', {
    targetTemplateId: (tmpl as any)?.id,
    canonicalId: (tmpl as any)?.canonical_id,
    identity_in_data: nextData.identity,
    identity_in_meta: nextMeta.identity,
    columns: {
      business_name: patch.business_name,
      site_type: patch.site_type,
      industry: patch.industry,
      contact_email: patch.contact_email,
      phone: patch.phone,
      city: patch.city,
      state: patch.state,
      postal_code: patch.postal_code,
      latitude: patch.latitude,
      longitude: patch.longitude,
    },
  });

  return patch;
}

/* ---------------- component ---------------- */

export default function IdentityPanel({
  template,
  onChange,
}: {
  template: Template;
  onChange: (patch: Partial<Template>) => void;
}) {
  const [draft, setDraft] = React.useState<Draft>(() => toDraft(template));
  const [dirty, setDirty] = React.useState(false);

  const [phoneError, setPhoneError] = React.useState<string | null>(null);
  const [emailError, setEmailError] = React.useState<string | null>(null);
  const [latError, setLatError] = React.useState<string | null>(null);
  const [lonError, setLonError] = React.useState<string | null>(null);

  const [autoApply, setAutoApply] = React.useState(false);
  const [debugOn, setDebugOn] = React.useState(false);

  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const renameDebounce = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const industryOptions = React.useMemo(() => getIndustryOptions(), []);
  const industryHint = React.useMemo(() => {
    const opt = industryOptions.find((o) => o.value === draft.industry);
    return opt ? INDUSTRY_HINTS[opt.label] : undefined;
  }, [draft.industry, industryOptions]);

  // Include top-level columns first so re-hydrate reflects canonical values immediately.
  const templateSig = React.useMemo(() => {
    const data = safeObj<any>((template as any).data) ?? (template as any).data ?? {};
    const meta = safeObj<any>(data.meta) ?? data.meta ?? {};
    return JSON.stringify([
      (template as any).industry ?? meta?.industry ?? '',
      (template as any).business_name ?? meta?.business ?? '',
      (template as any).site_type ?? meta?.site_type ?? '',
      (template as any).template_name ?? meta?.siteTitle ?? '',
      (template as any).business_name ?? meta?.business ?? '',
      (template as any).industry ?? meta?.industry ?? '',
      (template as any).industry_label ?? meta?.industry_label ?? '',
      (template as any).latitude ?? (meta?.contact ?? {})?.latitude ?? '',
      (template as any).longitude ?? (meta?.contact ?? {})?.longitude ?? '',
      (template as any).contact_email ?? (meta?.contact ?? {})?.email ?? '',
      (template as any).phone ?? (meta?.contact ?? {})?.phone ?? '',
      (template as any).address_line1 ?? (meta?.contact ?? {})?.address ?? '',
      (template as any).address_line2 ?? (meta?.contact ?? {})?.address2 ?? '',
      (template as any).city ?? (meta?.contact ?? {})?.city ?? '',
      (template as any).state ?? (meta?.contact ?? {})?.state ?? '',
      (template as any).postal_code ?? (meta?.contact ?? {})?.postal ?? '',
      (template as any).updated_at ?? '',
    ]);
  }, [template]);

  // Initialize UI toggle from localStorage
  React.useEffect(() => {
    setDebugOn(isDebug());
  }, []);

  const emitTitle = React.useCallback(
    (nextName: string) => {
      if (typeof window === 'undefined') return;
      window.dispatchEvent(
        new CustomEvent('qs:template:title', {
          detail: { name: (nextName || '').trim(), id: (template as any)?.id },
        })
      );
    },
    [template]
  );

  React.useEffect(() => {
    const d = toDraft(template);
    setDraft(d);
    setDirty(false);
    setPhoneError(null);
    setEmailError(null);
    setLatError(null);
    setLonError(null);
    const initialName =
      (d.template_name || '').trim() || (template as any).template_name || '';
    if (initialName) emitTitle(initialName);

    // Render probe
    const data = safeObj<any>((template as any).data) ?? (template as any).data ?? {};
    dbg('[IDENTITY:UI] render', {
      templateId: (template as any)?.id,
      canonicalId: (template as any)?.canonical_id,
      draft: d,
      data_identity: safeObj<any>(data.identity) ?? data.identity ?? null,
      meta_identity: safeObj<any>(data?.meta?.identity) ?? data?.meta?.identity ?? null,
    });
  }, [templateSig, template, emitTitle]);

  const scheduleAutoApply = React.useCallback(
    (nextDraft: Draft) => {
      if (!autoApply) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const patch = buildDataPatch(nextDraft, template);
      debounceRef.current = setTimeout(() => {
        dbg('[IDENTITY:UI] auto-apply patch', patch);
        onChange(patch);
      }, 700);
    },
    [autoApply, onChange, template]
  );

  const commit = React.useCallback(() => {
    const pDigits = digitsOnly(draft.phone);
    if (pDigits && pDigits.length !== 10) { setPhoneError('Phone number must be exactly 10 digits'); return; }
    const em = draft.contact_email.trim();
    if (em && !isValidEmail(em)) { setEmailError('Enter a valid email address'); return; }
    if (draft.latitude.trim() !== '' && !Number.isFinite(Number(draft.latitude))) { setLatError('Latitude must be a number'); return; }
    if (draft.longitude.trim() !== '' && !Number.isFinite(Number(draft.longitude))) { setLonError('Longitude must be a number'); return; }

    const patch = buildDataPatch(draft, template);
    dbg('[IDENTITY:UI] commit patch', patch);
    onChange(patch);
    setDirty(false);

    const name = String(draft.template_name || '').trim();
    if (name) {
      const base =
        (template as any).base_slug ||
        baseSlugFrom(String((template as any).slug || (template as any).template_name || (template as any).id || ''));
      void upsertBaseDisplayName(base, name);
    }
  }, [draft, onChange, template]);

  const setField = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => {
      const next = { ...d, [key]: value as Draft[K] };

      if (key === 'industry') {
        next.industry = resolveIndustryKey(String(value)) as Draft['industry'];
        if (next.industry !== 'other') next.industry_other = '';
      }

      if (key === 'site_type') {
        if (String(value) && value !== 'small_business' && !next.industry) {
          next.industry = 'other';
        }
      }

      setDirty(true);

      if (key === 'template_name') {
        const name = String(value || '').trim();
        emitTitle(name);
        if (autoApply) {
          if (renameDebounce.current) clearTimeout(renameDebounce.current);
          renameDebounce.current = setTimeout(() => {
            const base =
              (template as any).base_slug ||
              baseSlugFrom(String((template as any).slug || (template as any).template_name || (template as any).id || ''));
            void upsertBaseDisplayName(base, name);
          }, 600);
        }
      }

      if (key === 'phone') {
        const digits = digitsOnly(String(value));
        setPhoneError(digits && digits.length !== 10 ? 'Phone number must be exactly 10 digits' : null);
        scheduleAutoApply(next);
      } else if (key === 'contact_email') {
        const v = String(value).trim();
        setEmailError(v && !isValidEmail(v) ? 'Enter a valid email address' : null);
        scheduleAutoApply(next);
      } else {
        scheduleAutoApply(next);
      }

      return next;
    });
  };

  return (
    <Collapsible title="Template Identity" id="template-identity">
      <div className="space-y-4">
        {/* Controls */}
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-white/60">
            {dirty ? 'Unsaved changes' : 'No changes'}
          </div>
          <div className="flex items-center gap-3">
            {/* Debug toggle */}
            <label
              className="text-xs text-white/70 inline-flex items-center gap-1 cursor-pointer"
              title="Write detailed identity panel logs to the browser console"
            >
              <input
                type="checkbox"
                className="accent-purple-500"
                checked={debugOn}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  try {
                    if (enabled) localStorage.setItem('debug:identity', '1');
                    else localStorage.removeItem('debug:identity');
                  } catch {}
                  setDebugOn(enabled);
                  dbg('[IDENTITY:UI] debug toggle', {
                    enabled,
                    templateId: (template as any)?.id,
                    canonicalId: (template as any)?.canonical_id,
                  });
                }}
              />
              Debug logs
            </label>

            {/* Auto-apply */}
            <label className="text-xs text-white/70 inline-flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                className="accent-purple-500"
                checked={autoApply}
                onChange={(e) => (setAutoApply(e.target.checked))}
              />
              Auto-apply
            </label>

            {/* Apply & Reset */}
            <Button
              size="sm"
              variant={dirty ? 'secondary' : 'outline'}
              className={dirty ? 'bg-purple-500 hover:bg-purple-600' : ''}
              disabled={!dirty || !!phoneError || !!emailError || !!latError || !!lonError}
              onClick={commit}
              title="Apply changes to the template"
            >
              <Save className="w-3.5 h-3.5 mr-1" />
              Apply
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                dbg('[IDENTITY:UI] reset draft to template');
                setDraft(toDraft(template));
                setDirty(false);
                setPhoneError(null);
                setEmailError(null);
                setLatError(null);
                setLonError(null);
              }}
              title="Discard draft changes"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1" />
              Reset
            </Button>
          </div>
        </div>

        {/* Template Name */}
        <div>
          <Label>Template Name</Label>
          <Input
            value={draft.template_name}
            onChange={(e) => setField('template_name', e.target.value)}
            placeholder="e.g. auburnroofcleaning"
            className={inputGhost}
          />
        </div>

        {/* Business Name */}
        <div>
          <Label>Business / Site Display Name</Label>
          <Input
            value={draft.business_name}
            onChange={(e) => setField('business_name', e.target.value)}
            placeholder="e.g. Auburn Roof Cleaning"
            className={inputGhost}
          />
        </div>

        {/* Site Type + Industry */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>Site Type</Label>
            <select
              value={draft.site_type}
              onChange={(e) => setField('site_type', e.target.value)}
              className="w-full px-2 py-1 rounded bg-gray-800 border text-white border-gray-700 focus:border-gray-600"
            >
              {SITE_TYPES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <p className="text-[11px] text-white/40 mt-1">
              Helps AI tailor defaults (Portfolio / Blog / About Me / Small Business).
            </p>
          </div>

          <div>
            <Label>Industry</Label>
            <select
              value={draft.industry}
              onChange={(e) => setField('industry', e.target.value)}
              className="w-full px-2 py-1 rounded bg-gray-800 border text-white border-gray-700 focus:border-gray-600"
            >
              {draft.industry ? null : <option value="">Select industry</option>}
              {getIndustryOptions().map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-white/40 mt-1">
              Resolved: {toIndustryLabel(resolveIndustryKey(draft.industry))}
            </p>
            {(() => {
              const opt = getIndustryOptions().find(o => o.value === draft.industry);
              const hint = opt ? INDUSTRY_HINTS[opt.label] : undefined;
              return hint ? <p className="text-xs text-white/60 mt-1">{hint}</p> : null;
            })()}
          </div>
        </div>

        {/* Free-text when "Other" is selected */}
        {draft.industry === 'other' && (
          <div>
            <Label>Other Industry (describe)</Label>
            <Input
              value={draft.industry_other}
              onChange={(e) => setField('industry_other', e.target.value)}
              placeholder="e.g., Mobile Windshield Repair"
              className={inputGhost}
            />
            <p className="text-[11px] text-white/40 mt-1">
              Used as <code>industry_label</code> for AI prompts and copy.
            </p>
          </div>
        )}

        {/* Contact Email */}
        <div>
          <Label>Contact Email</Label>
          <Input
            type="email"
            value={draft.contact_email}
            onChange={(e) => setField('contact_email', e.target.value)}
            placeholder="name@yourcompany.com"
            className={`${inputGhost} ${emailError ? 'border-red-500' : ''}`}
          />
        </div>
        {emailError && <p className="text-red-500 text-xs mt-1">{emailError}</p>}

        {/* Phone */}
        <div>
          <Label>Phone</Label>
          <Input
            value={draft.phone}
            onChange={(e) => setField('phone', e.target.value)}
            inputMode="tel"
            placeholder="(123) 456-7890"
            className={`${inputGhost} ${phoneError ? 'border-red-500' : ''}`}
          />
        </div>
        {phoneError && <p className="text-red-500 text-xs mt-1">{phoneError}</p>}

        {/* Address */}
        <div>
          <Label>Address</Label>
          <Input
            value={draft.address_line1}
            onChange={(e) => setField('address_line1', e.target.value)}
            placeholder="1600 7th Ave"
            className={inputGhost}
          />
        </div>

        {/* Address 2 */}
        <div>
          <Label>Address 2 (optional)</Label>
          <Input
            value={draft.address_line2}
            onChange={(e) => setField('address_line2', e.target.value)}
            placeholder="Suite / Unit"
            className={inputGhost}
          />
        </div>

        {/* City / State / ZIP */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label>City</Label>
            <Input
              value={draft.city}
              onChange={(e) => setField('city', e.target.value)}
              placeholder="Grafton"
              className={inputGhost}
            />
          </div>
          <div>
            <Label>State</Label>
            <Input
              value={draft.state}
              onChange={(e) => setField('state', e.target.value)}
              placeholder="WI"
              className={inputGhost}
            />
          </div>
          <div>
            <Label>ZIP</Label>
            <Input
              value={draft.postal_code}
              onChange={(e) => setField('postal_code', e.target.value)}
              placeholder="53024"
              className={inputGhost}
            />
          </div>
        </div>

        {/* Latitude / Longitude */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>Latitude</Label>
            <Input
              type="text"
              value={draft.latitude}
              onChange={(e) => setField('latitude', e.target.value)}
              placeholder="43.319100"
              className={`${inputGhost} ${latError ? 'border-red-500' : ''}`}
            />
            {latError && <p className="text-red-500 text-xs mt-1">{latError}</p>}
          </div>
          <div>
            <Label>Longitude</Label>
            <Input
              type="text"
              value={draft.longitude}
              onChange={(e) => setField('longitude', e.target.value)}
              placeholder="-87.953690"
              className={`${inputGhost} ${lonError ? 'border-red-500' : ''}`}
            />
            {lonError && <p className="text-red-500 text-xs mt-1">{lonError}</p>}
          </div>
        </div>
      </div>
    </Collapsible>
  );
}
