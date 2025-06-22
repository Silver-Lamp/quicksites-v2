// hooks/useSmartNav.ts
import { useEffect, useState } from 'react';

export type NavRoute = {
  href: string;
  label: string;
  title?: string;
  external?: boolean;
  flags?: string[];
};

export type NavSection = {
  label: string;
  color: string;
  routes: NavRoute[];
};

export function useSmartNav() {
  const [nav, setNav] = useState<NavSection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/nav');
        const json = await res.json();
        setNav(json.sections || []);
      } catch (err) {
        console.error('Failed to load nav:', err);
        setNav([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return { nav, loading };
}
