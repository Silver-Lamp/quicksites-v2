import { readinessChecklist, isDirectoryPortal, portalReadinessChecklist } from '../readiness';

const portal = (over: any = {}) => ({
  meta: { title: 'Renton Restaurants — Order Direct', ...(over.meta ?? {}) },
  pages: [
    {
      content_blocks: [
        {
          type: 'hero',
          content: {
            headline: 'Order from local restaurants in Renton, WA',
            subheadline: '4 real Renton kitchens — find them here and call them direct.',
            ...(over.hero ?? {}),
          },
        },
        {
          type: 'restaurants_directory',
          content: { entries: over.entries ?? [{ slug: 'a' }, { slug: 'b' }] },
        },
        { type: 'faq', content: { items: over.faq ?? [{ question: 'q', answer: 'a' }] } },
      ],
    },
  ],
});

describe('directory portal readiness', () => {
  it('detects a portal by its block, not its campaign', () => {
    expect(isDirectoryPortal(portal())).toBe(true);
    expect(isDirectoryPortal({ pages: [{ content_blocks: [{ type: 'hero' }, { type: 'menu' }] }] })).toBe(false);
  });

  // The whole reason this exists: the business checklist demands a menu, an address and a
  // tap-to-call phone. On a page listing a dozen restaurants that advice is wrong, and
  // following it recreates the single-restaurant bug the portal fix removed.
  it('routes a portal AWAY from the business checklist', () => {
    const ids = readinessChecklist(portal(), 'restaurant').map((i) => i.id);
    expect(ids).toContain('portal-entries');
    expect(ids).not.toContain('menu');
    expect(ids).not.toContain('nap');
    expect(ids).not.toContain('call');
  });

  it('a healthy portal passes every hard item', () => {
    const items = portalReadinessChecklist(portal());
    expect(items.filter((i) => i.severity === 'hard' && !i.ok)).toEqual([]);
  });

  it('flags an empty directory', () => {
    const items = portalReadinessChecklist(portal({ entries: [] }));
    expect(items.find((i) => i.id === 'portal-entries')?.ok).toBe(false);
  });

  // Guards the mistake that shipped twice: a subhead promising ordering the linked pages
  // cannot do. Unclaimed drafts take no orders, so the claim is simply untrue.
  it('flags a subhead that promises online ordering', () => {
    const bad = portalReadinessChecklist(
      portal({ hero: { subheadline: 'Real local kitchens, direct online ordering — no middleman markup.' } }),
    );
    expect(bad.find((i) => i.id === 'portal-promise')?.ok).toBe(false);

    const good = portalReadinessChecklist(portal());
    expect(good.find((i) => i.id === 'portal-promise')?.ok).toBe(true);
  });

  it('flags a placeholder hero', () => {
    const items = portalReadinessChecklist(portal({ hero: { headline: 'Headline here' } }));
    expect(items.find((i) => i.id === 'portal-hero')?.ok).toBe(false);
  });
});
