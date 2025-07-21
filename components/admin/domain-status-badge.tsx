'use client';

import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

type Status = 'verifying' | 'verified' | 'unverified';

const TTL_MINUTES = 60;

export default function DomainStatusBadge({ domain }: { domain: string }) {
  const [status, setStatus] = useState<Status>('verifying');
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);

  const storageKey = `domain_status_${domain}`;

  const fetchStatus = async () => {
    if (!domain) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/verify-domain?domain=${domain}`);
      const verified = res.ok;
      const now = new Date();
      setStatus(verified ? 'verified' : 'unverified');
      setLastChecked(now);
      localStorage.setItem(
        storageKey,
        JSON.stringify({ status: verified ? 'verified' : 'unverified', lastChecked: now.toISOString() })
      );
      toast.success(verified ? 'Domain verified!' : 'Domain not verified');
    } catch {
      toast.error('Error checking domain.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      setStatus(parsed.status);
      setLastChecked(new Date(parsed.lastChecked));
    }
    fetchStatus();
    const interval = setInterval(fetchStatus, 15 * 1000);
    return () => clearInterval(interval);
  }, [domain]);

  const minutesSinceLastCheck =
    lastChecked ? Math.round((Date.now() - lastChecked.getTime()) / 60000) : null;
  const isStale = minutesSinceLastCheck !== null && minutesSinceLastCheck > TTL_MINUTES;

  const styles = {
    verifying: 'bg-yellow-800 text-yellow-100 border border-yellow-500',
    verified: isStale
      ? 'bg-green-900 text-yellow-100 border border-yellow-500'
      : 'bg-green-700 text-green-100 border border-green-500',
    unverified: 'bg-red-800 text-red-100 border border-red-500',
  };

  return (
    <div className="space-y-1">
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${styles[status]}`}>
        {status === 'verifying' && '⏳ Verifying...'}
        {status === 'verified' && (isStale ? '⚠ Stale Verified' : '✅ Verified')}
        {status === 'unverified' && '❌ Not Verified'}
      </span>
      <div className="text-xs text-gray-400 mt-1 flex items-center gap-2">
        <button
          onClick={fetchStatus}
          disabled={loading}
          className="underline text-blue-400 hover:text-blue-200 disabled:opacity-50"
        >
          Re-check now
        </button>
        {lastChecked && <span>Last checked: {lastChecked.toLocaleTimeString()}</span>}
      </div>
    </div>
  );
}
