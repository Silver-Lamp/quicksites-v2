/**
 * @jest-environment node
 *
 * Node, not jsdom: buildResumeSite reaches importProfile -> scrapeSite -> cheerio, whose undici
 * dependency needs web streams that the jsdom environment does not provide. Nothing here touches
 * the DOM, so the node environment is both sufficient and the honest description of what runs.
 */
// /verbatim promises: "Verbatim arranges the words you wrote — it doesn't write new ones."
//
// The no-invention half was already tested and already true. This file tests the OTHER half,
// which was silently false: that the words they wrote actually reach the page.
//
// The first real run produced six blocks containing exactly one scrap of the person's writing —
// their name, in the hero. Their summary parsed fine and was filed into `meta.about`, which
// nothing renders. Forty parsed skills went to `tpl.services`, for which the personal scaffold
// has no block. And the "About me" block still held the scaffold's placeholder, addressed to
// the owner, telling them to paste the résumé they had just pasted.
//
// Nothing was fabricated, so every honesty test passed. A page that promises your words and
// shows none of them still breaks the promise.
import { buildResumeSite } from '../buildResumeSite';

const RESUME = `Dana Okafor — Staff Engineer
dana@example.com

Summary
I build tools for people who did not ask for tools. Eleven years across payments and
developer platforms, most of it close to the failure cases.

I care most about the parts of a system people meet on their worst day.

Skills
Backend: TypeScript · Postgres · Go
Payments: Stripe · ledgers · reconciliation

Experience
Northwind Payments — Led the ledger rewrite that cut reconciliation breaks by 90%.
Acme Corp — Ran checkout for four years.
`;

const blocksOf = (t: any) => (t.data?.pages?.[0]?.blocks ?? []) as any[];
const textOf = (t: any) => JSON.stringify(t.data);

