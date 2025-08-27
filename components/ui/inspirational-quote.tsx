// components/ui/inspirational-quote.tsx
'use client';

import * as React from 'react';

type Quote = { text: string; tags: readonly string[] };

const QUOTES: readonly Quote[] = [
  { text: 'Helping one small business thrive doesn’t just change a balance sheet — it changes a neighborhood.', tags: ['small-business', 'persistence'] },
  { text: 'Success rarely comes with applause. It comes quietly, when you show up on the slow days.', tags: ['persistence'] },
  { text: 'Your website is your digital storefront. Keep the lights on. Make it easy to walk in.', tags: ['seo', 'small-business'] },
  { text: 'One good lead can shift the future. Make sure you’re findable when it matters.', tags: ['seo', 'small-business'] },
  { text: 'Build slow. Rank steady. Win long-term. This is the rhythm of real growth.', tags: ['seo', 'persistence'] },
  { text: 'Most “overnight” success stories took a decade of quiet persistence.', tags: ['persistence'] },
  { text: 'When you support a small business, you support a dream — not a boardroom.', tags: ['small-business'] },
  { text: 'SEO isn’t magic. It’s consistency, clarity, and showing up every day.', tags: ['seo', 'persistence'] },
  { text: 'Local businesses are the soul of a city. Make sure yours has a voice online.', tags: ['seo', 'small-business'] },

  // new additions
  { text: 'Clarity beats clever. Say what you do in seven words.', tags: ['small-business', 'seo'] },
  { text: 'Answer the question they typed, not the one you wish they asked.', tags: ['seo'] },
  { text: 'Consistency compounds. Publish something useful every week.', tags: ['persistence', 'seo'] },
  { text: 'Speed is a feature. Faster pages earn trust.', tags: ['seo'] },
  { text: 'A phone number on every page is a conversion strategy.', tags: ['small-business'] },
  { text: 'Don’t guess. Talk to five customers and update your homepage.', tags: ['small-business'] },
  { text: 'Rankings follow relevance. Relevance follows empathy.', tags: ['seo', 'persistence'] },
  { text: 'If it’s not trackable, it’s not improvable.', tags: ['seo'] },
  { text: 'Real people > vanity metrics.', tags: ['small-business'] },
  { text: 'Do less, but do it every day.', tags: ['persistence'] },
];

export default function InspirationalQuote({
  tags = [],
  rotateEveryMs,
}: {
  tags?: readonly string[];
  /** optional: auto-rotate through matching quotes */
  rotateEveryMs?: number;
}) {
  // Stable key from tag contents (prevents re-running effects when parent passes a new array ref)
  const tagKey = React.useMemo(
    () => [...new Set(tags)].sort().join(','),
    [tags]
  );

  const filtered = React.useMemo(() => {
    if (!tagKey) return QUOTES;
    const set = new Set(tagKey.split(',').filter(Boolean));
    const list = QUOTES.filter((q) => q.tags.some((t) => set.has(t)));
    return list.length ? list : QUOTES;
  }, [tagKey]);

  const [index, setIndex] = React.useState(0);

  // Pick a fresh random quote whenever the tag set changes
  React.useEffect(() => {
    setIndex(Math.floor(Math.random() * filtered.length));
  }, [filtered]);

  // Optional rotation
  React.useEffect(() => {
    if (!rotateEveryMs || rotateEveryMs <= 0) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % filtered.length);
    }, rotateEveryMs);
    return () => clearInterval(id);
  }, [rotateEveryMs, filtered.length]);

  const text = filtered[index]?.text ?? '';
  return <span className="italic opacity-75">{text}</span>;
}
