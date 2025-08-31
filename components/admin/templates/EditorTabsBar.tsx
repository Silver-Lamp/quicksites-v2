// components/admin/templates/EditorTabsBar.tsx
'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import clsx from 'clsx';

export function EditorTabsBar() {
  const pathname = usePathname();
  const search = new URLSearchParams(useSearchParams()?.toString());
  const active = (search.get('tab') ?? 'blocks') as 'blocks' | 'live';

  function hrefFor(tab: 'blocks' | 'live') {
    const next = new URLSearchParams(search.toString());
    next.set('tab', tab);
    return `${pathname}?${next.toString()}`;
  }

  const item = (tab: 'blocks' | 'live', label: string) => (
    <Link
      key={tab}
      href={hrefFor(tab)}
      className={clsx(
        'px-4 py-2 text-sm rounded-t-md border-b-2',
        active === tab
          ? 'border-foreground font-medium'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      )}
      prefetch={false}
    >
      {label}
    </Link>
  );

  return (
    <div className="flex gap-2 border-b mb-3">
      {item('blocks', 'Blocks')}
      {item('live', 'Live')}
    </div>
  );
}
