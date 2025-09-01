import { supabaseAdmin } from './supabaseAdmin';

type EventType = 'open'|'autosave'|'save'|'snapshot'|'publish';

export async function logTemplateEvent(params: {
  template_id: string;
  type: EventType;
  rev_before?: number | null;
  rev_after?: number | null;
  actor?: { id?: string; name?: string; email?: string } | null;
  fields_touched?: string[] | null;
  diff?: { added?: number; changed?: number; removed?: number } | null;
}) {
  try {
    await supabaseAdmin.from('template_events').insert({
      template_id: params.template_id,
      type: params.type,
      rev_before: params.rev_before ?? null,
      rev_after: params.rev_after ?? null,
      actor: params.actor ?? null,
      fields_touched: params.fields_touched ?? null,
      diff: params.diff ?? null,
    });
  } catch {}
}
