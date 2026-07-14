/**
 * @jest-environment node
 */
// lib/seo/__tests__/blogPosts.test.ts

import { blogTopicsFor, buildBlogPostPage, blogInternalLinks, fallbackBodyHtml } from '@/lib/seo/blogPosts';

describe('blogTopicsFor', () => {
  it('produces local-intent titles + slugs for the trade + city', () => {
    const topics = blogTopicsFor('Plumbing', 'Renton');
    expect(topics.length).toBeGreaterThanOrEqual(4);
    expect(topics[0].title).toContain('Plumbing');
    expect(topics[0].title).toContain('Renton');
    expect(topics.every((t) => /^[a-z0-9-]+$/.test(t.slug))).toBe(true);
    // slugs unique
    expect(new Set(topics.map((t) => t.slug)).size).toBe(topics.length);
  });
});

describe('blogInternalLinks', () => {
  it('always links home + contact; adds the city page only when it exists', () => {
    const withPage = blogInternalLinks('Plumbing', 'Renton', { hasCityPage: true });
    expect(withPage.map((l) => l.href)).toEqual(['/', '/plumbing-in-renton', '#contact']);
    const without = blogInternalLinks('Plumbing', 'Renton', { hasCityPage: false });
    expect(without.map((l) => l.href)).toEqual(['/', '#contact']);
  });
});

describe('buildBlogPostPage', () => {
  const topic = blogTopicsFor('Plumbing', 'Renton')[0];
  const page = buildBlogPostPage({
    title: topic.title,
    slug: topic.slug,
    bodyHtml: fallbackBodyHtml(topic, 'Plumbing', 'Renton'),
    internalLinks: blogInternalLinks('Plumbing', 'Renton', { hasCityPage: true }),
  });

  it('wraps the body with an H1 and a Related internal-links line', () => {
    const text = page.blocks.find((b: any) => b.type === 'text');
    expect(text.content.value).toContain(`<h1>${topic.title}</h1>`);
    expect(text.content.value).toContain('href="/"');
    expect(text.content.value).toContain('href="/plumbing-in-renton"');
    expect(text.content.value).toContain('href="#contact"');
  });

  it('carries slug/title through and mirrors blocks', () => {
    expect(page.slug).toBe(topic.slug);
    expect(page.title).toBe(topic.title);
    expect(page.content_blocks).toBe(page.blocks);
  });
});
