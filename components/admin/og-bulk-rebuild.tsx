'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'react-hot-toast';

export default function OGBulkRebuild({ slug, endpoint, onResult }: { slug: string, endpoint: string, onResult: (results: Record<string, string>) => void }) {
  const [progress, setProgress] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const handleRebuildAll = async () => {
    setLoading(true);
    setProgress({});
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
      const data = await res.json();
      if (res.ok) {
        setProgress(data.pages);
        onResult(data.pages);
      } else {
        const message = data?.error || `Error ${res.status}`;
        toast.error(`❌ Failed to rebuild: ${message}`);
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
      {Object.keys(progress).length > 0 && (
        <div className="text-sm text-white/80 space-y-1">
          {Object.entries(progress).map(([page, result]) => (
            <div key={page}>{page}: {result}</div>
          ))}
        </div>
      )}
    </div>
  );
}
