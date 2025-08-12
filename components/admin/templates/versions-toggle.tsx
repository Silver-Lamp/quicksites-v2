'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export default function VersionsToggle({ hiddenCount = 0 }: { hiddenCount?: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const showAll = params.get('versions') === 'all';

  function toggle() {
    const next = new URLSearchParams(params.toString());
    if (showAll) next.delete('versions');
    else next.set('versions', 'all');
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="inline-flex items-center gap-2 rounded border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-800"
      title={showAll ? 'Hide versioned rows' : 'Show all versions'}
    >
      {showAll ? 'Hide versions' : 'Show versions'}
      {!showAll && hiddenCount > 0 && (
        <span className="text-xs rounded bg-zinc-700 px-1.5 py-0.5">{hiddenCount} hidden</span>
      )}
    </button>
  );
}
