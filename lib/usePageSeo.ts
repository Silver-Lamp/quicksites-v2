// ✅ FILE: lib/usePageSeo.ts

import { useRouter } from 'next/router';
import { getPageSeo } from './seo';

export function usePageSeo({
  title,
  description,
}: {
  title?: string;
  description: string;
}) {
  const { pathname } = useRouter();

  const derivedTitle =
    title ||
    pathname
      .replace(/^\//, '')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase()) ||
    'Home';

  return getPageSeo({
    title: derivedTitle,
    description,
    slug: pathname,
  });
}
