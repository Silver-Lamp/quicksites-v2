import { useEffect } from 'react';

export function useRefTracker() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const refData: Record<string, string> = {};

    ['ref', 'source', 'campaign'].forEach(key => {
      const value = params.get(key);
      if (value) refData[key] = value;
    });

    if (Object.keys(refData).length) {
      localStorage.setItem('referrer_info', JSON.stringify(refData));
    }
  }, []);
}
