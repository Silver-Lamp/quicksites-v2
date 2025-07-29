'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Link2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function GSCStatusBadge({ domain }: { domain: string }) {
  const [status, setStatus] = useState<'loading' | 'connected' | 'missing'>('loading');

  useEffect(() => {
    fetch(`/api/gsc/status?domain=${encodeURIComponent(domain)}`)
      .then((res) => res.ok ? res.json() : { connected: false })
      .then((res) => setStatus(res.connected ? 'connected' : 'missing'))
      .catch(() => setStatus('missing'));
  }, [domain]);

  const oauthUrl = `/api/gsc/oauth/start?domain=${encodeURIComponent(domain)}`;

  return (
    <div className="flex items-center gap-2 text-sm">
      {status === 'loading' && <span className="text-gray-400">Checking...</span>}
      {status === 'connected' && (
        <span className="flex items-center text-green-400">
          <CheckCircle size={16} className="mr-1" /> Connected
        </span>
      )}
      {status === 'missing' && (
        <a href={oauthUrl} className="inline-flex items-center text-yellow-400 underline">
          <XCircle size={16} className="mr-1" />
          Connect GSC
        </a>
      )}
    </div>
  );
}
