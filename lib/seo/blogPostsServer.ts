// lib/seo/blogPostsServer.ts
//
// Server side of blog-post generation. Writes a few local-intent blog pages whose prose is
// UNIQUE per site (metered LLM) — so it's real content, not a duplicate-content footprint —
// and whose internal links point back to the site's own pages. Gated behind the same
// GEO_RECS_LLM switch as the other geo LLM features, so we never mass-produce templated
// duplicate posts. Commits through the sanctioned template RPC. Idempotent by slug.

import { getOpenAI, resolveModel } from '@/lib/ai/openaiClient';
import { meterLLMCall } from '@/lib/ai/meter';
import { geoRecsLlmEnabled } from '@/lib/outreach/recSummary';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { KEY_TO_LABEL, type IndustryKey } from '@/lib/industries';
import { insertPage, hasPageSlug, slugForCityService } from '@/lib/seo/localPages';
import { blogTopicsFor, buildBlogPostPage, blogInternalLinks, fallbackBodyHtml, type BlogTopic } from '@/lib/seo/blogPosts';

const MODEL = 'gpt-4o-mini';
const ROUTE = '/api/admin/prospects/geo-campaign/generate-blog';
const DEFAULT_COUNT = 3;

/** Strip links + disallowed tags from model HTML (we inject our own internal links). */
function sanitizeBodyHtml(html: string): string {
  return String(html || '')
    .replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, '$1') // drop anchor tags, keep text
    .replace(/<\/?(script|style|iframe|h1)\b[^>]*>/gi, '') // never a script or a second H1
    .trim();
}

function parseBody(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw);
    const body = String(j?.body_html ?? j?.html ?? j?.body ?? '').trim();
    return body ? sanitizeBodyHtml(body) : null;
  } catch {
    return null;
  }
}

/** One metered LLM call → a unique article body (HTML). Null on flag-off or failure. */
async function llmBody(topic: BlogTopic, serviceLabel: string, city: string, userId: string | null): Promise<string | null> {
  const sys =
    'You are a helpful local-business copywriter. Write the BODY of a short blog post (~250–350 words) for a ' +
    `${serviceLabel} business serving ${city}. Grounded + specific to ${city} where natural; friendly and useful, not salesy. ` +
    'STRICT: output HTML using only <p>, <ul>, <li>, <strong>, <em>, <h2>, <h3> — NO links, NO <h1>, NO images. ' +
    'Do NOT invent exact prices, statistics, phone numbers, or addresses. Output strict JSON {"body_html":"…"}.';
  const user = JSON.stringify({ title: topic.title, brief: topic.brief, city, service: serviceLabel });
  try {
    const openai = getOpenAI('chat');
    return await meterLLMCall<string | null>(
      { provider: 'openai', model_code: MODEL, modality: 'chat', user_id: userId, route: ROUTE },
      async () => {
        const r = await openai.chat.completions.create({
          model: resolveModel(MODEL, 'chat'),
          temperature: 0.7,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: sys },
            { role: 'user', content: user },
          ],
        });
        return {
          value: parseBody(r.choices[0]?.message?.content ?? null),
          usage: { input_tokens: r.usage?.prompt_tokens, output_tokens: r.usage?.completion_tokens },
        };
      },
    );
  } catch {
    return null;
  }
}

export type GenerateBlogResult = { ok: boolean; changed: boolean; added: string[]; reason?: string };

/** Generate up to `count` blog posts for one campaign's pitch site (idempotent by slug). */
export async function generateBlogPosts(
  campaign: { template_id: string | null; city: string | null; industry_key: string },
  actorId: string | null = null,
  opts: { count?: number } = {},
): Promise<GenerateBlogResult> {
  if (!geoRecsLlmEnabled()) return { ok: false, changed: false, added: [], reason: 'llm_disabled' };
  if (!campaign.template_id) return { ok: false, changed: false, added: [], reason: 'no_template' };
  if (!campaign.city) return { ok: false, changed: false, added: [], reason: 'no_city' };

  const { data: t } = await supabaseAdmin.from('templates').select('id, data, rev, business_name').eq('id', campaign.template_id).maybeSingle();
  if (!t) return { ok: false, changed: false, added: [], reason: 'no_template' };

  const label = KEY_TO_LABEL[campaign.industry_key as IndustryKey] ?? 'Services';
  const city = campaign.city;
  const count = Math.max(1, Math.min(5, opts.count ?? DEFAULT_COUNT));
  const topics = blogTopicsFor(label, city).slice(0, count);

  let cur = (t as any).data ?? {};
  const hasCityPage = hasPageSlug(cur, slugForCityService(label, city));
  const added: string[] = [];

  for (const topic of topics) {
    if (hasPageSlug(cur, topic.slug)) continue; // already have this post
    const body = (await llmBody(topic, label, city, actorId)) ?? fallbackBodyHtml(topic, label, city);
    const page = buildBlogPostPage({
      title: topic.title,
      slug: topic.slug,
      bodyHtml: body,
      internalLinks: blogInternalLinks(label, city, { hasCityPage }),
    });
    const ins = insertPage(cur, page);
    if (ins.changed) {
      cur = ins.data;
      added.push(topic.slug);
    }
  }

  if (!added.length) return { ok: true, changed: false, added: [], reason: 'nothing_to_add' };

  const payload = { id: campaign.template_id, base_rev: (t as any).rev ?? 0, patch: { data: cur }, actor: actorId, kind: 'save', org_id: null };
  let err: any = null;
  {
    const { error } = await (supabaseAdmin as any).schema('public').rpc('commit_template_http', { p_payload: payload });
    err = error;
  }
  if (err) {
    const { error } = await (supabaseAdmin as any).schema('app').rpc('commit_template', { p_payload: payload });
    err = error;
  }
  if (err) return { ok: false, changed: false, added: [], reason: err.message || 'commit failed' };

  return { ok: true, changed: true, added };
}

export type BlogBackfillResult = { processed: number; sitesChanged: number; postsAdded: number; failed: number };

/** Backfill blog posts across many campaigns (bounded). Sequential so the AI budget paces. */
export async function backfillBlogPosts(
  campaigns: { template_id: string | null; city: string | null; industry_key: string; domain: string }[],
  actorId: string | null = null,
  opts: { perSite?: number; limit?: number } = {},
): Promise<BlogBackfillResult> {
  const perSite = Math.max(1, Math.min(5, opts.perSite ?? 2));
  const limit = Math.max(1, Math.min(100, opts.limit ?? 15)); // cap how many SITES we touch per run
  const out: BlogBackfillResult = { processed: 0, sitesChanged: 0, postsAdded: 0, failed: 0 };

  for (const c of campaigns) {
    if (out.sitesChanged >= limit) break;
    if (!c.template_id || !c.city) continue;
    out.processed += 1;
    try {
      const r = await generateBlogPosts(c, actorId, { count: perSite });
      if (r.changed) {
        out.sitesChanged += 1;
        out.postsAdded += r.added.length;
      }
    } catch {
      out.failed += 1;
    }
  }
  return out;
}
