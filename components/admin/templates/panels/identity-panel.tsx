'use client';

import { useMask } from '@react-input/mask';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Collapsible from '@/components/ui/collapsible-panel';
import type { Template } from '@/types/template';
import { useRef, useState } from 'react';

export default function IdentityPanel({
  template,
  onChange,
}: {
  template: Template;
  onChange: (updated: Template) => void;
}) {
  const phoneRef = useMask({
    mask: '(000) 000-0000',
    replacement: { 0: /\d/ },
  });

  const [phoneError, setPhoneError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '');

    if (digits && digits.length !== 10) {
      setPhoneError('Phone number must be exactly 10 digits');
    } else {
      setPhoneError(null);
    }

    onChange({ ...template, phone: digits });
  };

  const getFormattedPhone = (raw?: string | null): string => {
    const digits = raw?.replace(/\D/g, '') || '';
    if (digits.length !== 10) return '';
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  return (
    <Collapsible title="Template Identity" id="template-identity">
      <div className="space-y-4">
        {/* Template Name */}
        <div>
          <Label>Template Name</Label>
          <Input
            value={template.template_name || ''}
            onChange={(e) =>
              onChange({ ...template, template_name: e.target.value })
            }
            placeholder="e.g. auburnroofcleaning"
            className="bg-gray-800 text-white border border-gray-700"
          />
        </div>

        {/* Industry Dropdown */}
        <div>
          <Label>Industry</Label>
          <select
            value={template.industry || ''}
            onChange={(e) =>
              onChange({ ...template, industry: e.target.value })
            }
            className="w-full bg-gray-800 text-white border border-gray-700 px-2 py-1 rounded"
          >
            <option value="">Select industry</option>
            {[
              'Towing',
              'Roof Cleaning',
              'Window Cleaning',
              'Pressure Washing',
              'Junk Removal',
              'Other',
            ].map((industry) => (
              <option key={industry} value={industry}>
                {industry}
              </option>
            ))}
          </select>
        </div>

        {/* Phone Input */}
        <div>
          <Label>Phone</Label>
          <Input
            ref={phoneRef}
            defaultValue={getFormattedPhone(template.phone)}
            onChange={handleChange}
            placeholder="(123) 456-7890"
            className={`bg-gray-800 text-white border ${
              phoneError ? 'border-red-500' : 'border-gray-700'
            }`}
          />
          {phoneError && (
            <p className="text-red-500 text-xs mt-1">{phoneError}</p>
          )}
        </div>
      </div>
    </Collapsible>
  );
}
