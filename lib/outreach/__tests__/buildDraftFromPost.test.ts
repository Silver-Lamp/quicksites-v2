/** @jest-environment node */
// The "Build from a post" builder puts ONLY the person's words on the page. These tests pin
// that: no scaffold block that speaks for them survives, the prices they posted are stamped
// dated, nothing is generated, and the DM is held to the claim-postcard forbidden list.
import { assemblePostTemplate, postToRebuildSpec, postBuildDm, STRIPPED_BLOCKS, ALLOWED_BLOCKS, type PostSpec } from '@/lib/outreach/buildDraftFromPost';

const POST: PostSpec = {
  businessName: 'Marsh Family Honey',
  firstName: 'Dana',
  words: 'First pull of the season. Wildflower, raw, 12 oz jars. Pull up Saturday, cash or Venmo.',
  headline: 'Raw wildflower honey from the island.',
  subheadline: 'Saturday 10 to 2 at the end of Cove Road.',
  sectionName: 'Jars',
  items: [
    { name: 'Wildflower honey, 12 oz', price: '$14' },
    { name: 'Comb honey', price: '$18', description: 'Cut straight from the frame.' },
    { name: '', price: '$1' },
  ],
  where: { address: 'End of Cove Road', city: 'Vashon', state: 'WA' },
  hours: [{ day: 'sat', open: '10:00', close: '14:00' }],
  story: [{ heading: 'Why wildflower', body: 'The bees work the whole meadow, so every pull tastes a little different.' }],
  photos: [
    { url: 'https://example.supabase.co/storage/v1/object/public/site-images/post-builds/a.png', alt: 'Jars on the table' },
    { url: 'https://example.supabase.co/storage/v1/object/public/site-images/post-builds/b.png' },
    { url: 'http://insecure.example/c.png' },
  ],
  sourceNote: 'Public post in a Vashon group, 2026-10-10',
  sellerIsAdult: true,
};

function walkStrings(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => walkStrings(x, out));
  else if (v && typeof v === 'object') Object.values(v as Record<string, unknown>).forEach((x) => walkStrings(x, out));
  return out;
}

describe('postToRebuildSpec', () => {
  const spec = postToRebuildSpec(POST);
  it('carries their words and nothing generated', () => {
    expect(spec.about).toBe(POST.words);
    expect(spec.services).toEqual([]);
    expect(spec.faqs).toEqual([]);
    expect(spec.menu?.sections[0].items.map((i) => i.name)).toEqual(['Wildflower honey, 12 oz', 'Comb honey']);
  });
  it('fills the days they did not name as closed, never open', () => {
    const sat = spec.hours!.find((h) => h.day === 'sat');
    expect(sat).toEqual({ day: 'sat', open: '10:00', close: '14:00' });
    expect(spec.hours!.filter((h) => h.closed)).toHaveLength(6);
  });
});

