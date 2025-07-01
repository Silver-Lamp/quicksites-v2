'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui';

export default function PrebuildOGPage() {
  const [slugs, setSlugs] = useState<string[]>([]);
  const [results, setResults] = useState<Record<string, 'pending' | 'success' | 'error'>>({});
  const [loading, setLoading] = useState(false);
  const [totalMB, setTotalMB] = useState<string>('0.0');

  const fetchSlugs = async () => {
    const res = await fetch('/api/compare-slugs');
    const data = await res.json();
    setSlugs(data.slugs);
    setResults(Object.fromEntries(data.slugs.map((slug: string) => [slug, 'pending'])));
  };

  const fetchStorageInfo = async () => {
    const res = await fetch('/api/list-og-zips');
    const data = await res.json();
    setTotalMB(data.totalMB || '0.0');
  };

  const triggerBuilds = async () => {
    setLoading(true);
    for (const slug of slugs) {
      try {
        const res = await fetch(`/og/compare/${slug}`);
        if (res.ok) {
          setResults((prev) => ({ ...prev, [slug]: 'success' }));
        } else {
          setResults((prev) => ({ ...prev, [slug]: 'error' }));
        }
      } catch {
        setResults((prev) => ({ ...prev, [slug]: 'error' }));
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSlugs();
    fetchStorageInfo();
  }, []);

  const overQuota = parseFloat(totalMB) > 100;

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold">
            Prebuild OG Images{' '}
            {overQuota ? (
              <span className="text-sm text-red-500 ml-2">({totalMB} MB used – over quota)</span>
            ) : (
              <span className="text-sm text-muted-foreground ml-2">({totalMB} MB used)</span>
            )}
          </h1>
          <div className="w-full h-3 bg-gray-200 rounded overflow-hidden">
            <div
              className={`h-full ${overQuota ? 'bg-red-500' : 'bg-blue-500'}`}
              style={{ width: `${Math.min(100, parseFloat(totalMB))}%` }}
            />
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            const zipUrl = `/api/download-og-zip?slugs=${encodeURIComponent(
              slugs.filter((s) => results[s] === 'success').join(',')
            )}`;
            window.open(zipUrl, '_blank');
          }}
          disabled={!slugs.some((s) => results[s] === 'success')}
        >
          Download All as ZIP
        </Button>
      </div>

      {overQuota && (
        <div className="text-sm text-yellow-600 bg-yellow-100 border border-yellow-300 rounded px-4 py-2">
          Storage limit exceeded. Please delete old exports before generating new ones.
        </div>
      )}

      <Button onClick={triggerBuilds} disabled={loading || slugs.length === 0 || overQuota}>
        {loading ? 'Generating...' : 'Start Prebuild'}
      </Button>

      <ul className="text-sm space-y-4">
        {slugs.map((slug) => (
          <li key={slug} className="border p-4 rounded shadow-sm">
            <div className="flex justify-between mb-2">
              <span className="font-mono text-sm">{slug}</span>
              <span
                className={
                  results[slug] === 'success'
                    ? 'text-green-500'
                    : results[slug] === 'error'
                      ? 'text-red-500'
                      : 'text-muted-foreground'
                }
              >
                {results[slug]}
              </span>
            </div>
            {results[slug] === 'success' && (
              <img
                src={`/og/compare/${slug}`}
                alt={`OG image for ${slug}`}
                className="w-full border rounded"
              />
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
