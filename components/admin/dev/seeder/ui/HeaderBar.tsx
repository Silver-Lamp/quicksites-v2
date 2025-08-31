// components/admin/dev/seeder/ui/HeaderBar.tsx
'use client';

import { CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';

export function HeaderBar({ title, open }: { title: string; open: boolean }) {
  return (
    <div className="flex items-center justify-between px-3 py-2">
      <div className="text-sm font-medium">{title}</div>
      <CollapsibleTrigger asChild>
        <button
          className="inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs hover:bg-muted transition"
          aria-label={open ? 'Collapse' : 'Expand'}
        >
          {open ? 'Hide' : 'Show'}
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </CollapsibleTrigger>
    </div>
  );
}

export function SubHeaderBar({ title, open }: { title: string; open: boolean }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 bg-muted/30">
      <div className="text-xs font-medium">{title}</div>
      <CollapsibleTrigger asChild>
        <button
          className="inline-flex items-center gap-2 rounded-md border px-2 py-1 text-[11px] hover:bg-muted transition"
          aria-label={open ? 'Collapse' : 'Expand'}
        >
          {open ? 'Hide' : 'Show'}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </CollapsibleTrigger>
    </div>
  );
}
