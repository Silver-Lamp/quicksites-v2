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
  resolveIndustry,         // returns { key, label } – used for draft init
  resolveIndustryKey,       // canonical key resolver (label/key/synonym → key)
  toIndustryLabel,
} from '@/lib/industries';

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

type Draft = {
  template_name: string;
  business_name: string;
  industry: string;        // store CANONICAL KEY here
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

function toDraft(t: Template): Draft {
  const meta = (t.data as any)?.meta ?? {};
  const contact = meta?.contact ?? {};
  // Normalize to canonical key from whatever is stored
  const normKey = resolveIndustryKey(meta?.industry ?? (t as any).industry ?? '');

  const siteTitle =
    (meta?.siteTitle as string) ??
    (t.template_name as string) ??
    (t as any).business_name ??
    '';

  const business =
    (meta?.business as string) ??
    (t as any).business_name ??
    siteTitle ??
    '';

  const rawPhone = contact?.phone ?? (t as any).phone ?? '';
  const addr1 = (contact?.address as string) || (t as any).address_line1 || '';
  const addr2 = (contact?.address2 as string) || (t as any).address_line2 || '';

  return {
    template_name: siteTitle,
    business_name: business,
    industry: normKey,
    contact_email: String(contact?.email ?? (t as any).contact_email ?? ''),
    phone: formatPhoneLive(digitsOnly(rawPhone)),
    address_line1: addr1,
    address_line2: addr2,
    city: String(contact?.city ?? (t as any).city ?? ''),
    state: String(contact?.state ?? (t as any).state ?? ''),
    postal_code: String(contact?.postal ?? (t as any).postal_code ?? ''),
    latitude:
      (contact?.latitude ?? (t as any).latitude ?? '') !== ''
        ? String(contact?.latitude ?? (t as any).latitude ?? '')
        : '',
    longitude:
      (contact?.longitude ?? (t as any).longitude ?? '') !== ''
        ? String(contact?.longitude ?? (t as any).longitude ?? '')
        : '',
  };
}

/** Build a data-only patch against canonical JSON (no top-level writes). */
function buildDataPatch(d: Draft, tmpl: Template): Partial<Template> {
  const prevMeta = (tmpl.data as any)?.meta ?? {};
  const prevContact = prevMeta?.contact ?? {};

  const phoneDigits = digitsOnly(d.phone);
  const email = d.contact_email.trim();
  const lat = d.latitude.trim() === '' ? null : clampLat(Number(d.latitude));
  const lon = d.longitude.trim() === '' ? null : clampLon(Number(d.longitude));
  const address = [d.address_line1, d.address_line2].filter(Boolean).join(', ').trim() || '';

  // Always re-normalize industry to the canonical key
  const normKey = resolveIndustryKey(d.industry || prevMeta?.industry || (tmpl as any).industry || '');

  const meta = {
    ...prevMeta,
    siteTitle: d.template_name || prevMeta?.siteTitle || '',
    business: d.business_name || prevMeta?.business || '',
    industry: normKey, // ← IMPORTANT: save key
    contact: {
      ...prevContact,
      email: email || null,
      phone: phoneDigits || null,
      address: address || null,
      address2: d.address_line2 || null,
      city: d.city || null,
      state: d.state || null,
      postal: d.postal_code || null,
      latitude: lat,
      longitude: lon,
    },
  };

  return {
    data: {
      ...(tmpl.data as any),
      meta,
    },
  };
}

export default function IdentityPanel({
  template,
  onChange,
}: {
  template: Template;
  onChange: (patch: Partial<Template>) => void; // parent autosaves via commit (data-only)
}) {
  const [draft, setDraft] = React.useState<Draft>(() => toDraft(template));
  const [dirty, setDirty] = React.useState(false);

  const [phoneError, setPhoneError] = React.useState<string | null>(null);
  const [emailError, setEmailError] = React.useState<string | null>(null);
  const [latError, setLatError] = React.useState<string | null>(null);
  const [lonError, setLonError] = React.useState<string | null>(null);

  const [autoApply, setAutoApply] = React.useState(false);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Controlled industry options: value === canonical key
  const industryOptions = React.useMemo(() => getIndustryOptions(), []);

  const industryHint = React.useMemo(() => {
    const opt = industryOptions.find((o) => o.value === draft.industry);
    return opt ? INDUSTRY_HINTS[opt.label] : undefined;
  }, [draft.industry, industryOptions]);

  // Build a small “signature” that updates whenever relevant template fields change,
  // even if the parent keeps the same object reference.
  const templateSig = React.useMemo(() => {
    const meta = (template.data as any)?.meta ?? {};
    return JSON.stringify([
      meta?.industry ?? (template as any).industry ?? '',
      meta?.siteTitle ?? template.template_name ?? '',
      meta?.business ?? (template as any).business_name ?? '',
      (template as any).updated_at ?? '',
    ]);
  }, [template]);

  // Re-sync the draft whenever the template signature changes.
  React.useEffect(() => {
    setDraft(toDraft(template));
    setDirty(false);
    setPhoneError(null);
    setEmailError(null);
    setLatError(null);
    setLonError(null);
  }, [templateSig, template]);

  const scheduleAutoApply = React.useCallback(
    (nextDraft: Draft) => {
      if (!autoApply) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const patch = buildDataPatch(nextDraft, template);
      debounceRef.current = setTimeout(() => onChange(patch), 700);
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

    onChange(buildDataPatch(draft, template));
    setDirty(false);
  }, [draft, onChange, template]);

  const setField = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => {
      const next = { ...d, [key]: value };

      // industry is controlled & canonicalized; re-normalize immediately
      if (key === 'industry') {
        next.industry = resolveIndustryKey(String(value)) as Draft['industry'];
      }

      setDirty(true);

      if (key === 'phone') {
        const digits = digitsOnly(String(value));
        setPhoneError(digits && digits.length !== 10 ? 'Phone number must be exactly 10 digits' : null);
        scheduleAutoApply(next);
      } else if (key === 'contact_email') {
        const v = String(value).trim();
        setEmailError(v && !isValidEmail(v) ? 'Enter a valid email address' : null);
        scheduleAutoApply(next);
      } else if (key === 'latitude') {
        const v = String(value).trim();
        setLatError(v !== '' && !Number.isFinite(Number(v)) ? 'Latitude must be a number' : null);
      } else if (key === 'longitude') {
        const v = String(value).trim();
        setLonError(v !== '' && !Number.isFinite(Number(v)) ? 'Longitude must be a number' : null);
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
          <div className="flex items-center gap-2">
            <label className="text-xs text-white/70 inline-flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                className="accent-purple-500"
                checked={autoApply}
                onChange={(e) => setAutoApply(e.target.checked)}
              />
              Auto-apply
            </label>
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
              onClick={() => { setDraft(toDraft(template)); setDirty(false); setPhoneError(null); setEmailError(null); setLatError(null); setLonError(null); }}
              title="Discard draft changes"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1" />
              Reset
            </Button>
          </div>
        </div>

        {/* Template Name → data.meta.siteTitle */}
        <div>
          <Label>Template Name</Label>
          <Input
            value={draft.template_name}
            onChange={(e) => setField('template_name', e.target.value)}
            placeholder="e.g. auburnroofcleaning"
            className={inputGhost}
          />
        </div>

        {/* Business Name → data.meta.business */}
        <div>
          <Label>Business Name</Label>
          <Input
            value={draft.business_name}
            onChange={(e) => setField('business_name', e.target.value)}
            placeholder="e.g. Auburn Roof Cleaning"
            className={inputGhost}
          />
        </div>

        {/* Industry (controlled; value is canonical key) */}
        <div>
          <Label>Industry</Label>
          <select
            value={draft.industry}
            onChange={(e) => setField('industry', e.target.value)}
            className="w-full px-2 py-1 rounded bg-gray-800 border text-white border-gray-700 focus:border-gray-600"
          >
            {/* Show placeholder only if unset */}
            {draft.industry ? null : <option value="">Select industry</option>}
            {industryOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {/* friendly “resolved to” echo for debugging – optional */}
          <p className="text-[11px] text-white/40 mt-1">
            Resolved: {toIndustryLabel(resolveIndustryKey(draft.industry))}
          </p>
          {industryHint && <p className="text-xs text-white/60 mt-1">{industryHint}</p>}
        </div>

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
