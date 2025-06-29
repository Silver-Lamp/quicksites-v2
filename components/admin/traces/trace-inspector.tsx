// components/admin/traces/trace-inspector.tsx
'use client';

import { useState } from 'react';
import { TraceFilterControls } from './trace-filter-controls';
import { GroupByRoute } from './group-by-route';
import { FilterBar } from './filter-bar';

export function TraceInspector({
  traceId,
  entries,
}: {
  traceId: string;
  entries: any[];
}) {
  const [filtered, setFiltered] = useState(entries);

  return (
    <div className="p-6 max-w-5xl mx-auto text-sm">
      <h1 className="text-lg font-semibold text-indigo-400 mb-2">
        Trace: {traceId.slice(0, 8)} ({entries.length} event{entries.length > 1 ? 's' : ''})
      </h1>

      <TraceFilterControls entries={entries} onChange={setFiltered} />
      <FilterBar entries={filtered} onFilter={setFiltered} />
      <GroupByRoute entries={filtered} />
    </div>
  );
}
