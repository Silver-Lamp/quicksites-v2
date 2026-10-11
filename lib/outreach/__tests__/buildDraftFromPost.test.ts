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
