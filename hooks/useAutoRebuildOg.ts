'use client';

import { useEffect } from 'react';

export function useAutoRebuildOg(slug: string, pageSlug: string, title: string, published: boolean) {
  useEffect(() => {
    if (!slug || !pageSlug || !published) return;

    const trigger = async () => {
      await fetch('/api/webhook/og-rebuild', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, page: pageSlug }),
      });
    };

    trigger();
  }, [slug, pageSlug, title, published]);
}
