// components/admin/templates/panels/IdentityPanel.tsx
'use client';

import { useMask } from '@react-input/mask';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Collapsible from '@/components/ui/collapsible-panel';
import type { Template } from '@/types/template';
import { useState } from 'react';

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}
const inputGhost =
  // lighter placeholder text + subtle border until user types
  'bg-gray-800 text-white border border-gray-700 ' +
  'placeholder:text-white/40 placeholder:italic placeholder-shown:border-white/20 ' +
  'focus:border-gray-600';

function clampLat(v: number) { return Math.max(-90, Math.min(90, v)); }
function clampLon(v: number) { return Math.max(-180, Math.min(180, v)); }

export default function IdentityPanel({
  template,
  onChange,
}: {
  template: Template;
  onChange: (updated: Template) => void;
}) {
  const phoneRef = useMask({ mask: '(000) 000-0000', replacement: { 0: /\d/ } });

  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [latError, setLatError] = useState<string | null>(null);
  const [lonError, setLonError] = useState<string | null>(null);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '');
    setPhoneError(digits && digits.length !== 10 ? 'Phone number must be exactly 10 digits' : null);
    onChange({ ...template, phone: digits });
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

  const getFormattedPhone = (raw?: string | null): string => {
    const digits = raw?.replace(/\D/g, '') || '';
    if (digits.length !== 10) return '';
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  const industryEmpty = !template.industry;

  return (
    <Collapsible title="Template Identity" id="template-identity">
      <div className="space-y-4">
        {/* Template Name (internal) */}
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
            {['Towing','Roof Cleaning','Window Cleaning','Pressure Washing','Junk Removal','Other']
              .map((industry) => (
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

        {/* Phone */}
        <div>
          <Label>Phone</Label>
          <Input
            ref={phoneRef}
            defaultValue={getFormattedPhone(template.phone)}
            onChange={handlePhoneChange}
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

        {/* Address Line 2 (optional) */}
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
