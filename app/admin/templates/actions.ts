// app/admin/templates/actions.ts
'use server';

import { getSupabaseForAction } from '@/lib/supabase/serverClient';
import { saveSiteWithClient } from '@/admin/lib/saveSite'; // or a similar saveTemplateWithClient helper
import type { Template } from '@/types/template';

// template table version (adjust table + helper as needed)
export async function saveTemplateAction(tpl: Template): Promise<Template> {
  const supabase = await getSupabaseForAction();
  // If you have a separate helper for templates, call it here.
  // Otherwise adapt saveSiteWithClient to write to your templates table.
  return saveSiteWithClient(supabase, tpl);
}

export async function saveSiteAction(site: Template): Promise<Template> {
  const supabase = await getSupabaseForAction();
  return saveSiteWithClient(supabase, site);
}
