'use client';

import { Badge } from '@/components/ui/badge';

export function SqlFieldPreview({ fields }: { fields: Record<string, any> }) {
  return (
    <div className="border border-blue-800 bg-blue-950 text-blue-200 rounded p-3 text-xs space-y-1 mt-4">
      <div className="font-semibold text-blue-300">Promoted SQL Fields:</div>
      <ul className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1">
        {Object.entries(fields).map(([key, value]) => (
          <li key={key}>
            <span className="text-blue-400">{key}</span>: <span className="text-white">{String(value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
