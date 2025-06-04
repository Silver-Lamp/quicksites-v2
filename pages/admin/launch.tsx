// pages/launch.tsx
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { publishSite } from '@/admin/lib/publishSite';
import { logEvent } from '@/admin/lib/logEvent';
import dynamic from 'next/dynamic';

const SitePreview = dynamic(() => import('@/admin/components/SitePreview'), { ssr: false });

export default function LaunchPage() {
  const params = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'confirm' | 'publishing' | 'done' | 'error'>('idle');
  const [siteParams, setSiteParams] = useState<Record<string, any> | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raw = params.get('params');
    if (!raw) return;
    try {
      const parsed = JSON.parse(decodeURIComponent(raw));
      setSiteParams(parsed);
      setStatus('confirm');
    } catch (err: any) {
      setError('Invalid parameters.');
      setStatus('error');
    }
  }, [params]);

  const handlePublish = async () => {
    if (!siteParams) return;
    setStatus('publishing');
    try {
      const url = await publishSite(siteParams);
      await logEvent('deploy_site', {
        params: siteParams,
        resultUrl: url,
      });
      setResultUrl(url);
      setStatus('done');
    } catch (err: any) {
      setError(err.message || 'Failed to publish');
      setStatus('error');
    }
  };

  return (
    <div className="p-10 max-w-2xl mx-auto text-center space-y-6">
      <h1 className="text-3xl font-bold">🚀 Launch QuickSite</h1>

      {status === 'confirm' && siteParams && (
        <div className="space-y-6">
          <p className="text-gray-700">Please confirm the following parameters:</p>
          <pre className="text-left text-sm bg-gray-100 p-4 rounded border overflow-auto max-h-96">
            {JSON.stringify(siteParams, null, 2)}
          </pre>

          <div className="border rounded bg-white p-4 shadow">
            <p className="text-left text-sm font-medium mb-2">Preview:</p>
            <div className="border rounded overflow-hidden">
              <SitePreview params={siteParams} />
            </div>
          </div>

          <button
            onClick={handlePublish}
            className="bg-purple-600 text-white px-4 py-2 rounded text-sm"
          >
            ✅ Confirm and Deploy
          </button>
        </div>
      )}

      {status === 'publishing' && <p>Publishing your site, please wait...</p>}

      {status === 'done' && resultUrl && (
        <div className="space-y-4">
          <p className="text-green-600 font-semibold">Site published successfully!</p>
          <a
            href={resultUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-blue-600 hover:text-blue-800"
          >
            View your live site
          </a>
        </div>
      )}

      {status === 'error' && <p className="text-red-600">Error: {error}</p>}
    </div>
  );
}
