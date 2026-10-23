/**
 * @jest-environment node
 */
import { renamedSlug, syncNavInData, syncNavItems } from '@/lib/editor/navSync';
import { generateSlug } from '@/lib/utils/generateSlug';

const base = [
  { label: 'Home', href: '/' },
  { label: 'Services', href: '/services' },
  { label: 'Find us', href: 'https://maps.example.com' },
];

describe('header links follow the pages tray', () => {
  it('a new page gets a link; an existing link is not duplicated; home never', () => {
    expect(syncNavItems(base, { kind: 'add', slug: 'about', title: 'About' })[3]).toEqual({ label: 'About', href: '/about', appearance: 'default' });
    expect(syncNavItems(base, { kind: 'add', slug: 'services', title: 'Services' })).toBe(base);
    expect(syncNavItems(base, { kind: 'add', slug: 'index', title: 'Home' })).toBe(base);
  });
  it('a rename moves the link, and relabels it only if the owner had not changed the label', () => {
    const items = [...base, { label: 'New Page', href: '/new-page' }, { label: 'Our team', href: '/team' }];
    const a = syncNavItems(items, { kind: 'rename', oldSlug: 'new-page', oldTitle: 'New Page', slug: 'about', title: 'About' });
    expect(a).toContainEqual({ label: 'About', href: '/about' });
    const b = syncNavItems(items, { kind: 'rename', oldSlug: 'team', oldTitle: 'Team', slug: 'people', title: 'People' });
    expect(b).toContainEqual({ label: 'Our team', href: '/people' });
  });
  it('a delete removes only the link to that page', () => {
    expect(syncNavItems(base, { kind: 'delete', slug: 'services' })).toEqual([base[0], base[2]]);
    expect(syncNavItems(base, { kind: 'delete', slug: 'nothing' })).toBe(base);
  });
  it('writes the header content and its props mirror, and respects the opt-out', () => {
    const data = { headerBlock: { content: { nav_items: base }, props: { nav_items: base } }, pages: [] };
    const out: any = syncNavInData(data, { kind: 'add', slug: 'about', title: 'About' });
    expect(out.headerBlock.content.nav_items).toHaveLength(4);
    expect(out.headerBlock.props.nav_items).toHaveLength(4);
    const off = { ...data, meta: { nav_auto: false } };
    expect(syncNavInData(off, { kind: 'add', slug: 'about', title: 'About' })).toBe(off);
  });
});

describe('a rename re-derives a slug nobody chose', () => {
  const r = (o: Partial<Parameters<typeof renamedSlug>[0]>) =>
    renamedSlug({ oldSlug: 'new-page', oldTitle: 'New Page', slugDraft: 'new-page', title: 'About', slugify: generateSlug, ...o });
  it('the tray default follows the title', () => expect(r({})).toBe('about'));
  it('a slug derived from the old title follows the title', () => expect(r({ oldSlug: 'team', oldTitle: 'Team', slugDraft: 'team', title: 'Our People' })).toBe('our-people'));
  it('a slug the owner typed is kept', () => expect(r({ oldSlug: 'services', oldTitle: 'Services', slugDraft: 'what-we-do' })).toBe('what-we-do'));
  it('a hand-set slug survives a title change', () => expect(r({ oldSlug: 'what-we-do', oldTitle: 'Services', slugDraft: 'what-we-do', title: 'Our services' })).toBe('what-we-do'));
  it('home stays index', () => expect(r({ oldSlug: 'index', oldTitle: 'Home', slugDraft: 'index', title: 'Welcome' })).toBe('index'));
});
