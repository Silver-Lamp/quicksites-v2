// lib/seo/fillLocalBusinessSchema.ts
//
// Server action: turn on LocalBusiness structured data for a template — verify a schema can be
// built from its identity, flip meta.local_business_schema on, and commit. Extracted from the
// fill-local-business-schema route so the route AND the readiness pipeline share one path.
// Idempotent: no-ops when schema is already on or there isn't enough identity to build it.

import { supabaseAdmin } from '@/lib/supabase/admin';
import { buildLocalBusinessSchema, localBusinessSchemaEnabled } from '@/lib/seo/localBusinessSchema';
import { commitTemplatePatch } from '@/lib/templates/commitTemplatePatch';

export type FillSchemaResult = { ok: boolean; changed: boolean; reason?: string; type?: string; error?: string };

export async function fillLocalBusinessSchema(templateId: string, actorId: string | null): Promise<FillSchemaResult> {
  const { data: t } = await supabaseAdmin
    .from('templates')
    .select('id, data, rev')
    .eq('id', templateId)
    .maybeSingle();
  if (!t) return { ok: false, changed: false, reason: 'no_template' };

  const tpl: any = t;
  if (localBusinessSchemaEnabled(tpl.data)) return { ok: true, changed: false, reason: 'already' };
  const built = buildLocalBusinessSchema(tpl.data ?? {});
  if (!built) return { ok: true, changed: false, reason: 'insufficient' };

  const nextData = { ...(tpl.data ?? {}), meta: { ...((tpl.data ?? {}).meta ?? {}), local_business_schema: true } };
  const commitErr = await commitTemplatePatch(templateId, tpl.rev ?? 0, { data: nextData }, actorId);
  if (commitErr) return { ok: false, changed: false, reason: 'commit_failed', error: commitErr };

  return { ok: true, changed: true, type: built['@type'] };
}
