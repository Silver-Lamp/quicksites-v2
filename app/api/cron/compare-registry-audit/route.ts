// app/api/cron/compare-registry-audit/route.ts
//
// Quarterly staleness audit of the compare cluster (mirrors HiveJournal's contract, coordinated
// via crosstalk). It NEVER re-fetches competitor pricing — auto-scraping is fragile and would
// ship a wrong price, torching the honesty-first trust. Instead it FLAGS entries a human should
// re-verify by filing an admin_task:
//   - a LIVE cluster whose pricesVerified is >90d old  → "Refresh compare cluster: X"
//   - a CANDIDATE product with no cluster              → "Build compare cluster: X"
//
// Scheduled daily but gated to fire at most every 90d via a `site_settings` timestamp (NOT a
// 90-day setInterval, which no serverless process survives) — robust to restarts. Dedupes
// against still-open tasks so it never piles up duplicates. Kill-switch:
// COMPARE_REGISTRY_AUDIT_ENABLED=false.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runCron } from '@/lib/cron/record';
import { isCronAuthorized } from '@/lib/cron/auth';
import { getSiteSetting, setSiteSetting } from '@/lib/settings/siteSettings';
import { COMPARE_REGISTRY, auditCompareRegistry, type CompareAuditFinding } from '@/lib/compare/registry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LAST_AUDIT_KEY = 'compare_registry_last_audit';
const AUDIT_EVERY_DAYS = 90;
const TASK_SOURCE = 'compare-registry-audit';

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
    { auth: { persistSession: false } },
  );
}

/** Stable, date-independent title per finding (so dedupe against open tasks works). */
function titleFor(f: CompareAuditFinding): string {
  return f.kind === 'stale' ? `Refresh compare cluster: ${f.name}` : `Build compare cluster: ${f.name}`;
}

function detailsFor(f: CompareAuditFinding): string {
  if (f.kind === 'stale') {
    return (
      `Competitor pricing was last verified ${f.pricesVerified} (~${f.ageDays === Infinity ? 'unknown' : f.ageDays}d ago). ` +
      `Re-verify each competitor's public pricing shown on ${f.clusterPath}, then update ${f.libFile} ` +
      `(bump PRICES_VERIFIED and the registry's pricesVerified date). Do NOT auto-fetch — a human verifies, ` +
      `because a wrong price torches the honesty-first trust the cluster is built on.`
    );
  }
  return `No compare cluster exists for this candidate yet${f.notes ? ` (${f.notes})` : ''}. Consider building /compare/<slug> pages for it (see lib/compare/competitors.ts as the template).`;
}

async function handle(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  return runCron('compare-registry-audit', async () => {
    if (process.env.COMPARE_REGISTRY_AUDIT_ENABLED === 'false') {
      return NextResponse.json({ ok: true, skipped: 'COMPARE_REGISTRY_AUDIT_ENABLED=false' });
    }

    const force = new URL(req.url).searchParams.get('force') === '1';
    const now = Date.now();

    // Due-check: fire at most once per AUDIT_EVERY_DAYS (persisted, restart-safe).
    const lastIso = await getSiteSetting<string>(LAST_AUDIT_KEY, '');
    const lastMs = lastIso ? Date.parse(lastIso) : NaN;
    const ageDays = Number.isFinite(lastMs) ? (now - lastMs) / 86_400_000 : Infinity;
    if (!force && ageDays < AUDIT_EVERY_DAYS) {
      return NextResponse.json({ ok: true, skipped: 'not_due', days_since_last: Math.floor(ageDays) });
    }

    const findings = auditCompareRegistry(COMPARE_REGISTRY, now);

    let filed = 0;
    let deduped = 0;
    if (findings.length) {
      const db = admin();
      // Dedupe against still-actionable tasks from this source.
      const { data: openTasks } = await db
        .from('admin_tasks')
        .select('title')
        .eq('source', TASK_SOURCE)
        .in('status', ['open', 'in_progress', 'blocked']);
      const openTitles = new Set((openTasks ?? []).map((t: any) => String(t.title)));

      const rows = findings
        .filter((f) => {
          if (openTitles.has(titleFor(f))) {
            deduped++;
            return false;
          }
          return true;
        })
        .map((f) => ({
          title: titleFor(f),
          details: detailsFor(f),
          priority: 'medium',
          category: 'compare-registry',
          source: TASK_SOURCE,
          created_by: null,
        }));

      if (rows.length) {
        const { error } = await db.from('admin_tasks').insert(rows);
        if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
        filed = rows.length;
      }
    }

    await setSiteSetting(LAST_AUDIT_KEY, new Date(now).toISOString(), null);

    return NextResponse.json({
      ok: true,
      audited: COMPARE_REGISTRY.length,
      findings: findings.length,
      tasks_filed: filed,
      deduped,
    });
  });
}

export async function GET(req: NextRequest) {
  return handle(req);
}
export async function POST(req: NextRequest) {
  return handle(req);
}
