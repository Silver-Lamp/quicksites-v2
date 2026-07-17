// components/admin/templates/render-blocks/faq.tsx
'use client';

import type { Block } from '@/types/blocks';
import SectionShell from '@/components/ui/section-shell';

type Props = {
  block?: Block;
  content?: Block['content'];
  compact?: boolean;
  colorMode?: 'light' | 'dark';
};

type FaqContent = {
  title?: string;
  items?: Array<{ question: string; answer: string }>;
};

function pickFaq(block?: Block, override?: Block['content']): FaqContent {
  // Prefer explicit override, then block.content, then block.props
  const c = (override as FaqContent) ?? (block?.content as FaqContent);
  const p = (block as any)?.props as FaqContent | undefined;

  if (c?.items?.length) return { title: c.title, items: c.items };
  if (p?.items?.length) return { title: p.title, items: p.items };

  // Merge titles if only one has it
  return {
    title: c?.title ?? p?.title ?? 'Frequently Asked Questions',
    items: [],
  };
}

export default function FaqRender({
  block,
  content,
  compact = false,
  colorMode = 'light',
}: Props) {
  const final = pickFaq(block, content);

  if (!final.items?.length) {
    return (
      <div className="text-red-500 italic text-sm p-2 bg-red-50 dark:bg-red-900/20 rounded">
        ⚠️ Missing FAQ block content.
      </div>
    );
  }

  // FAQPage JSON-LD — honest framing: Google restricted FAQ rich results to
  // authoritative sites in Aug 2023, so we do NOT promise star-adjacent dropdowns.
  // The markup still earns its bytes: Bing renders FAQ results, and AI-search
  // crawlers consume the Q/A structure directly. Cheap, correct, no overclaim.
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: final.items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };

  return (
    <SectionShell
      compact={compact}
      className={`${!compact ? 'bg-card text-card-foreground border border-border rounded-lg p-4 shadow-sm mb-8' : ''}`}
    >
      {!compact && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      )}
      <div className="flex justify-center">
        <div className="flex flex-col items-start text-left w-full max-w-2xl pl-6 sm:pl-12 md:pl-0 md:ml-8 text-card-foreground">
          <h3 className={compact ? 'font-semibold mb-1' : 'text-xl font-semibold mb-4'}>
            {final.title || 'Frequently Asked Questions'}
          </h3>
          <hr className="my-4 border-border" />
          <dl className="space-y-4">
            {final.items.map((item, i) => (
              <div key={`${item.question}-${i}`}>
                <dt className="font-semibold">{item.question}</dt>
                <dd className="ml-4 mt-1 text-sm text-muted-foreground">{item.answer}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </SectionShell>
  );
}
