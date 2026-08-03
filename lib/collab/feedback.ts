// lib/collab/feedback.ts
//
// Reviews of a collab's options, from AI mesh sessions and AI browsing personas.
//
// ⚠️ THE CLIENT-FACING READ IS A DIFFERENT FUNCTION FROM THE OPERATOR READ, ON PURPOSE. Two
// call sites filtering the same list with a boolean is how an unpromoted review eventually
// reaches a customer: someone adds a third call site and forgets the filter. `listClientFeedback`
// cannot return an unpromoted row because the filter is inside it, not at the caller.
//
// ⚠️ AND IT NEVER RETURNS A ROW WITHOUT ITS LABEL. `reviewer_is_ai` is NOT NULL in the schema and
// the client shape carries it through, so a renderer cannot receive a review that it is unable to
// attribute. The failure this prevents is a real client reading "three reviewers preferred B" and
// picturing three people.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type FeedbackSource = 'mesh' | 'persona' | 'operator';
export type FeedbackStatus = 'new' | 'applied' | 'dismissed';

export type Feedback = {
  id: string;
  collab_id: string;
  template_id: string | null;
  source: FeedbackSource;
  source_label: string;
  reviewer_is_ai: boolean;
  honesty_note: string | null;
  body: string;
  picked_option: string | null;
  status: FeedbackStatus;
  visible_to_client: boolean;
  created_at: string;
};

/** The note shown to a client when a source did not supply one. Never left blank. */
export const DEFAULT_AI_NOTE: Record<FeedbackSource, string> = {
  mesh: 'Written by an AI assistant reviewing the page — not a human reviewer.',
  persona: 'AI persona observation — behaves as a real person would; not a human tester.',
  operator: '',
};

function db(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Everything, for the operator. Includes unpromoted rows — that is the point of this view. */
export async function listFeedback(collabId: string): Promise<Feedback[]> {
  const s = db();
  if (!s) return [];
  const { data } = await s
    .from('collab_feedback')
    .select('*')
    .eq('collab_id', collabId)
    .order('created_at', { ascending: false });
  return (data as Feedback[]) ?? [];
}

/**
 * Only what an operator has promoted. The filter lives here so no caller can omit it.
 * Oldest first — a client reads reviews as a conversation, in the order they arrived.
 */
export async function listClientFeedback(collabId: string): Promise<Feedback[]> {
  const s = db();
  if (!s) return [];
  const { data } = await s
    .from('collab_feedback')
    .select('*')
    .eq('collab_id', collabId)
    .eq('visible_to_client', true)
    .order('created_at', { ascending: true });
  return (data as Feedback[]) ?? [];
}

export async function addFeedback(
  collabId: string,
  input: {
    source: FeedbackSource;
    sourceLabel: string;
    reviewerIsAi: boolean;
    body: string;
    templateId?: string | null;
    pickedOption?: string | null;
    honestyNote?: string | null;
  },
): Promise<Feedback | null> {
  const s = db();
  if (!s) return null;
  const body = String(input.body ?? '').trim().slice(0, 20000);
  if (!body) return null;

  // A review from an AI source always carries a note, whether or not the caller supplied one.
  // An unlabeled AI review is the exact failure this module exists to prevent, so the fallback
  // is here rather than in a renderer that might not run.
  const honesty =
    (input.honestyNote ?? '').trim() ||
    (input.reviewerIsAi ? DEFAULT_AI_NOTE[input.source] || DEFAULT_AI_NOTE.mesh : '');

  const { data, error } = await s
    .from('collab_feedback')
    .insert({
      collab_id: collabId,
      template_id: input.templateId ?? null,
      source: input.source,
      source_label: String(input.sourceLabel ?? '').trim().slice(0, 120) || 'unattributed',
      reviewer_is_ai: input.reviewerIsAi,
      honesty_note: honesty || null,
      body,
      picked_option: input.pickedOption ?? null,
      // Deliberately not settable here: nothing arrives visible. Promotion is a separate,
      // deliberate act by an operator who has read the row.
    } as any)
    .select('*')
    .single();

  if (error) return null;
  return data as Feedback;
}

/** Promote / demote a review on the client's page, or mark it applied or dismissed. */
export async function updateFeedback(
  collabId: string,
  feedbackId: string,
  patch: { visibleToClient?: boolean; status?: FeedbackStatus },
): Promise<boolean> {
  const s = db();
  if (!s) return false;
  const update: Record<string, unknown> = {};
  if (typeof patch.visibleToClient === 'boolean') update.visible_to_client = patch.visibleToClient;
  if (patch.status) update.status = patch.status;
  if (!Object.keys(update).length) return false;

  // ⚠️ Scoped by collab_id as well as id. The id alone would be enough for Postgres and not
  // enough for us: a route that takes both makes a mixed-up id a miss rather than a cross-thread
  // write. Same rule as everything else in lib/collab.
  //
  // ⚠️ AND IT COUNTS THE ROWS IT CHANGED. `!error` was the obvious check and it was WRONG: an
  // UPDATE matching nothing is a perfectly successful UPDATE, so a scoped-out or deleted row
  // returned true and the operator got a confirmation for a change that never happened. Promoting
  // a review to a client's page is exactly where a lying success is expensive.
  const { data, error } = await s
    .from('collab_feedback')
    .update(update as any)
    .eq('id', feedbackId)
    .eq('collab_id', collabId)
    .select('id');
  return !error && (data?.length ?? 0) > 0;
}
