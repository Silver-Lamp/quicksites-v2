'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Collapsible from '@/components/ui/collapsible-panel';
import type { Template } from '@/types/template';
import { Button } from '@/components/ui';
import { RefreshCw, Save } from 'lucide-react';

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}
const inputGhost =
  'bg-gray-800 text-white border border-gray-700 ' +
  'placeholder:text-white/40 placeholder:italic placeholder-shown:border-white/20 ' +
  'focus:border-gray-600';

function clampLat(v: number) { return Math.max(-90, Math.min(90, v)); }
function clampLon(v: number) { return Math.max(-180, Math.min(180, v)); }

// live formatter: "(123) 456-7890" as you type
function formatPhoneLive(digits: string) {
  const d = digits.replace(/\D/g, '').slice(0, 10);
  if (!d) return '';
  if (d.length <= 3) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}
function digitsOnly(v?: string | null) {
  return (v || '').replace(/\D/g, '');
}

type Draft = {
  template_name: string;
  business_name: string;
  industry: string;
  contact_email: string;
  phone: string;           // live formatted
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  latitude: string;        // keep as text while typing
  longitude: string;       // keep as text while typing
};

function toDraft(t: Template): Draft {
  return {
    template_name: t.template_name || '',
    business_name: t.business_name || '',
    industry: (t as any).industry || '',
    contact_email: (t as any).contact_email || '',
    phone: formatPhoneLive(digitsOnly(t.phone)),
    address_line1: t.address_line1 || '',
    address_line2: t.address_line2 || '',
    city: t.city || '',
    state: t.state || '',
    postal_code: t.postal_code || '',
    latitude: t.latitude != null ? String(t.latitude) : '',
    longitude: t.longitude != null ? String(t.longitude) : '',
  };
}

