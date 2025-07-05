// components/ui/inspirational-quote.tsx
'use client';

import { useEffect, useState } from 'react';

const QUOTES: { text: string; tags: string[] }[] = [
  {
    text: 'Helping one small business thrive can uplift a whole community.',
    tags: ['small-business', 'persistence'],
  },
  {
    text: 'Success is built by showing up — even on the quiet days.',
    tags: ['persistence'],
  },
  {
    text: 'Your website is your digital storefront. Make it easy to find.',
    tags: ['seo', 'small-business'],
  },
  {
    text: 'A single lead can change a business. SEO helps them find you.',
    tags: ['seo', 'small-business'],
  },
  {
    text: 'Build slow. Rank steady. Win long-term.',
    tags: ['seo', 'persistence'],
  },
  {
    text: 'Every click is a chance to earn trust.',
    tags: ['seo', 'persistence'],
  },
  {
    text: 'Most overnight successes took 10 years.',
    tags: ['persistence'],
  },
];

export default function InspirationalQuote({ tags = [] }: { tags?: string[] }) {
  const [quote, setQuote] = useState<string>('');

  useEffect(() => {
    const filtered = tags.length
      ? QUOTES.filter((q) => q.tags.some((tag) => tags.includes(tag)))
      : QUOTES;
    const chosen = filtered[Math.floor(Math.random() * filtered.length)];
    setQuote(chosen?.text || '');
  }, [tags]);

  return <span className="italic opacity-75">{quote}</span>;
}
