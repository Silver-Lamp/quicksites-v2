// components/ui/inspirational-quote.tsx
'use client';

import { useEffect, useState } from 'react';

const QUOTES: { text: string; tags: string[] }[] = [
  {
    text: 'Helping one small business thrive doesn’t just change a balance sheet — it changes a neighborhood.',
    tags: ['small-business', 'persistence'],
  },
  {
    text: 'Success rarely comes with applause. It comes quietly, when you show up on the slow days.',
    tags: ['persistence'],
  },
  {
    text: 'Your website is your digital storefront. Keep the lights on. Make it easy to walk in.',
    tags: ['seo', 'small-business'],
  },
  {
    text: 'One good lead can shift the future. Make sure you’re findable when it matters.',
    tags: ['seo', 'small-business'],
  },
  {
    text: 'Build slow. Rank steady. Win long-term. This is the rhythm of real growth.',
    tags: ['seo', 'persistence'],
  },
  {
    text: 'Every click is a quiet moment of trust. Honor it.',
    tags: ['seo', 'persistence'],
  },
  {
    text: 'Most “overnight” success stories took a decade of quiet persistence.',
    tags: ['persistence'],
  },
  {
    text: 'When you support a small business, you support a dream — not a boardroom.',
    tags: ['small-business'],
  },
  {
    text: 'SEO isn’t magic. It’s consistency, clarity, and showing up every day.',
    tags: ['seo', 'persistence'],
  },
  {
    text: 'Local businesses are the soul of a city. Make sure yours has a voice online.',
    tags: ['seo', 'small-business'],
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
