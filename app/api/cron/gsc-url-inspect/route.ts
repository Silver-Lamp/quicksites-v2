// app/api/cron/gsc-url-inspect/route.ts
//
// Nightly: ask Search Console's URL Inspection API about every page of every published site on a
// connected property, store the answer with our triage, open an admin task for anything we can
// fix or that needs a person, and email ONE digest when there is something new.
//
// ⚠️ This replaces reading Search Console's "new reason preventing your pages from being indexed"
// emails, which name a property and a reason and nothing else. The API names the URL, the canonical
// Google chose, and the current state — and this table is where "did the fix take" gets answered.
//
// Read-only at Google (no flag, like gsc-query-harvest). Quota is 2,000 inspections per property
// per day and 600 per minute; the fleet's sites are one to seven pages each, and URLs inspected
// in the last FRESH_DAYS are skipped, so a nightly run is a few hundred calls at most. `?force=1`
// (admin session) ignores freshness; `?property=` limits to one.
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runCron } from '@/lib/cron/record';
import { isCronAuthorized } from '@/lib/cron/auth';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { sendEmail } from '@/lib/email';
import { alertRecipients } from '@/lib/ppl/callAlert';
import { inspectUrl, targetsFor } from '@/lib/gsc/urlInspection';
import { parseInspection, triageInspection, BUCKET_LABEL, type TriageBucket } from '@/lib/gsc/indexingTriage';
import { publicBaseUrl } from '@/lib/outreach/competitionPoster';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const MAX_PER_RUN = Number(process.env.GSC_INSPECT_MAX ?? '300') || 300;
const FRESH_DAYS = Number(process.env.GSC_INSPECT_FRESH_DAYS ?? '7') || 7;
/**
 * ⚠️ Stop on TIME, not only on count. Each inspection is a few seconds and the route's
 * maxDuration is 300 s; the first production run (2026-10-07) was gateway-504'd mid-loop after
 * 35 URLs with the count cap nowhere in sight. Whatever is not reached rolls to the next run —
 * the freshness filter makes every run pick up where the last stopped.
 */
const TIME_BUDGET_MS = 230_000;
const TASK_BUCKETS = new Set<TriageBucket>(['auto_fixable', 'needs_person']);

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
    { auth: { persistSession: false } },
  );
}

