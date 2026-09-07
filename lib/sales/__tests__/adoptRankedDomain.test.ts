import { planAdoption, type AdoptionFacts } from '../adoptRankedDomain';
import { priceTier } from '@/lib/outreach/geoPricing';

const facts = (over: Partial<AdoptionFacts> = {}): AdoptionFacts => ({
  templateId: 't-1', slug: 'arab-towing', customDomain: 'arab-towing.com',
  published: true, industry: 'towing', city: 'Arab', region: 'AL',
  existingCampaignId: null, ...over,
});

describe('adopting a live ranked domain', () => {
  it('plans a row pointing at the EXISTING template', () => {
    const p = planAdoption(facts());
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.row).toMatchObject({
      city: 'Arab', region: 'AL', industryKey: 'towing',
      domain: 'arab-towing.com', slug: 'arab-towing', templateId: 't-1',
    });
  });

  it('marks the domain attached, not planned', () => {
    // 'planned' is the column default and describes a domain we have not bought. These are live.
    const p = planAdoption(facts());
    expect(p.ok && p.row.domainStatus).toBe('attached');
  });
});

describe('the www prefix, which is the field most likely to be got wrong', () => {
  it('normalises to the bare apex and says so', () => {
    // Not one of the 99 existing campaigns stores a www. prefix, `domain` is uniquely indexed, and
    // every downstream match compares bare hosts — so a www. row is unmatchable while looking fine.
    const p = planAdoption(facts({ customDomain: 'www.graftontowing.com', slug: 'graftontowing' }));
    expect(p.ok && p.row.domain).toBe('graftontowing.com');
    expect(p.ok && p.notes.join(' ')).toMatch(/normalised/i);
  });

  it('strips a scheme too', () => {
    const p = planAdoption(facts({ customDomain: 'https://www.southhilltowing.com/' }));
    expect(p.ok && p.row.domain).toBe('southhilltowing.com');
  });

  it('falls back to the slug when there is no custom domain, and flags the assumption', () => {
    const p = planAdoption(facts({ customDomain: null }));
    expect(p.ok && p.row.domain).toBe('arab-towing.com');
    expect(p.ok && p.notes.join(' ')).toMatch(/assumed/i);
  });
});

describe('every refusal is a half-row we did not insert', () => {
  it('refuses a domain that is already a campaign, and hands back its id', () => {
    const p = planAdoption(facts({ existingCampaignId: 'c-9' }));
    expect(p).toMatchObject({ ok: false, reason: 'already-a-campaign', existingCampaignId: 'c-9' });
  });

  it('refuses an unpublished template', () => {
    // A campaign pointing at an unpublished site sends a rep to a page the prospect cannot see.
    expect(planAdoption(facts({ published: false })).ok).toBe(false);
    expect(planAdoption(facts({ published: false }))).toMatchObject({ reason: 'not-published' });
  });

  it('refuses when the site carries no city — the column is NOT NULL', () => {
    // Discovering this at the database is worse than discovering it here.
    expect(planAdoption(facts({ city: null }))).toMatchObject({ ok: false, reason: 'missing-city' });
    expect(planAdoption(facts({ city: '   ' }))).toMatchObject({ ok: false, reason: 'missing-city' });
  });

  it('refuses an industry that resolves to no priced trade — the pnw-exteriorcleaning case', () => {
    // 'other' satisfies the column and then prices the domain at the lowest tier permanently.
    expect(planAdoption(facts({ industry: 'other' }))).toMatchObject({ ok: false, reason: 'unknown-industry' });
    expect(planAdoption(facts({ industry: null }))).toMatchObject({ ok: false, reason: 'unknown-industry' });
  });

  it('the industry refusal is load-bearing: "other" really would underprice it', () => {
    // Proves the refusal protects something real rather than being defensive noise.
    expect(priceTier('other' as any).fullCents).toBeLessThan(priceTier('towing' as any).fullCents);
  });

  it('accepts a region-less site rather than refusing — a state is nice, not required', () => {
    const p = planAdoption(facts({ region: null }));
    expect(p.ok).toBe(true);
    expect(p.ok && p.row.region).toBeNull();
  });
});

// ── Which template serves this host ───────────────────────────────────────────────────────────
import { pickTemplateForHost } from '../adoptRankedDomain';

describe('picking the template that serves a host', () => {
  const t = (over: Record<string, unknown>) => ({ id: 'x', slug: null, custom_domain: null, published: true, ...over });

  it('prefers an exact custom_domain over a slug that merely looks right', () => {
    // The query is an .or() across two columns and returns rows in no defined order, so "the first
    // one" is not an answer. Getting this wrong points a campaign at another business's site.
    const chosen = pickTemplateForHost(
      [t({ id: 'by-slug', slug: 'arab-towing' }), t({ id: 'by-domain', custom_domain: 'arab-towing.com' })],
      'arab-towing.com',
    );
    expect(chosen?.id).toBe('by-domain');
  });

  it('accepts the www form, and still prefers the bare one', () => {
    const chosen = pickTemplateForHost(
      [t({ id: 'www', custom_domain: 'www.graftontowing.com' }), t({ id: 'bare', custom_domain: 'graftontowing.com' })],
      'graftontowing.com',
    );
    expect(chosen?.id).toBe('bare');
    expect(pickTemplateForHost([t({ id: 'www', custom_domain: 'www.graftontowing.com' })], 'graftontowing.com')?.id).toBe('www');
  });

  it('prefers a published row when the match is otherwise equal', () => {
    const chosen = pickTemplateForHost(
      [t({ id: 'draft', slug: 'covingtontow', published: false }), t({ id: 'live', slug: 'covingtontow', published: true })],
      'covingtontow.com',
    );
    expect(chosen?.id).toBe('live');
  });

  it('returns null rather than adopting a row that matched nothing we asked for', () => {
    // A stray row from a loose filter must not become a campaign by default.
    expect(pickTemplateForHost([t({ id: 'unrelated', slug: 'something-else' })], 'arab-towing.com')).toBeNull();
    expect(pickTemplateForHost([], 'arab-towing.com')).toBeNull();
  });

  it('tolerates a scheme or trailing slash on custom_domain', () => {
    expect(pickTemplateForHost([t({ id: 'a', custom_domain: 'https://arab-towing.com/' })], 'arab-towing.com')?.id).toBe('a');
  });
});