describe('a résumé page actually contains the résumé', () => {
  const { template, profile, gaps } = buildResumeSite({ resumeText: RESUME });

  it('parses the pieces it should', () => {
    expect(profile.name).toBe('Dana Okafor');
    expect((profile as any).skills).toEqual(expect.arrayContaining(['TypeScript', 'Postgres', 'Stripe']));
    expect((profile as any).experience?.length).toBeGreaterThan(0);
  });

  it('puts their summary on the page, not in metadata nobody renders', () => {
    const story = blocksOf(template).find((b) => b.type === 'story');
    expect(story).toBeDefined();
    const body = JSON.stringify(story.content.sections);
    expect(body).toContain('build tools for people who did not ask for tools');
  });

  it('keeps their paragraphing instead of running the summary together', () => {
    // Two thoughts in the résumé must stay two paragraphs. Merging them is an editorial change
    // to text we promised only to rearrange.
    //
    // ⚠️ THIS TEST HAS NOW BEEN WRONG TWICE, BOTH TIMES BY ASSERTING A MECHANISM INSTEAD OF THE
    // OUTCOME. v1 asserted `sections.length > 1` and passed while the summary was being
    // flattened, because the ROLES supplied the extra sections. v2 asserted the two paragraphs
    // sat in two distinct sections — which broke the moment the story schema (`heading:
    // min(1)`) forced continuation text to merge upward instead of carrying an empty heading.
    //
    // The thing that actually matters is neither: it is that the two thoughts are SEPARATED
    // when a reader sees them. The renderer carries `whitespace-pre-line`, so a blank line is a
    // paragraph break. Assert that, and the test survives the next structural change too.
    const story = blocksOf(template).find((b) => b.type === 'story');
    const all: string = story.content.sections.map((s: any) => s.body).join('\n\n');

    expect(all).toContain('did not ask for tools');
    expect(all).toContain('worst day');

    // Separated by a blank line, not welded together by a single space.
    expect(all).toMatch(/failure cases\.\s*\n\s*\n\s*I care most/);
    expect(all).not.toMatch(/failure cases\. I care most/);
  });

  // The bug that put this file here: an empty heading fails `heading: z.string().min(1)`, and
  // normalizePageBlocks used to turn the failed block into published raw JSON of the person's
  // life. No section may ever carry one.
  it('never emits a section with an empty heading', () => {
    for (const b of blocksOf(template)) {
      for (const s of b.content?.sections ?? []) {
        expect(typeof s.heading).toBe('string');
        expect(s.heading.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('does not invent a heading for continuation text — it merges it upward', () => {
    // The alternative fix was to manufacture a heading per paragraph. A heading is a claim about
    // what a passage IS; inventing one for someone's own prose is writing for them.
    const story = blocksOf(template).find((b) => b.type === 'story');
    const headings = story.content.sections.map((s: any) => s.heading);
    expect(headings.filter((h: string) => h.startsWith('A bit about'))).toHaveLength(1);
  });

  it('does not treat the contact line as a biography', () => {
    // Résumés put the email under the name, above any heading, so it lands in the summary
    // section. A real run opened someone's About-me with "priya@example.com Product designer…".
    const story = blocksOf(template).find((b) => b.type === 'story');
    const bodies: string[] = story.content.sections.map((s: any) => s.body);
    expect(bodies.some((b) => b.includes('dana@example.com'))).toBe(false);
    // …while still capturing it as contact detail.
    expect((profile as any).email).toBe('dana@example.com');
  });

  it('shows the work history as well as the summary — not one instead of the other', () => {
    // The old applyStoryBlock REPLACED the About-me block, so having a job history deleted the
    // summary. The two things they most wanted were competing for one block.
    const all = textOf(template);
    expect(all).toContain('build tools for people who did not ask for tools'); // summary
    expect(all).toContain('Northwind Payments'); // history
  });

  it('renders the skills it parsed', () => {
    const services = blocksOf(template).find((b) => b.type === 'services');
    expect(services).toBeDefined();
    expect(services.content.title).toBe('Skills');
    const names = services.content.items.map((i: any) => i.name);
    expect(names).toEqual(expect.arrayContaining(['TypeScript', 'Postgres', 'Stripe']));
  });

  // ⚠️ THE ONE THAT MATTERS MOST. Placeholder copy is the single kind of text that is neither
  // theirs nor recognisably ours — it reads to a visitor as something the owner wrote and
  // meant. It must never survive onto a real person's page.
  it('leaks no scaffold placeholder onto a real person’s page', () => {
    const all = textOf(template);
    expect(all).not.toContain('Share who you are');
    expect(all).not.toContain('we’ll draft it for you');
    expect(all).not.toContain('Service A'); // the services block's own default item
  });

  it('reports what the résumé did not contain', () => {
    // Silence stays honest: a title is a claim about a person and is never inferred.
    expect(gaps).toContain('headline');
  });
});

describe('a résumé with nothing to say renders nothing, never a placeholder', () => {
  // Someone pastes a bare skills list: no summary, no history.
  const { template } = buildResumeSite({ resumeText: 'Jo Mensah\n\nSkills\nWelding · Fabrication' });

  it('drops the About-me block rather than publishing instructions', () => {
    const story = blocksOf(template).find((b) => b.type === 'story');
    expect(story).toBeUndefined();
    expect(textOf(template)).not.toContain('Share who you are');
  });

  it('still shows what they did give us', () => {
    const services = blocksOf(template).find((b) => b.type === 'services');
    expect(services.content.items.map((i: any) => i.name)).toEqual(
      expect.arrayContaining(['Welding', 'Fabrication']),
    );
  });
});

describe('the CTA carries a working destination', () => {
  const { template } = buildResumeSite({ resumeText: RESUME });

  it('writes href, the field the schema keeps', () => {
    // Scaffolds wrote `link`; the schema knew only `href` and strips unknown keys; the renderer
    // required `link`. Result: every cta block in the fleet rendered "Missing content for CTA
    // block" — 149 of them across 146 live templates, none with a usable href.
    const cta = blocksOf(template).find((b) => b.type === 'cta');
    if (!cta) return; // scaffold may omit it; the assertion below only applies if present
    expect(cta.content.href).toBeTruthy();
    expect(cta.content.href).not.toBe('/');
  });
});
