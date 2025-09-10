'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';

type Props = {
  dateParam?: string;
  includeVersions?: boolean;
  /** Leave empty/omit to avoid hitting a server-side revalidate endpoint. */
  revalidatePath?: string;
};

export default function RefreshTemplatesButton({
  dateParam = '',
  includeVersions = false,
  revalidatePath = '', // 🚫 default: no server revalidate
}: Props) {
  const [busy, setBusy] = React.useState(false);

  const runRefresh = React.useCallback(async () => {
    if (busy) return; // debounce re-entrancy
    try {
      setBusy(true);

      // (optional) only if you explicitly provide a path
      if (revalidatePath) {
        await fetch(revalidatePath, { method: 'POST', cache: 'no-store' }).catch(() => {});
      }

      // Tell the list to refetch (TemplatesListClient listens to this)
      window.dispatchEvent(
        new CustomEvent('qs:templates:refetch', {
          detail: { dateParam, includeVersions, source: 'refresh-button' },
        }),
      );
    } finally {
      setBusy(false);
    }
  }, [busy, dateParam, includeVersions, revalidatePath]);

  // ✅ Listen ONLY to `qs:templates:refresh` (never to `refetch`) to avoid loops
  React.useEffect(() => {
    const handler = () => { void runRefresh(); };
    window.addEventListener('qs:templates:refresh', handler as EventListener);
    return () => window.removeEventListener('qs:templates:refresh', handler as EventListener);
  }, [runRefresh]);

  return (
    <Button
      type="button"
      onClick={() => void runRefresh()}
      variant="outline"
      size="sm"
      className="gap-2"
      disabled={busy}
      title="Refresh templates"
    >
      <RotateCcw className={busy ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
      {busy ? 'Refreshing…' : 'Refresh'}
    </Button>
  );
}
