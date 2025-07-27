// File: panels/ServicesPanel.tsx

import Collapsible from '@/components/ui/collapsible-panel';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import type { Template } from '@/types/template';

export default function ServicesPanel({ template, onChange }: { template: Template; onChange: (updated: Template) => void }) {
  return (
    <Collapsible title="Available Services" id="template-services">
      <div className="space-y-2">
        <Label>Service Options (used by contact forms)</Label>

        {template.data?.services?.map((service: string, i: number) => (
          <div key={i} className="flex gap-2 items-center">
            <Input
              value={service}
              onChange={(e) => {
                const updated = [...(template.data?.services || [])];
                updated[i] = e.target.value;
                onChange({
                  ...template,
                  data: {
                    ...template.data,
                    services: updated,
                  },
                  services: updated,
                });
              }}
              className="w-full bg-gray-800 text-white border border-gray-700 rounded px-2 py-1"
            />
            <button
              type="button"
              onClick={() => {
                const updated = [...(template.data?.services || [])];
                updated.splice(i, 1);
                onChange({
                  ...template,
                  data: {
                    ...template.data,
                    services: updated,
                  },
                  services: updated,
                });
              }}
              className="text-red-400 text-sm"
            >
              Remove
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => {
            const updated = [...(template.data?.services || []), 'New Service'];
            onChange({
              ...template,
              data: {
                ...template.data,
                services: updated,
              },
              services: updated,
            });
          }}
          className="text-sm text-green-400 underline"
        >
          + Add Service
        </button>
      </div>
    </Collapsible>
  );
}
