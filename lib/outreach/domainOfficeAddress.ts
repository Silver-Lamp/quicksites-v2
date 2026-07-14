// lib/outreach/domainOfficeAddress.ts
//
// Per-domain "default office address" suggester. A geo campaign encodes a city + trade
// (e.g. renton-plumbing.com → Renton, plumbing). This asks a metered LLM for ONE
// plausible light-industrial / flex-office commercial-park address in that city where
// such a business could rent a modest suite, with a unit like "Suite 2C", and seeds it
// as the pitch site's default NAP — but only until a real address exists ("auto until
// edited"), and stamped as AI-suggested so it's clearly a placeholder to verify.
//
// Metered via lib/ai/meter (never raw OpenAI); flag-gated by the same GEO_RECS_LLM
// switch as the other geo LLM features; commits through the sanctioned template RPC.

import { getOpenAI, resolveModel } from '@/lib/ai/openaiClient';
import { meterLLMCall } from '@/lib/ai/meter';
import { geoRecsLlmEnabled } from '@/lib/outreach/recSummary';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { seedServiceAreaContact, hasOwnAddress } from '@/lib/outreach/seedServiceAreaContact';
import type { GeoCampaign } from '@/lib/outreach/geoCampaigns';

const MODEL = 'gpt-4o-mini';
const ROUTE = '/api/admin/prospects/geo-campaign/suggest-address';

export type OfficeAddress = {
  line1: string;
  suite: string;
  city: string;
  region: string;
  postalCode: string;
  /** Full one-line NAP string used as the site address. */
  label: string;
  /** Always 'ai_suggested' — provenance so the UI/editor flags it as a placeholder. */
  source: 'ai_suggested';
};

/** Deterministic fallback suite (e.g. "2C") derived from the domain, so it's stable per site. */
export function suiteFromDomain(domain: string): string {
  let h = 0;
  for (const ch of domain) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const num = (h % 30) + 1; // 1–30
  const letter = 'ABCD'[h % 4];
  return `${num}${letter}`;
}

