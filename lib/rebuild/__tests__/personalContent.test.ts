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
    // Two thoughts in the résumé must stay two sections. Merging them is an editorial change
    // to text we promised only to rearrange.
    //
    // ⚠️ THIS TEST ONCE PASSED WHILE THE BEHAVIOUR WAS BROKEN. It asserted `sections.length > 1`
    // on the whole block — and the ROLES supplied those extra sections, so it stayed green while
    // the two summary paragraphs were being flattened into one run-on body. An end-to-end run
    // showed it. Assert the bio paragraphs specifically, not the section count.
    const story = blocksOf(template).find((b) => b.type === 'story');
    const bodies: string[] = story.content.sections.map((s: any) => s.body);

    const first = bodies.find((b) => b.includes('did not ask for tools'));
    const second = bodies.find((b) => b.includes('worst day'));
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(first).not.toBe(second); // two paragraphs, two sections — not one merged blob
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