describe('assemblePostTemplate', () => {
  const tpl = assemblePostTemplate(POST);
  const page = tpl.data.pages[0];
  const types: string[] = page.blocks.map((b: any) => b.type);

  it('strips every block that would speak for them', () => {
    for (const t of STRIPPED_BLOCKS) expect(types).not.toContain(t);
    for (const t of types) expect(ALLOWED_BLOCKS.has(t)).toBe(true);
    expect(types).toEqual(expect.arrayContaining(['hero', 'menu', 'gallery']));
  });

  it('stamps the posted prices as dated, in every copy of the menu', () => {
    const menus = [...page.blocks, ...(page.content_blocks ?? [])].filter((b: any) => b.type === 'menu');
    expect(menus.length).toBeGreaterThan(0);
    for (const m of menus) for (const c of [m.content, m.props]) if (c) expect(typeof c.sourced_at).toBe('string');
  });

  it('uses only https photos and drops the insecure one', () => {
    const gallery = page.blocks.find((b: any) => b.type === 'gallery');
    expect(gallery.content.images.map((i: any) => i.url)).toEqual([POST.photos[0].url, POST.photos[1].url]);
    expect(JSON.stringify(tpl.data)).not.toContain('http://insecure');
  });

  it('a post with no hours gets NO hours block — the scaffold default is an invented schedule', () => {
    const t = assemblePostTemplate({ ...POST, hours: [] });
    const types = t.data.pages[0].blocks.map((b: any) => b.type);
    expect(types).not.toContain('hours');
    expect(types).toContain('location');
    const u = assemblePostTemplate({ ...POST, hours: [], where: undefined });
    expect(u.data.pages[0].blocks.map((b: any) => b.type)).not.toContain('location');
    // A city alone is not a place to go: no map block, but the city still reaches the contact.
    const c = assemblePostTemplate({ ...POST, kind: 'goods', where: { city: 'Vashon', state: 'WA' } });
    expect(c.data.pages[0].blocks.map((b: any) => b.type)).not.toContain('location');
    // …and the nav no longer points at the block that is not there.
    const hrefs = [...(c.header_block?.content?.nav_items ?? []), ...(c.footer_block?.content?.links ?? [])].map((l: any) => l.href);
    expect(hrefs).not.toContain('#location');
    expect(hrefs).toContain('#menu');
  });

  it('heroPhoto:false keeps a document-like photo out of the hero and in the gallery', () => {
    const t = assemblePostTemplate({ ...POST, heroPhoto: false });
    const hero = t.data.pages[0].blocks.find((b: any) => b.type === 'hero');
    const heroStrings = walkStrings(hero).join('\n');
    expect(heroStrings).not.toContain(POST.photos[0].url);
    const gallery = t.data.pages[0].blocks.find((b: any) => b.type === 'gallery');
    expect(gallery.content.images.map((i: any) => i.url)).toContain(POST.photos[0].url);
  });

  it('a goods sale carries no food wording and is filed under a non-food industry', () => {
    const g = assemblePostTemplate({ ...POST, kind: 'goods', sectionName: 'What is for sale' });
    expect(g.industry).toBe('pop_up_shop');
    const text = walkStrings(g.data).concat(walkStrings(g.header_block), walkStrings(g.footer_block)).join('\n');
    expect(text).not.toMatch(/View Menu|Our Menu/);
    expect(text).toMatch(/See what's for sale/);
    const menu = g.data.pages[0].blocks.find((b: any) => b.type === 'menu');
    expect(menu.content.title).toBe('For sale');
    expect(menu.content.sections[0].name).toBe('What is for sale');
    expect(g.data.meta.post_kind).toBe('goods');
    const navLabels = [...(g.header_block?.content?.nav_items ?? []), ...(g.footer_block?.content?.links ?? [])].map((l: any) => l.label);
    expect(navLabels).toContain('For sale');
    expect(navLabels).toContain('Where');
    expect(navLabels).not.toContain('Menu');
    expect(navLabels).not.toContain('Location & Hours');
    // The food default is untouched.
    expect(assemblePostTemplate(POST).industry).toBe('restaurant');
  });

  it('a services post (alterations, a price list) says "prices", never "menu" or "for sale", and takes an industry override', () => {
    const s = assemblePostTemplate({ ...POST, kind: 'services', industry: 'custom_apparel', sectionName: 'Alterations' });
    expect(s.industry).toBe('custom_apparel');
    const text = walkStrings(s.data).concat(walkStrings(s.header_block), walkStrings(s.footer_block)).join('\n');
    expect(text).not.toMatch(/View Menu|Our Menu|for sale/i);
    expect(text).toMatch(/See prices/);
    const navLabels = [...(s.header_block?.content?.nav_items ?? []), ...(s.footer_block?.content?.links ?? [])].map((l: any) => l.label);
    expect(navLabels).toContain('Prices');
    expect(s.data.meta.post_kind).toBe('services');
    expect(assemblePostTemplate({ ...POST, kind: 'services' }).industry).toBe('other');
  });

  it('keeps the provenance on meta', () => {
    expect(tpl.data.meta.built_from_post).toBe(true);
    expect(tpl.data.meta.source_note).toBe(POST.sourceNote);
  });

  it('writes no promise the person did not make', () => {
    const text = walkStrings(tpl.data).join('\n');
    for (const re of [/licens|insured/i, /guarantee/i, /24\s*\/\s*7/i, /free (quote|estimate)/i, /respond within/i]) expect(text).not.toMatch(re);
  });
});

describe('postBuildDm', () => {
  const dm = postBuildDm({ firstName: 'Dana', senderName: 'Sandon', previewUrl: 'https://www.quicksites.ai/sites/marsh-family-honey', claimUrl: 'https://www.quicksites.ai/claim-site/x?token=y' });
  it('holds to the claim-postcard forbidden list', () => {
    for (const re of [/\brank(s|ing|ed)?\b/i, /page one|page 1|#1\b/i, /\bgoogle\b/i, /24\s*\/\s*7/i, /licens|insured/i, /guarantee/i, /competitor|before someone else/i, /deadline|expires/i, /\$\s?\d/]) expect(dm).not.toMatch(re);
  });
  it('says the link is theirs alone and names the exit', () => {
    expect(dm).toMatch(/don't post it/);
    expect(dm).toMatch(/take it down/);
    expect(dm).toContain('https://www.quicksites.ai/claim-site/x?token=y');
  });
});
