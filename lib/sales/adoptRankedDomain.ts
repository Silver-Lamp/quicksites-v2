// lib/sales/adoptRankedDomain.ts
//
// Register a domain we ALREADY own and already serve as rentable inventory — a
// `geo_industry_campaigns` row pointing at its existing template.
//
// ⚠️ Why this exists as its own path. `createGeoCampaign()` has always been able to do this: it
// takes a templateId and inserts a row. But the only caller was the launch route, which BUILDS a
// fresh pitch site first — so the eight domains that actually hold page one had no door into the
// campaign table at all, and the proof we own was the one thing no rep could sell. This is the
// missing caller, not new machinery.
//
// ⚠️ The planning half is pure and the writing half is thin, deliberately. Every refusal below is
// a half-row we would otherwise have inserted and then had to find again.

import { supabaseAdmin } from '@/lib/supabase/admin';
import { createGeoCampaign } from '@/lib/outreach/geoCampaigns';
import { resolveIndustryKey } from '@/lib/industries';
import { bareHost } from '@/lib/sales/rateCardData';
import type { IndustryKey } from '@/lib/industries';

/** Everything the decision needs, so the decision itself can be tested without a database. */
export type AdoptionFacts = {
  templateId: string | null;
  slug: string | null;
  /** Whatever is on the template — may carry a `www.` prefix, may be empty. */
  customDomain: string | null;
  published: boolean;
  industry: string | null;
  city: string | null;
  region: string | null;
  /** Set when a campaign already claims this domain or slug. */
  existingCampaignId?: string | null;
};

export type AdoptionRefusal =
  | 'already-a-campaign'
  | 'no-template'
  | 'not-published'
  | 'no-domain'
  | 'missing-city'
  | 'unknown-industry';

export type AdoptionPlan =
  | {
      ok: true;
      row: {
        city: string;
        region: string | null;
        industryKey: IndustryKey;
        /** Bare apex. See the www note below — this is the field most likely to be got wrong. */
        domain: string;
        slug: string;
        templateId: string;
        domainStatus: 'attached';
      };
      notes: string[];
    }
  | { ok: false; reason: AdoptionRefusal; detail: string; existingCampaignId?: string | null };

export function planAdoption(facts: AdoptionFacts): AdoptionPlan {
  if (facts.existingCampaignId) {
    return {
      ok: false,
      reason: 'already-a-campaign',
      detail: 'This domain is already registered as a campaign.',
      existingCampaignId: facts.existingCampaignId,
    };
  }
  if (!facts.templateId || !facts.slug) {
    return { ok: false, reason: 'no-template', detail: 'No template backs this domain, so there is nothing to rent.' };
  }
  if (!facts.published) {
    return {
      ok: false,
      reason: 'not-published',
      detail:
        'The template is not published. A campaign pointing at an unpublished site sends a rep to ' +
        'a page a prospect cannot see — publish it first.',
    };
  }

  // ⚠️ NORMALISE TO THE BARE APEX. Two of the ranked templates carry `www.` in custom_domain, and
  // NOT ONE of the 99 existing campaigns does. `domain` has a unique index and every downstream
  // match — GSC hosts, the rate card, the postcard proof lookup — compares bare hosts, so a
  // `www.` row would be silently unmatchable while looking perfectly correct in the table.
  const notes: string[] = [];
  const raw = (facts.customDomain ?? '').trim();
  if (/^(https?:\/\/)?www\./i.test(raw)) notes.push(`Normalised ${raw} to its bare apex.`);
  const domain = bareHost(raw) || `${facts.slug}.com`;
  if (!raw) notes.push(`Template had no custom_domain; assumed ${domain} from the slug.`);
  if (!domain) return { ok: false, reason: 'no-domain', detail: 'Could not determine a domain.' };

  // `city` is NOT NULL with no default — an insert without it fails at the database, which is a
  // worse place to discover it than here.
  const city = (facts.city ?? '').trim();
  if (!city) {
    return {
      ok: false,
      reason: 'missing-city',
      detail:
        'The site carries no city, and a campaign requires one. Fill the service area on the site ' +
        'first — a rep also cannot pitch a local domain with no town on it.',
    };
  }

  // 'other' satisfies the column and then prices the domain at the LOW tier for the rest of its
  // life. Refusing here is the difference between mispriced inventory and a fixable data gap.
  const industryKey = resolveIndustryKey(facts.industry ?? '') as IndustryKey | null;
  if (!industryKey || industryKey === ('other' as IndustryKey)) {
    return {
      ok: false,
      reason: 'unknown-industry',
      detail:
        `Industry is "${facts.industry ?? 'unset'}", which resolves to no priced trade. It would be ` +
        `registered at the lowest tier permanently. Set a real industry on the template first.`,
    };
  }

  return {
    ok: true,
    row: {
      city,
      region: (facts.region ?? '').trim() || null,
      industryKey,
      domain,
      slug: facts.slug,
      // 'attached' — the domain is live and serving, which is the whole point. The default
      // 'planned' would describe a domain we had not bought yet.
      domainStatus: 'attached',
      templateId: facts.templateId,
    },
    notes,
  };
}

