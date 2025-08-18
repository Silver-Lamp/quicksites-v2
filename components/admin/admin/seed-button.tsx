// components/admin/admin/seed-button.tsx
'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import toast from 'react-hot-toast';
// If you already have the helper in utils, use that:
import { postJSON } from '@/components/admin/tools/utils';

export default function SeedButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSeed = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      // Sends Supabase auth cookies via the helper (credentials:'include')
      await postJSON('/api/admin/seed-template', {});

      toast.success('🎉 Seeded example template');
      router.refresh(); // soft refresh any server components reading data
    } catch (err: any) {
      toast.error(`Seed failed: ${err?.message ?? 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }, [loading, router]);

  return (
    <Button
      onClick={handleSeed}
      disabled={loading}
      aria-busy={loading}
      className="text-sm"
    >
      {loading ? 'Seeding…' : '🌱 Seed Sample Template'}
    </Button>
  );
}
