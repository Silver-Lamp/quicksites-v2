'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'react-hot-toast';

export default function OGBulkRebuild({ slug }: { slug: string }) {
  const [progress, setProgress] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const handleRebuildAll = async () => {
    setLoading(true);
    setProgress([]);
    try {
      const res = await fetch('/api/dev/og/rebuild-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
      const data = await res.json();
      if (res.ok) {
        const results = Object.entries(data.pages).map(
          ([page, result]) => `${page}: ${result}`
        );
        setProgress(results);
        toast.success('OG rebuild complete');
      } else {
        toast.error('Failed to rebuild all OG images');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error during OG rebuild');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-6 space-y-3">
      <Button onClick={handleRebuildAll} disabled={loading}>
        {loading ? 'Rebuilding OG Images...' : 'Rebuild All OG Images'}
      </Button>
      {progress.length > 0 && (
        <div className="text-sm text-white/80 space-y-1">
          {progress.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      )}
    </div>
  );
}
