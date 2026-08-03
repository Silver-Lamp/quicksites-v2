// lib/collab/personaBridge.ts
//
// A persona finding about a URL that happens to be one of a client's option sites gets copied into
// that collab's feedback, in addition to filing as an admin task.
//
// ⚠️ IN ADDITION TO, NEVER INSTEAD OF. The admin task is the operator's queue and must keep
// receiving every finding — a finding that lands only on a client thread is one nobody triages.
//
// ⚠️ BEST-EFFORT, AND SILENT ON FAILURE BY DESIGN. This runs inside the persona-findings receiver,
// whose job is to accept HJ's report. If the bridge throws, HJ sees a 500 and retries a report we
// already stored. The bridge failing costs a cross-reference; the receiver failing costs the
// finding. Only one of those is worth an error.
//
// ⚠️ IT DOES NOT PROMOTE ANYTHING. Rows land with visible_to_client = false, like all feedback. A
// persona finding is a claim — that is why it files at 'triage' — and a claim auto-published onto
// a customer's page is the cry-wolf failure with the customer as the victim.

import { createClient } from '@supabase/supabase-js';
import { addFeedback } from './feedback';

/** `https://foo-ab12.quicksites.ai/whatever` → `foo-ab12`. Null for anything else. */
export function slugFromTenantUrl(raw: string): string | null {
  try {
    const host = new URL(raw).hostname.toLowerCase();
    const m = host.match(/^([a-z0-9-]+)\.quicksites\.ai$/);
    if (!m) return null;
    // 'www' is the marketing site, not a tenant; a finding about it is not about anyone's option.
    return m[1] === 'www' ? null : m[1];
  } catch {
    return null;
  }
}

export async function bridgePersonaFindingToCollabs(input: {
  url: string;
  personaName: string;
  personaId: string;
  goal: string;
  outcome: string;
  summary: string;
  issueLines: string[];
  honestyNote: string;
}): Promise<void> {
  const slug = slugFromTenantUrl(input.url);
  if (!slug) return;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return;
  const s = createClient(url, key, { auth: { persistSession: false } });

  const { data: tpl } = await s.from('templates').select('id').eq('slug', slug).maybeSingle();
  const templateId = (tpl as any)?.id as string | undefined;
  if (!templateId) return;

  // Which collabs have this template on the table? Both the legacy array and the version rows,
  // because an option's v1 lives in one and its v2 in the other.
  const [{ data: byArray }, { data: byVersion }] = await Promise.all([
    s.from('client_collabs').select('id').contains('template_ids', [templateId]),
    s.from('collab_option_versions').select('collab_id').eq('template_id', templateId),
  ]);

  const collabIds = new Set<string>([
    ...((byArray ?? []) as any[]).map((r) => r.id),
    ...((byVersion ?? []) as any[]).map((r) => r.collab_id),
  ]);
  if (!collabIds.size) return;

  const body = [
    `**Goal:** ${input.goal}`,
    `**Outcome:** ${input.outcome}`,
    '',
    input.summary,
    ...(input.issueLines.length ? ['', '**What tripped them up**', ...input.issueLines] : []),
  ].join('\n');

  for (const collabId of collabIds) {
    await addFeedback(collabId, {
      source: 'persona',
      sourceLabel: `${input.personaName} (AI persona)`,
      reviewerIsAi: true,
      honestyNote: input.honestyNote,
      body,
      templateId,
    });
  }
}
