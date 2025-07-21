'use client';

import { useEffect } from 'react';

export function useVerifyDomain(domain: string | null) {
  useEffect(() => {
    if (!domain) return;
    const url = `/api/verify-domain?domain=${encodeURIComponent(domain)}`;
    fetch(url).then((res) => {
      if (!res.ok) console.warn('Domain verification failed');
    });
  }, [domain]);
}
