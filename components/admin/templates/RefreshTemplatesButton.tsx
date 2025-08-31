// components/admin/templates/RefreshTemplatesButton.tsx
'use client';

import { useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';

export default function RefreshTemplatesButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const refresh = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch('/api/templates/revalidate', { method: 'POST' });
      if (!res.ok) throw new Error('Server refresh failed');
      toast.success('Templates refreshed');
      router.refresh();                // re-run server components
    } catch (e: any) {
      toast.error(e?.message ?? 'Refresh failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={refresh}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded border border-white/10 bg-neutral-900 px-3 py-1.5 text-sm text-white hover:bg-neutral-800 disabled:opacity-60"
      title="Clear cache and pull latest"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
      {loading ? 'Refreshing…' : 'Refresh'}
    </button>
  );
}