/** Build the one-line NAP label from parts (avoids a duplicated suite when line1 has one). */
export function formatAddressLabel(a: { line1: string; suite?: string; city: string; region: string; postalCode?: string }): string {
  const line1 = a.line1.trim();
  const suite = (a.suite ?? '').trim();
  const hasSuiteInLine = /\b(suite|ste|unit|#)\b/i.test(line1);
  const street = suite && !hasSuiteInLine ? `${line1}, Suite ${suite.replace(/^suite\s*/i, '')}` : line1;
  const tail = [a.city.trim(), [a.region.trim(), (a.postalCode ?? '').trim()].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return [street, tail].filter(Boolean).join(', ');
}

/** Validate the model's JSON into a clean OfficeAddress, or null. Pure. */
export function parseOfficeAddress(
  raw: string | null | undefined,
  fallback: { city: string; region: string; domain: string },
): OfficeAddress | null {
  if (!raw) return null;
  let j: any;
  try {
    j = JSON.parse(raw);
  } catch {
    return null;
  }
  const line1 = String(j?.line1 ?? j?.street ?? '').trim();
  if (!line1) return null;
  const city = String(j?.city ?? fallback.city ?? '').trim() || fallback.city;
  const region = String(j?.region ?? j?.state ?? fallback.region ?? '').trim() || fallback.region;
  const postalCode = String(j?.postal_code ?? j?.postalCode ?? j?.zip ?? '').trim();
  let suite = String(j?.suite ?? j?.unit ?? '').trim().replace(/^(suite|ste|unit|#)\s*/i, '');
  if (!suite) suite = suiteFromDomain(fallback.domain);
  const label = formatAddressLabel({ line1, suite, city, region, postalCode });
  return { line1, suite, city, region, postalCode, label, source: 'ai_suggested' };
}

/**
 * Ask the LLM for a plausible commercial-park office address in the campaign's city/trade.
 * Returns null when the flag is off, inputs are missing, or on any failure (best-effort).
 */
export async function suggestOfficeAddress(
  input: { domain: string; city: string | null; region: string | null; industryKey: string | null },
  userId: string | null = null,
): Promise<OfficeAddress | null> {
  if (!geoRecsLlmEnabled()) return null;
  const city = (input.city ?? '').trim();
  if (!city) return null;
  const region = (input.region ?? '').trim();
  const trade = (input.industryKey ?? '').replace(/_/g, ' ').trim() || 'local service';

  const sys =
    'You are a commercial real-estate assistant. Given a US city/state and a trade, return ONE plausible ' +
    'street address for a small LIGHT-INDUSTRIAL or FLEX-OFFICE commercial park unit in or near that city where ' +
    'such a business could realistically rent a modest office/warehouse suite. Requirements: a commercial/industrial ' +
    'zone (never a residential street), a realistic street name and number for that city, and a unit/suite designator ' +
    'like "2C". Do NOT reproduce a specific known business\'s real address — produce a generic, plausible placeholder. ' +
    'Output STRICT JSON: {"line1":"…","suite":"…","city":"…","region":"…","postal_code":"…"}.';
  const user = JSON.stringify({ city, region, trade, note: 'placeholder office address to be verified' });

  try {
    const openai = getOpenAI('chat');
    return await meterLLMCall<OfficeAddress | null>(
      { provider: 'openai', model_code: MODEL, modality: 'chat', user_id: userId, route: ROUTE },
      async () => {
        const r = await openai.chat.completions.create({
          model: resolveModel(MODEL, 'chat'),
          temperature: 0.6,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: sys },
            { role: 'user', content: user },
          ],
        });
        return {
          value: parseOfficeAddress(r.choices[0]?.message?.content ?? null, { city, region, domain: input.domain }),
          usage: { input_tokens: r.usage?.prompt_tokens, output_tokens: r.usage?.completion_tokens },
        };
      },
    );
  } catch {
    return null;
  }
}

export type SuggestAddressResult = {
  ok: boolean;
  suggestion?: OfficeAddress;
  /** True when the address was seeded onto the pitch site. */
  applied?: boolean;
  changed?: boolean;
  reason?: string;
};

/**
 * Suggest a default office address for a campaign's pitch site and seed it as the NAP.
 * Commits through the sanctioned template RPC. Options:
 *   • apply=false → return the suggestion without writing it (preview).
 *   • force=true  → overwrite the existing address (the editor "re-find" tool); otherwise
 *     seeds only when the site has no address of its own ("auto until edited").
 * Preflights the template so a backfill never spends an LLM call on a site that already
 * has an address (unless force).
 */
export async function suggestAndApplyOfficeAddress(
  campaign: Pick<GeoCampaign, 'id' | 'template_id' | 'domain' | 'city' | 'region' | 'industry_key'>,
  actorId: string | null = null,
  opts: { apply?: boolean; force?: boolean } = {},
): Promise<SuggestAddressResult> {
  const apply = opts.apply ?? true;
  const force = opts.force ?? false;
  if (!geoRecsLlmEnabled()) return { ok: false, reason: 'llm_disabled' };
  if (!campaign.template_id) return { ok: false, reason: 'no_template' };

  // Preflight: load the template up front so we can skip the LLM entirely when the site
  // already has an address and we're not forcing (keeps backfill cheap).
  const { data: t } = await supabaseAdmin.from('templates').select('id, data, rev').eq('id', campaign.template_id).maybeSingle();
  if (!t) return { ok: false, reason: 'no_template' };
  if (apply && !force && hasOwnAddress((t as any).data ?? {})) {
    return { ok: true, applied: false, changed: false, reason: 'already_has_address' };
  }

  const suggestion = await suggestOfficeAddress(
    { domain: campaign.domain, city: campaign.city, region: campaign.region, industryKey: campaign.industry_key },
    actorId,
  );
  if (!suggestion) return { ok: false, reason: 'no_suggestion' };
  if (!apply) return { ok: true, suggestion, applied: false, changed: false };

  // Seed the address (service-area seeder handles block placement; show_map stays off so we
  // never drop a real map pin on a placeholder). force=true overwrites an existing address.
  const seeded = seedServiceAreaContact((t as any).data ?? {}, { label: suggestion.label }, { force });
  if (!seeded.changed) return { ok: true, suggestion, applied: false, changed: false, reason: 'already_has_address' };
  const newData = seeded.data;
  newData.meta = newData.meta ?? {};
  newData.meta.contact = { ...(newData.meta.contact ?? {}), address_source: 'ai_suggested' };

  const payload = {
    id: campaign.template_id,
    base_rev: (t as any).rev ?? 0,
    patch: { data: newData },
    actor: actorId,
    kind: 'save',
    org_id: null,
  };
  let err: any = null;
  {
    const { error } = await (supabaseAdmin as any).schema('public').rpc('commit_template_http', { p_payload: payload });
    err = error;
  }
  if (err) {
    const { error } = await (supabaseAdmin as any).schema('app').rpc('commit_template', { p_payload: payload });
    err = error;
  }
  if (err) return { ok: false, suggestion, reason: err.message || 'commit failed' };

  return { ok: true, suggestion, applied: true, changed: true };
}

export type BackfillResult = {
  processed: number;
  applied: number;
  skipped: number;
  failed: number;
  results: { domain: string; applied: boolean; label?: string; reason?: string }[];
};

/**
 * Backfill default office addresses across many campaigns — only the ones whose pitch site
 * has no address of its own get an LLM call (preflight skips the rest). Sequential so the
 * per-user AI budget guard paces spend; `limit` caps how many addressless sites we fill in
 * one run.
 */
export async function backfillOfficeAddresses(
  campaigns: Pick<GeoCampaign, 'id' | 'template_id' | 'domain' | 'city' | 'region' | 'industry_key'>[],
  actorId: string | null = null,
  opts: { limit?: number } = {},
): Promise<BackfillResult> {
  const limit = Math.max(1, Math.min(100, opts.limit ?? 25));
  const out: BackfillResult = { processed: 0, applied: 0, skipped: 0, failed: 0, results: [] };

  for (const c of campaigns) {
    if (out.applied >= limit) break;
    if (!c.template_id) continue;
    out.processed += 1;
    try {
      const r = await suggestAndApplyOfficeAddress(c, actorId, { apply: true, force: false });
      if (r.applied) {
        out.applied += 1;
        out.results.push({ domain: c.domain, applied: true, label: r.suggestion?.label });
      } else {
        out.skipped += 1;
        out.results.push({ domain: c.domain, applied: false, reason: r.reason });
      }
    } catch (e: any) {
      out.failed += 1;
      out.results.push({ domain: c.domain, applied: false, reason: e?.message || 'error' });
    }
  }
  return out;
}
