// lib/server/logTemplateEvent.ts
import { supabaseAdmin } from './supabaseAdmin';
import { diffBlocks } from '@/lib/diff/blocks';

type EventType = 'open' | 'autosave' | 'save' | 'snapshot' | 'publish';

// Accept either snake_case (existing) or camelCase (newer callers)
type LogEventParamsSnake = {
  template_id: string;
  type: EventType;
  at?: string;
  rev_before?: number | null;
  rev_after?: number | null;
  actor?: { id?: string; name?: string; email?: string } | null;
  fields_touched?: string[] | null;
  diff?: { added?: number; changed?: number; removed?: number } | null;
  meta?: Record<string, any> | null;
};

type LogEventParamsCamel = {
  templateId: string;
  type: EventType;
  at?: string;
  revBefore?: number | null;
  revAfter?: number | null;
  actor?: { id?: string; name?: string; email?: string } | null;
  fieldsTouched?: string[] | null;
  diff?: { added?: number; changed?: number; removed?: number } | null;
  meta?: Record<string, any> | null;
};

type LogEventParams = LogEventParamsSnake | LogEventParamsCamel;

function get<K extends string>(obj: any, ...keys: K[]): any {
  for (const k of keys) if (obj?.[k] !== undefined) return obj[k];
  return undefined;
}

function slimBlockDiff(bd: ReturnType<typeof diffBlocks>) {
  const sample = <T,>(arr: T[], n = 3) => arr.slice(0, n);
  return {
    addedByType: bd.addedByType,
    modifiedByType: bd.modifiedByType,
    removedByType: bd.removedByType,
    // keep tiny samples to aid debugging / drill-ins without bloating the row
    added: sample(bd.added),
    modified: sample(bd.modified),
    removed: sample(bd.removed),
  };
}

export async function logTemplateEvent(params: LogEventParams) {
  try {
    // -------- Normalize inputs (support camelCase or snake_case) --------
    const template_id = String(get(params, 'template_id', 'templateId'));
    const type = get(params, 'type') as EventType;
    const at = get(params, 'at') as string | undefined;

    const rev_before = get(params as any, 'rev_before', 'revBefore') ?? null;
    const rev_after = get(params as any, 'rev_after', 'revAfter') ?? null;

    const actor =
      (get(params as any, 'actor') as LogEventParamsSnake['actor']) ?? null;

    const fields_touched =
      (get(params as any, 'fields_touched', 'fieldsTouched') as
        | string[]
        | null) ?? null;

    let diff =
      (get(params as any, 'diff') as { added?: number; changed?: number; removed?: number } | null) ??
      null;

    let meta = (get(params as any, 'meta') as Record<string, any> | null) ?? null;

    // -------- Best-effort block diff computation --------
    // If caller didn't include meta.blockDiff but passed before/after data, compute it here.
    const beforeData = meta?.before?.data ?? meta?.dataBefore ?? undefined;
    const afterData =
      meta?.after?.data ??
      meta?.dataAfter ??
      meta?.data ??
      meta?.snapshot?.data ??
      undefined;

    if (!meta?.blockDiff && beforeData && afterData) {
      try {
        const bd = diffBlocks({ data: beforeData }, { data: afterData });
        const slim = slimBlockDiff(bd);
        meta = { ...(meta ?? {}), blockDiff: slim };

        // If numeric diff not provided, fill from blockDiff
        if (!diff) {
          diff = {
            added: bd.added.length,
            changed: bd.modified.length,
            removed: bd.removed.length,
          };
        }
      } catch {
        // ignore diff calc issues; logging should never break commit flows
      }
    }

    // -------- Prepare row --------
    const baseRow: any = {
      template_id,
      type,
      rev_before,
      rev_after,
      actor,
      fields_touched,
      diff,
    };
    if (at) baseRow.at = at; // only include if provided (DB may default this)

    // Prefer inserting with meta; if the column doesn't exist, fall back gracefully
    if (meta && typeof meta === 'object') {
      const ins = await supabaseAdmin.from('template_events').insert({
        ...baseRow,
        meta, // jsonb
      });
      if (!ins.error) return;
      const msg = String(ins.error?.message || '').toLowerCase();
      const missingMetaCol = msg.includes('column') && msg.includes('meta');
      if (!missingMetaCol) return; // swallow other errors to avoid breaking app flow
      // else fall through to plain insert without meta
    }

    await supabaseAdmin.from('template_events').insert(baseRow);
  } catch {
    // Swallow logging errors — event logging must be non-blocking
  }
}
