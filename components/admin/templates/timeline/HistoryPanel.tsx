// components/admin/templates/timeline/HistoryPanel.tsx
'use client';
import { useEffect, useState } from 'react';
import { dedupeTimeline, type TimelineEntry } from '@/lib/timeline';

export default function HistoryPanel({ templateId, enabled }: { templateId: string; enabled: boolean }) {
  const [items, setItems] = useState<TimelineEntry[] | null>(null);

  useEffect(() => {
    if (!enabled || items) return; // fetch once on first open
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/templates/${templateId}/history`);
      const data: TimelineEntry[] = await res.json();
      if (!cancelled) setItems(dedupeTimeline(data));
    })();
    return () => { cancelled = true; };
  }, [enabled, templateId, items]);

  if (!enabled && !items) return null;
  if (!items) return <div className="text-sm opacity-70">Loading history…</div>;

  return (
    <ul className="space-y-3">
      {items.map((e, i) => (
        <li key={(e.id ?? '') + i} className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">{e.kind}{e.rev != null ? ` rev ${e.rev}` : ''}</div>
            <div className="text-xs opacity-60">{e.at ? new Date(e.at).toLocaleTimeString() : ''}</div>
          </div>
          {/* …badges for deltas etc */}
        </li>
      ))}
    </ul>
  );
}