export type TemplateCandidate = {
  id?: string | null;
  slug?: string | null;
  custom_domain?: string | null;
  published?: boolean | null;
  [k: string]: unknown;
};

/**
 * Choose which template serves a host, deterministically.
 *
 * ⚠️ THIS IS THE MOST DANGEROUS FUNCTION IN THE FILE. The query behind it is an `.or()` across two
 * columns, which returns rows in no defined order, and this repo has slug families where several
 * rows legitimately match (CLAUDE.md §8, base_slug). Taking whatever arrived first would eventually
 * register a campaign — and therefore point a rep, a rate card and a printed postcard — at a
 * different business's site. Exactly the shape of the résumé bug that served one person's CV under
 * another person's name.
 *
 * Order: exact custom_domain, then the www form, then an exact slug; published wins ties.
 */
export function pickTemplateForHost(candidates: TemplateCandidate[], apex: string): TemplateCandidate | null {
  const label = apex.replace(/\.[a-z]+$/, '');
  const rank = (t: TemplateCandidate) => {
    const cd = String(t.custom_domain ?? '').toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (cd === apex) return 0;
    if (cd === `www.${apex}`) return 1;
    if (String(t.slug ?? '') === label) return 2;
    return 3;
  };
  const sorted = candidates
    .slice()
    .filter((t) => rank(t) < 3) // never adopt a row that matched nothing we asked for
    .sort((a, b) => rank(a) - rank(b) || Number(Boolean(b.published)) - Number(Boolean(a.published)));
  return sorted[0] ?? null;
}

/** Load the facts for one host from the template that serves it. */
export async function factsForHost(host: string): Promise<AdoptionFacts | null> {
  const apex = bareHost(host);
  const label = apex.replace(/\.[a-z]+$/, '');
  const { data: tpls } = await supabaseAdmin
    .from('templates')
    .select('id, slug, custom_domain, published, industry, data')
    .or(`custom_domain.eq.${apex},custom_domain.eq.www.${apex},slug.eq.${label}`)
    .limit(20);

  const tpl = pickTemplateForHost((tpls ?? []) as TemplateCandidate[], apex);
  if (!tpl) return null;

  // `.maybeSingle()` THROWS when a filter matches more than one row, and this one can: a domain and
  // a slug are separate columns. Take a page and read the first instead of trusting there is one.
  const { data: existingRows } = await supabaseAdmin
    .from('geo_industry_campaigns')
    .select('id')
    .or(`domain.eq.${apex},domain.eq.www.${apex},slug.eq.${tpl.slug}`)
    .limit(1);
  const existing = ((existingRows ?? []) as any[])[0] ?? null;

  // TemplateCandidate is deliberately narrow (it is what the picker needs); the identity blob is
  // read here, where we know the row came from `templates`.
  const contact = ((tpl as any)?.data?.identity?.contact ?? {}) as Record<string, string | null | undefined>;
  return {
    templateId: tpl.id ?? null,
    slug: tpl.slug ?? null,
    customDomain: tpl.custom_domain ?? null,
    published: Boolean(tpl.published),
    industry: ((tpl as any).industry as string | null) ?? null,
    city: contact.city ?? null,
    region: contact.state ?? null,
    existingCampaignId: existing?.id ?? null,
  };
}

export type AdoptionResult =
  | { ok: true; campaignId: string; domain: string; notes: string[] }
  | { ok: false; reason: AdoptionRefusal | 'not-found'; detail: string; existingCampaignId?: string | null };

export async function adoptRankedDomain(host: string, operatorId: string): Promise<AdoptionResult> {
  const facts = await factsForHost(host);
  if (!facts) return { ok: false, reason: 'not-found', detail: `No template serves ${host}.` };

  const plan = planAdoption(facts);
  if (!plan.ok) return { ok: false, reason: plan.reason, detail: plan.detail, existingCampaignId: plan.existingCampaignId };

  const campaign = await createGeoCampaign({ ...plan.row, createdBy: operatorId });
  return { ok: true, campaignId: campaign.id, domain: plan.row.domain, notes: plan.notes };
}
