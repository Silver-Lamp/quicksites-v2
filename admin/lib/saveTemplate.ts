'use server';
import { getSupabaseForAction } from '@/lib/supabase/serverClient';
import type { Template } from '@/types/template';

export async function saveTemplate(input: any, id?: string): Promise<Template> {
  const supabase = await getSupabaseForAction();

  // If caller passed { db, header_block, footer_block }, unwrap it; otherwise use input as source.
  const src = input?.db ? input.db : input;

  const payload: Record<string, any> = {
    id: id ?? src.id,
    template_name: src.template_name,
    slug: src.slug,
    layout: src.layout,
    color_scheme: src.color_scheme,
    theme: src.theme,
    brand: src.brand,
    industry: src.industry,
    phone: src.phone ?? null,
    color_mode: src.color_mode ?? null,
    data: src.data ?? {},
    // snapshots (prefer explicit snapshots if caller sent {db,...})
    header_block: (input?.header_block ?? src.header_block ?? src.headerBlock) ?? null,
    footer_block: (input?.footer_block ?? src.footer_block ?? src.footerBlock) ?? null,
  };

  for (const k of Object.keys(payload)) if (payload[k] === undefined) delete payload[k];

  const { data, error } = await supabase
    .from('templates')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single();

  if (error) throw new Error(JSON.stringify(error));
  return data as unknown as Template;
}
