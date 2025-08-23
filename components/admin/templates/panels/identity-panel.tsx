// components/admin/templates/panels/IdentityPanel.tsx
'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Collapsible from '@/components/ui/collapsible-panel';
import type { Template } from '@/types/template';
import { useEffect, useRef, useState } from 'react';

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

export default function IdentityPanel({
  template,
  onChange,
}: {
  template: Template;
  onChange: (updated: Template) => void;
}) {
  const [phoneDraft, setPhoneDraft] = useState<string>(formatPhoneLive(digitsOnly(template.phone)));
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [latError, setLatError] = useState<string | null>(null);
  const [lonError, setLonError] = useState<string | null>(null);

  // keep draft in sync if template.phone changes externally
  useEffect(() => {
    setPhoneDraft(formatPhoneLive(digitsOnly(template.phone)));
  }, [template.phone]);

  // debounce timer for phone commits
  const phoneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearPhoneTimer = () => {
    if (phoneTimerRef.current) {
      clearTimeout(phoneTimerRef.current);
      phoneTimerRef.current = null;
    }
  };
  const commitPhone = (digits: string) => {
    onChange({ ...template, phone: digits });
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = digitsOnly(e.target.value);
    setPhoneDraft(formatPhoneLive(digits));
    setPhoneError(digits && digits.length !== 10 ? 'Phone number must be exactly 10 digits' : null);

    // debounce the commit so typing feels smooth
    clearPhoneTimer();
    phoneTimerRef.current = setTimeout(() => commitPhone(digits), 450);
  };
  const handlePhoneBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const digits = digitsOnly(e.target.value);
    clearPhoneTimer();
    commitPhone(digits);
  };
  const handlePhoneKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const digits = digitsOnly((e.currentTarget as HTMLInputElement).value);
      clearPhoneTimer();
      commitPhone(digits);
    }
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.trim();
    setEmailError(v && !isValidEmail(v) ? 'Enter a valid email address' : null);
    onChange({ ...template, contact_email: v });
  };

  const handleLatChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.trim();
    if (v === '') { setLatError(null); onChange({ ...template, latitude: null }); return; }
    const num = Number(v);
    if (!Number.isFinite(num) || num < -90 || num > 90) { setLatError('Latitude must be between -90 and 90'); return; }
    setLatError(null);
    onChange({ ...template, latitude: clampLat(num) });
  };
  const handleLonChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.trim();
    if (v === '') { setLonError(null); onChange({ ...template, longitude: null }); return; }
    const num = Number(v);
    if (!Number.isFinite(num) || num < -180 || num > 180) { setLonError('Longitude must be between -180 and 180'); return; }
    setLonError(null);
    onChange({ ...template, longitude: clampLon(num) });
  };

  const industryEmpty = !template.industry;

  return (
    <Collapsible title="Template Identity" id="template-identity">
      <div className="space-y-4">
        {/* Template Name */}
        <div>
          <Label>Template Name</Label>
          <Input
            value={template.template_name || ''}
            onChange={(e) => onChange({ ...template, template_name: e.target.value })}
            placeholder="e.g. auburnroofcleaning"
            className={inputGhost}
          />
        </div>

        {/* Business Name */}
        <div>
          <Label>Business Name</Label>
          <Input
            value={template.business_name || ''}
            onChange={(e) => onChange({ ...template, business_name: e.target.value })}
            placeholder="e.g. Auburn Roof Cleaning"
            className={inputGhost}
          />
        </div>

        {/* Industry */}
        <div>
          <Label>Industry</Label>
          <select
            value={template.industry || ''}
            onChange={(e) => onChange({ ...template, industry: e.target.value })}
            className={
              'w-full px-2 py-1 rounded ' +
              'bg-gray-800 border ' +
              (industryEmpty ? 'text-white/60 ' : 'text-white ') +
              'border-gray-700 focus:border-gray-600'
            }
          >
            <option value="">Select industry</option>
            {['Towing','Roof Cleaning','Window Cleaning','Pressure Washing','Junk Removal','Other'].map((industry) => (
              <option key={industry} value={industry}>{industry}</option>
            ))}
          </select>
        </div>

        {/* Contact Email */}
        <div>
          <Label>Contact Email</Label>
          <Input
            type="email"
            value={(template as any).contact_email || ''}
            onChange={handleEmailChange}
            placeholder="name@yourcompany.com"
            className={`${inputGhost} ${emailError ? 'border-red-500' : ''}`}
          />
          {emailError && <p className="text-red-500 text-xs mt-1">{emailError}</p>}
        </div>

        {/* Phone — controlled + debounced */}
        <div>
          <Label>Phone</Label>
          <Input
            value={phoneDraft}
            onChange={handlePhoneChange}
            onBlur={handlePhoneBlur}
            onKeyDown={handlePhoneKeyDown}
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
            value={template.address_line1 || ''}
            onChange={(e) => onChange({ ...template, address_line1: e.target.value })}
            placeholder="1600 7th Ave"
            className={inputGhost}
          />
        </div>

        {/* Address Line 2 */}
        <div>
          <Label>Address 2 (optional)</Label>
          <Input
            value={template.address_line2 || ''}
            onChange={(e) => onChange({ ...template, address_line2: e.target.value })}
            placeholder="Suite / Unit"
            className={inputGhost}
          />
        </div>

        {/* City / State / ZIP */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label>City</Label>
            <Input
              value={template.city || ''}
              onChange={(e) => onChange({ ...template, city: e.target.value })}
              placeholder="Grafton"
              className={inputGhost}
            />
          </div>
          <div>
            <Label>State</Label>
            <Input
              value={template.state || ''}
              onChange={(e) => onChange({ ...template, state: e.target.value })}
              placeholder="WI"
              className={inputGhost}
            />
          </div>
          <div>
            <Label>ZIP</Label>
            <Input
              value={template.postal_code || ''}
              onChange={(e) => onChange({ ...template, postal_code: e.target.value })}
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
              type="number"
              step="0.000001"
              value={template.latitude ?? ''}
              onChange={handleLatChange}
              placeholder="43.319100"
              className={`${inputGhost} ${latError ? 'border-red-500' : ''}`}
            />
            {latError && <p className="text-red-500 text-xs mt-1">{latError}</p>}
          </div>
          <div>
            <Label>Longitude</Label>
            <Input
              type="number"
              step="0.000001"
              value={template.longitude ?? ''}
              onChange={handleLonChange}
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
