// app/api/admin/templates/apply-backdrop/route.ts
//
// Apply a site backdrop so a template stops rendering as one flat color. Thin wrapper over
// lib/theme/applyBackdropUpgrade. **Free** — every style this route applies is pure CSS
// derived from the site's own theme vars; nothing is generated and nothing is spent, which
// is why bulk mode is safe here and would not be for the painterly style.
//
// POST { templateId, style?, intensity?, force? }   → one site
// POST { all: true, limit?, force? }                → fleet upgrade (CSS only, $0)
//   → { ok:true, changed, style }
//   → { ok:true, changed:false, reason:'owner_customized'|'already_applied'|'has_painterly' }

import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { rateLimitOr429 } from '@/lib/api/rateLimitGuard';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { applyBackdropUpgrade } from '@/lib/theme/applyBackdropUpgrade';
import { BACKDROP_STYLES, type BackdropStyle } from '@/lib/theme/backdrops';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  const operator = await getAdminUser();
  if (!operator) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });

  const limited = await rateLimitOr429(req, 'templates-apply-backdrop', 120, 3600);
  if (limited) return limited;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    /* empty body is fine for the single-site form */
  }

  const style: BackdropStyle | undefined =
    typeof body?.style === 'string' && BACKDROP_STYLES.includes(body.style) ? body.style : undefined;

  // The paid style never comes through this route — it needs a per-site generation call
  // and its own explicit owner action (painterly-backdrop standard rule 2).
  if (style === 'painterly') {
    return NextResponse.json(
      { ok: false, reason: 'use_paint_endpoint', error: 'Painterly backdrops are generated per site — use /api/admin/templates/paint-backdrop.' },
      { status: 400 },
    );
  }

  const intensity = typeof body?.intensity === 'number' ? body.intensity : undefined;
  const force = !!body?.force;

  // ---- Fleet upgrade (CSS only, so bulk is safe) ----
  if (body?.all === true) {
    const limit = Math.min(Math.max(Number(body?.limit) || 200, 1), 1000);
    const { data: rows, error } = await supabaseAdmin
      .from('templates')
      .select('id')
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    const results = { scanned: 0, changed: 0, skipped: 0, failed: 0 as number, reasons: {} as Record<string, number> };
    for (const r of rows ?? []) {
      results.scanned++;
      try {
        const out = await applyBackdropUpgrade((r as any).id, operator.id, { force, style, intensity });
        if (out.changed) results.changed++;
        else {
          results.skipped++;
          const k = out.reason ?? 'unknown';
          results.reasons[k] = (results.reasons[k] ?? 0) + 1;
        }
      } catch {
        results.failed++;
      }
    }
    // Report what was skipped and why — a bulk run that silently no-ops reads as success.
    return NextResponse.json({ ok: true, bulk: true, ...results });
  }

  // ---- Single site ----
  const templateId = String(body?.templateId ?? '').trim();
  if (!templateId) return NextResponse.json({ ok: false, error: 'templateId required' }, { status: 400 });

  const out = await applyBackdropUpgrade(templateId, operator.id, { force, style, intensity });
  return NextResponse.json({ ok: true, ...out });
}
