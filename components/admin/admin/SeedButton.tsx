// components/admin/SeedButton.tsx
import { useState } from 'react';
import { Button } from '@/components/admin/ui/button';
import toast from 'react-hot-toast';

export default function SeedButton() {
  const [loading, setLoading] = useState(false);

  const handleSeed = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/seed-template', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('sb-access-token')}`
        }
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Seed failed');
      toast.success('🎉 Seeded example template');
    } catch (err: any) {
      toast.error(`Seed failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleSeed} disabled={loading} className="text-sm">
      {loading ? 'Seeding...' : '🌱 Seed Sample Template'}
    </Button>
  );
}
