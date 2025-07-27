'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Collapsible from '@/components/ui/collapsible-panel';
import type { Template } from '@/types/template';

export default function IdentityPanel({
  template,
  onChange,
}: {
  template: Template;
  onChange: (updated: Template) => void;
}) {
  const industries = [
    'Towing',
    'Roof Cleaning',
    'Window Cleaning',
    'Pressure Washing',
    'Junk Removal',
    'Other',
  ];

  return (
    <Collapsible title="Template Identity" id="template-identity">
      <div className="space-y-4">
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
            {industries.map((industry) => (
              <option key={industry} value={industry}>
                {industry}
              </option>
            ))}
          </select>
        </div>
      </div>
    </Collapsible>
  );
}
