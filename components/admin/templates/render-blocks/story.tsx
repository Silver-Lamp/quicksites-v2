// components/admin/templates/render-blocks/story.tsx
'use client';

// Alternating image + text "story" sections — brand storytelling like a converted
// Shopify site's "Created by…" / "How it works" panels. Each section renders the
// image and copy side-by-side, alternating left/right down the page, and stacks
// vertically on mobile. Sections without an image render text full-width.

import Link from 'next/link';
import type { Block } from '@/types/blocks';
import type { Template } from '@/types/template';

type StorySection = {
  heading: string;
  body?: string;
  image_url?: string;
  cta_text?: string;
  cta_link?: string;
};

type StoryContent = {
  title?: string;
  sections?: StorySection[];
};

/** Prefer explicit override, then block.content, then block.props (renderer parity). */
function pickContent(block?: Block, override?: Block['content']): StoryContent {
  const c = (override as StoryContent) ?? (block?.content as StoryContent);
  const p = (block as any)?.props as StoryContent | undefined;
  const sections =
    (Array.isArray(c?.sections) && c!.sections!.length ? c!.sections! :
     Array.isArray(p?.sections) ? p!.sections! : []);
  return { title: c?.title ?? p?.title, sections };
}

/**
 * Body typography for a story section.
 *
 * ⚠️ `whitespace-pre-line` ON ONE <p> IS NOT TYPOGRAPHY, IT IS A LINE-BREAK SETTING. It preserves
 * newlines and nothing else — no space between items, no measure, no rhythm. A body of eight
 * achievements rendered that way is a grey wall the eye slides off, and it looked fine in review
 * because every WORD was correct. Seen on a published résumé at full width: eleven lines running
 * ~150 characters each, indistinguishable from one another.
 *
 * So: a body containing newlines is a LIST of things and gets spacing between them; a body without
 * newlines is prose and is left exactly as it was. The distinction is the author's own line breaks,
 * which is the only signal available and the one they actually meant.
 *
 * ⚠️ AND THE MEASURE IS CAPPED. Line length is the single biggest lever on readability — past
 * roughly 75 characters the eye loses the line's start on the return sweep. The container is
 * max-w-6xl for images; the text does not want to be.
 */
function StoryBody({ text, className }: { text: string; className: string }) {
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);

  if (lines.length < 2) {
    return <p className={`max-w-[68ch] text-base leading-relaxed ${className}`}>{text}</p>;
  }

  return (
    <div className={`max-w-[68ch] space-y-2.5 text-base leading-relaxed ${className}`}>
      {lines.map((line, i) => (
        <p key={i}>{line}</p>
      ))}
    </div>
  );
}

export default function StoryBlock({
  block,
  colorMode = 'dark',
  content,
  previewOnly = false,
}: {
  block: Block;
  colorMode?: 'light' | 'dark';
  template?: Template;
  content?: Block['content'];
  previewOnly?: boolean;
}) {
  const final = pickContent(block, content);
  const sections = (final.sections ?? []).filter((s) => s?.heading || s?.body || s?.image_url);
  if (!sections.length) return null;

  const headingColor = 'text-foreground';
  const bodyColor = 'text-muted-foreground';
  const ctaColor = 'bg-primary text-primary-foreground hover:opacity-90';

  return (
    <section className="px-6 py-12">
      <div className="mx-auto max-w-6xl space-y-16">
        {final.title && (
          <h2 className={`text-center text-3xl font-bold tracking-tight ${headingColor}`}>{final.title}</h2>
        )}
        {sections.map((s, i) => {
          const hasImage = !!s.image_url;
          const reversed = i % 2 === 1; // alternate image side
          return (
            <div
              key={i}
              className={`grid items-center gap-8 ${hasImage ? 'md:grid-cols-2' : 'md:grid-cols-1'}`}
            >
              {hasImage && (
                <div className={`overflow-hidden rounded-xl ${reversed ? 'md:order-2' : 'md:order-1'}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.image_url}
                    alt={s.heading || `Story image ${i + 1}`}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
              )}
              <div className={`space-y-4 ${hasImage && reversed ? 'md:order-1' : 'md:order-2'}`}>
                {s.heading && <h3 className={`text-2xl font-semibold ${headingColor}`}>{s.heading}</h3>}
                {s.body && <StoryBody text={s.body} className={bodyColor} />}
                {s.cta_text && s.cta_link && (
                  <Link
                    href={previewOnly ? '#' : s.cta_link}
                    className={`inline-flex w-fit items-center rounded-md px-4 py-2 text-sm font-medium transition ${ctaColor}`}
                    {...(previewOnly ? { onClick: (e: any) => e.preventDefault(), tabIndex: -1 } : {})}
                  >
                    {s.cta_text}
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
