// lib/templates/commitTemplatePatch.ts
//
// Commit a patch to a template through the sanctioned RPC (public.commit_template_http, with
// the app.commit_template fallback). Direct UPDATEs to `templates` are trigger-blocked
// (CLAUDE.md §8), so every server-side write goes through here. Returns an error message
// string on failure, or null on success. Centralizes the payload the routes/actions share.

import { supabaseAdmin } from '@/lib/supabase/admin';

export async function commitTemplatePatch(
  id: string,
  baseRev: number,
  patch: Record<string, any>,
  actorId: string | null,
): Promise<string | null> {
  const payload = { id, base_rev: baseRev ?? 0, patch, actor: actorId, kind: 'save', org_id: null };
  let err: any = null;
  {
    const { error } = await (supabaseAdmin as any).schema('public').rpc('commit_template_http', { p_payload: payload });
    err = error;
  }
  if (err) {
    const { error } = await (supabaseAdmin as any).schema('app').rpc('commit_template', { p_payload: payload });
    err = error;
  }
  return err ? (err.message || 'commit failed') : null;
}
