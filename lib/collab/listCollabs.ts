// lib/collab/listCollabs.ts
//
// Operator-side reads. Kept separate from lib/collab/collabs.ts because that file's contract is
// "the id is already authorised" — these functions are the ones that DO the authorising, by
// being callable only from admin-gated surfaces.
import { createClient } from '@supabase/supabase-js';
import type { Collab } from '@/lib/collab/collabs';

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export type CollabSummary = Collab & {
  message_count: number;
  /** Questions with no answer yet — what the OPERATOR is waiting on, or the client is. */
  open_questions: number;
  last_message_at: string | null;
  last_message_role: 'operator' | 'client' | null;
};

/**
 * Every collab, newest activity first.
 *
 * ⚠️ SORTED BY LAST MESSAGE, NOT BY CREATION. A worklist ordered by when a thread was created
 * puts the client who just replied at the bottom. The useful question is "who is waiting on me",
 * and the answer is whichever thread a CLIENT spoke in last.
 */
export async function listCollabs(): Promise<CollabSummary[]> {
  const s = db();
  if (!s) return [];

  const { data: collabs } = await s
    .from('client_collabs')
    .select('*')
    .order('created_at', { ascending: false });
  if (!collabs?.length) return [];

  const ids = collabs.map((c: any) => c.id);
  const { data: msgs } = await s
    .from('collab_messages')
    .select('collab_id, author_role, kind, answers_id, created_at')
    .in('collab_id', ids);

  const byCollab = new Map<string, any[]>();
  for (const m of msgs ?? []) {
    if (!byCollab.has(m.collab_id)) byCollab.set(m.collab_id, []);
    byCollab.get(m.collab_id)!.push(m);
  }

  const out: CollabSummary[] = collabs.map((c: any) => {
    const list = (byCollab.get(c.id) ?? []).sort((a, b) => a.created_at.localeCompare(b.created_at));
    const answered = new Set(list.filter((m) => m.answers_id).map((m) => m.answers_id));
    const last = list[list.length - 1];
    return {
      ...(c as Collab),
      message_count: list.length,
      open_questions: list.filter((m) => m.kind === 'question' && !answered.has(m.id)).length,
      last_message_at: last?.created_at ?? null,
      last_message_role: (last?.author_role as any) ?? null,
    };
  });

  return out.sort((a, b) => (b.last_message_at ?? '').localeCompare(a.last_message_at ?? ''));
}
