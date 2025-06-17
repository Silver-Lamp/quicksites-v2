import { useEffect, useState } from 'react';
import type { LinkTheme } from '@/admin/lib/links/theme';

export function useSmartLinkPersisted() {
  const [theme, setTheme] = useState<LinkTheme>('primary');
  const [query, setQuery] = useState<Record<string, string | number | boolean>>(
    {}
  );

  useEffect(() => {
    const stored = localStorage.getItem('smartlink.ctx');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.theme) setTheme(parsed.theme);
        if (parsed.query) setQuery(parsed.query);
      } catch {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('smartlink.ctx', JSON.stringify({ theme, query }));
  }, [theme, query]);

  return {
    theme,
    query,
    setTheme,
    setQuery,
  };
}