async function handle(req: NextRequest) {
  const isAdmin = !!(await getAdminUser());
  if (!isCronAuthorized(req) && !isAdmin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const url = new URL(req.url);
  const force = isAdmin && url.searchParams.get('force') === '1';
  const onlyProperty = url.searchParams.get('property');

  return runCron('gsc-url-inspect', async () => {
    const db = admin();
    const { data: tokenRows } = await db.from('gsc_tokens').select('domain');
    const properties = Array.from(new Set((tokenRows ?? []).map((r: { domain?: string }) => r.domain).filter(Boolean))) as string[];

    const { data: campaigns } = await db
      .from('geo_industry_campaigns')
      .select('template_id, domain')
      .not('template_id', 'is', null)
      .not('domain', 'is', null);
    const campaignDomainByTemplate = new Map<string, string>((campaigns ?? []).map((c: any) => [c.template_id, c.domain]));

    const ids = [...campaignDomainByTemplate.keys()];
    const templates: any[] = [];
    for (let i = 0; i < ids.length; i += 50) {
      const { data } = await db
        .from('templates')
        .select('id, slug, data, custom_domain, published, archived')
        .in('id', ids.slice(i, i + 50));
      templates.push(...(data ?? []));
    }
    const { data: own } = await db
      .from('templates')
      .select('id, slug, data, custom_domain, published, archived')
      .neq('custom_domain', '')
      .eq('published', true);
    for (const t of own ?? []) if (!campaignDomainByTemplate.has(t.id)) templates.push(t);

    const live = templates.filter((t) => t.published && !t.archived);
    let targets = targetsFor(properties, live, campaignDomainByTemplate);
    if (onlyProperty) targets = targets.filter((t) => t.property === onlyProperty);

    // Skip URLs inspected recently, unless forced.
    const freshCutoff = new Date(Date.now() - FRESH_DAYS * 86_400_000).toISOString();
    const { data: recent } = force
      ? { data: [] }
      : await db.from('gsc_url_inspections').select('property, url').gte('inspected_at', freshCutoff);
    const fresh = new Set((recent ?? []).map((r: any) => `${r.property} ${r.url}`));

    const queue: Array<{ target: (typeof targets)[number]; url: string }> = [];
    for (const t of targets) for (const u of t.urls) if (!fresh.has(`${t.property} ${u}`)) queue.push({ target: t, url: u });
    const batch = queue.slice(0, MAX_PER_RUN);

    let inspected = 0;
    let outOfTime = 0;
    const failed: string[] = [];
    const byBucket: Record<string, number> = {};
    const newTasks: string[] = [];
    const started = Date.now();
    for (const { target, url: u } of batch) {
      if (Date.now() - started > TIME_BUDGET_MS) { outOfTime += 1; continue; }
      try {
        const raw = await inspectUrl(target.property, u);
        const facts = parseInspection(u, raw);
        // Google's state is from its LAST crawl. When it reports a fetch failure, ask the URL
        // ourselves right now: a 200 today means "awaiting recrawl", not a bug.
        const fetchProblem = /not found|server error|forbidden/i.test(facts.coverageState ?? '') || /NOT_FOUND|SERVER_ERROR|ACCESS_DENIED/.test((facts.pageFetchState ?? '').toUpperCase());
        let liveStatus: number | null = null;
        if (fetchProblem) {
          try { liveStatus = (await fetch(u, { method: 'HEAD', redirect: 'follow', headers: { 'user-agent': 'quicksites-indexing-sweep' } })).status; } catch { liveStatus = null; }
        }
        const triage = triageInspection(facts, { declaredCanonical: `${target.origin}/`, liveStatus });
        byBucket[triage.bucket] = (byBucket[triage.bucket] ?? 0) + 1;
        const { error } = await db.from('gsc_url_inspections').upsert(
          {
            property: target.property,
            url: u,
            template_id: target.templateId,
            inspected_at: new Date().toISOString(),
            verdict: facts.verdict,
            coverage_state: facts.coverageState,
            indexing_state: facts.indexingState,
            robots_txt_state: facts.robotsTxtState,
            page_fetch_state: facts.pageFetchState,
            user_canonical: facts.userCanonical,
            google_canonical: facts.googleCanonical,
            declared_canonical: `${target.origin}/`,
            last_crawl_time: facts.lastCrawlTime,
            crawled_as: facts.crawledAs,
            bucket: triage.bucket,
            reason: triage.reason,
            remedy: triage.remedy,
            raw,
          },
          { onConflict: 'property,url' },
        );
        if (error) throw new Error(error.message);
        inspected += 1;

        if (TASK_BUCKETS.has(triage.bucket)) {
          // One task per (property, reason); the page lists the URLs. Dedupe on the exact title.
          const title = `Indexing · ${target.property.replace(/^sc-domain:/, '')} · ${triage.reason}`;
          const { data: existing } = await db.from('admin_tasks').select('id').eq('title', title).in('status', ['open', 'in_progress', 'triage']).limit(1);
          if (!existing?.length) {
            await db.from('admin_tasks').insert({
              title,
              details: `${BUCKET_LABEL[triage.bucket]}.\n\nFirst seen on ${u}\n${triage.remedy ?? ''}\n\nAll affected URLs: ${publicBaseUrl()}/admin/seo/indexing`,
              status: 'open',
              priority: triage.bucket === 'auto_fixable' ? 'medium' : 'low',
              category: triage.bucket === 'auto_fixable' ? 'engineering' : 'owner-action',
              source: 'gsc-url-inspect',
            });
            newTasks.push(title);
          }
        }
      } catch (e: unknown) {
        failed.push(`${u}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // One digest, only when something new needs attention — never a nightly "all fine".
    const to = alertRecipients();
    if (newTasks.length && to.length) {
      const subject = `Indexing: ${newTasks.length} new finding${newTasks.length === 1 ? '' : 's'} across the fleet`;
      const html = `<div style="font-family:system-ui,sans-serif;font-size:14px;color:#111"><p>The nightly URL Inspection sweep found ${newTasks.length} new thing${newTasks.length === 1 ? '' : 's'} to act on:</p><ul>${newTasks.map((t) => `<li>${t.replace(/</g, '&lt;')}</li>`).join('')}</ul><p><a href="${publicBaseUrl()}/admin/seo/indexing">Open the indexing page →</a></p><p style="color:#999;font-size:12px">Replaces reading Search Console's emails: this names the URLs and the canonical Google chose. Sent only when something new appeared.</p></div>`;
      try { await sendEmail({ to: to.join(','), subject, html }); } catch { /* digest is best-effort; the rows are written */ }
    }

    return NextResponse.json({
      ok: true,
      properties: properties.length,
      sites: targets.length,
      queued: queue.length,
      inspected,
      skippedFresh: targets.reduce((n, t) => n + t.urls.length, 0) - queue.length,
      remaining: Math.max(0, queue.length - batch.length) + outOfTime,
      outOfTime,
      seconds: Math.round((Date.now() - started) / 1000),
      byBucket,
      newTasks,
      failed: failed.slice(0, 20),
    });
  });
}

export const GET = handle;
export const POST = handle;
