// components/auth/MagicLinkBridge.tsx
'use client';

import { useEffect } from 'react';

export default function MagicLinkBridge() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // If magic-link tokens are present in the fragment, hand them off to /auth/callback
    const hash = window.location.hash || '';
    if (hash.includes('access_token=') && hash.includes('refresh_token=')) {
      const search = window.location.search || '';
      const dest = `/auth/callback${search}${hash}`;
      // Replace to avoid the fragment + root landing in history
      window.location.replace(dest);
    }
  }, []);
  return null;
}