function changedKeys(d: Draft, t: Template): Partial<Template> {
  const patch: any = {};
  if (d.template_name !== (t.template_name || '')) patch.template_name = d.template_name;
  if (d.business_name !== (t.business_name || '')) patch.business_name = d.business_name;
  if (d.industry !== ((t as any).industry || '')) patch.industry = d.industry;
  if (d.contact_email.trim() !== (((t as any).contact_email || '') as string).trim())
    patch.contact_email = d.contact_email.trim();

  const phoneDigits = digitsOnly(d.phone);
  if (phoneDigits !== digitsOnly(t.phone)) patch.phone = phoneDigits;

  if (d.address_line1 !== (t.address_line1 || '')) patch.address_line1 = d.address_line1;
  if (d.address_line2 !== (t.address_line2 || '')) patch.address_line2 = d.address_line2;
  if (d.city !== (t.city || '')) patch.city = d.city;
  if (d.state !== (t.state || '')) patch.state = d.state;
  if (d.postal_code !== (t.postal_code || '')) patch.postal_code = d.postal_code;

  // Ensure numbers or null for server
  const lat = d.latitude.trim() === '' ? null : Number(d.latitude);
  const lon = d.longitude.trim() === '' ? null : Number(d.longitude);
  if (lat !== (t.latitude ?? null)) patch.latitude = lat;
  if (lon !== (t.longitude ?? null)) patch.longitude = lon;

  return patch as Partial<Template>;
}

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

  // Optional: turn on to auto-apply with debounce
  const [autoApply, setAutoApply] = React.useState(false);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // reset draft if template changes externally
  React.useEffect(() => {
    setDraft(toDraft(template));
    setDirty(false);
    setPhoneError(null);
    setEmailError(null);
    setLatError(null);
    setLonError(null);
  }, [template]);

  const scheduleAutoApply = React.useCallback((nextPatch: Partial<Template>) => {
    if (!autoApply) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onChange(nextPatch), 700);
  }, [autoApply, onChange]);

  const commit = React.useCallback(() => {
    const patch = changedKeys(draft, template);

    // validate critical fields before commit
    const pDigits = digitsOnly(draft.phone);
    if (pDigits && pDigits.length !== 10) { setPhoneError('Phone number must be exactly 10 digits'); return; }
    const em = draft.contact_email.trim();
    if (em && !isValidEmail(em)) { setEmailError('Enter a valid email address'); return; }
    if (draft.latitude.trim() !== '' && !Number.isFinite(Number(draft.latitude))) {
      setLatError('Latitude must be a number'); return;
    }
    if (draft.longitude.trim() !== '' && !Number.isFinite(Number(draft.longitude))) {
      setLonError('Longitude must be a number'); return;
    }

    // apply patch only if there are changes
    if (Object.keys(patch).length) {
      onChange(patch);
      setDirty(false);
    }
  }, [draft, onChange, template]);

  // field handlers (draft only)
  const setField = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => {
      const next = { ...d, [key]: value };
      setDirty(true);

      // live validations
      if (key === 'phone') {
        const digits = digitsOnly(value as string);
        setPhoneError(digits && digits.length !== 10 ? 'Phone number must be exactly 10 digits' : null);
        // schedule auto apply if enabled
        scheduleAutoApply(changedKeys({ ...next }, template));
      } else if (key === 'contact_email') {
        const v = String(value).trim();
        setEmailError(v && !isValidEmail(v) ? 'Enter a valid email address' : null);
        scheduleAutoApply(changedKeys({ ...next }, template));
      } else if (key === 'latitude') {
        const v = String(value).trim();
        setLatError(v !== '' && !Number.isFinite(Number(v)) ? 'Latitude must be a number' : null);
      } else if (key === 'longitude') {
        const v = String(value).trim();
        setLonError(v !== '' && !Number.isFinite(Number(v)) ? 'Longitude must be a number' : null);
      } else {
        scheduleAutoApply(changedKeys({ ...next }, template));
      }

      return next;
    });
  };

  return (
    <Collapsible title="Template Identity" id="template-identity">
      <div className="space-y-4">

        {/* Controls row: manual apply + (optional) auto apply */}
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
              className={dirty ? "bg-purple-500 hover:bg-purple-600" : ""}
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

        {/* Template Name (rename UI still handles slug; this only changes working state) */}
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
          <Label>Business Name</Label>
          <Input
            value={draft.business_name}
            onChange={(e) => setField('business_name', e.target.value)}
            placeholder="e.g. Auburn Roof Cleaning"
            className={inputGhost}
          />
        </div>

        {/* Industry */}
        <div>
          <Label>Industry</Label>
          <select
            value={draft.industry}
            onChange={(e) => setField('industry', e.target.value)}
            className={
              'w-full px-2 py-1 rounded ' +
              'bg-gray-800 border text-white ' +
              'border-gray-700 focus:border-gray-600'
            }
          >
            <option value="">Select industry</option>
            {[
              'Towing',
              'Window Washing',
              'Roof Cleaning',
              'Landscaping',
              'HVAC',
              'Plumbing',
              'Electrical',
              'Auto Repair',
              'Carpet Cleaning',
              'Moving',
              'Pest Control',
              'Painting',
              'General Contractor',
              'Real Estate',
              'Restaurant',
              'Salon & Spa',
              'Fitness',
              'Photography',
              'Legal',
              'Medical / Dental',
              // legacy/additional
              'Window Cleaning',
              'Pressure Washing',
              'Junk Removal',
              'Other',
            ].map((industry) => (
              <option key={industry} value={industry}>{industry}</option>
            ))}
          </select>
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
          {emailError && <p className="text-red-500 text-xs mt-1">{emailError}</p>}
        </div>

        {/* Phone — draft + live formatted */}
        <div>
          <Label>Phone</Label>
          <Input
            value={draft.phone}
            onChange={(e) => setField('phone', e.target.value)}
            inputMode="tel"
            placeholder="(123) 456-7890"
            className={`${inputGhost} ${phoneError ? 'border-red-500' : ''}`}
          />
          {phoneError && <p className="text-red-500 text-xs mt-1">{phoneError}</p>}
        </div>

        {/* Address Line 1 */}
        <div>
          <Label>Address</Label>
          <Input
            value={draft.address_line1}
            onChange={(e) => setField('address_line1', e.target.value)}
            placeholder="1600 7th Ave"
            className={inputGhost}
          />
        </div>

        {/* Address Line 2 */}
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
