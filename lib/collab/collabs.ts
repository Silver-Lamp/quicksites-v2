// lib/collab/collabs.ts
//
// Reads and writes for a client collaboration thread.
//
// ⚠️ THE SCOPING RULE, WHICH IS THE WHOLE SECURITY MODEL. Every function here takes the collab id
// as its FIRST argument and that id must come from a verified token or an ownership check — never
// from a request body. A token that authorises "a collab" plus a body that names "which collab"
// is the shape of every IDOR bug ever written, and the only reliable defence is to make the safe
// call the easy one: there is deliberately no `listMessages(filter)` that could be handed an
// arbitrary id.
//
// Service-role throughout, because both tables are deny-default RLS and the client is
// unauthenticated by design — there is no session for a policy to key on. Authorisation lives in
// the caller (token verified, or operator session checked), which makes it load-bearing rather
// than incidental.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type AuthorRole = 'operator' | 'client';
export type MessageKind = 'message' | 'question' | 'answer';

export type Collab = {
  id: string;
  title: string;
  client_name: string | null;
  client_email: string | null;
  operator_id: string | null;
  template_ids: string[];
  status: string;
  decided_template_id: string | null;
  created_at: string;
};

export type CollabMessage = {
  id: string;
  collab_id: string;
  author_role: AuthorRole;
  author_name: string | null;
  kind: MessageKind;
  answers_id: string | null;
  body: string;
  template_id: string | null;
  created_at: string;
};

function db(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/** One collab by id. The id must already be authorised by the caller. */
export async function getCollab(collabId: string): Promise<Collab | null> {
  const s = db();
  if (!s) return null;
  const { data } = await s.from('client_collabs').select('*').eq('id', collabId).maybeSingle();
  return (data as Collab) ?? null;
}

/** The thread, oldest first — a conversation reads forwards. */
export async function listMessages(collabId: string): Promise<CollabMessage[]> {
  const s = db();
  if (!s) return [];
  const { data } = await s
    .from('collab_messages')
    .select('*')
    .eq('collab_id', collabId)
    .order('created_at', { ascending: true });
  return (data as CollabMessage[]) ?? [];
}

/**
 * Post a message.
 *
 * ⚠️ `authorRole` IS A PARAMETER, NOT A GUESS. The route decides it from HOW the caller
 * authenticated — a verified collab token means 'client', an operator session means 'operator' —
 * and never from anything the caller sent. If a client could post as an operator, the thread
 * stops being evidence of what was agreed, which is the only reason it exists.
 */
export async function postMessage(
  collabId: string,
  input: {
    authorRole: AuthorRole;
    authorName?: string | null;
    body: string;
    kind?: MessageKind;
    answersId?: string | null;
    templateId?: string | null;
  },
): Promise<CollabMessage | null> {
  const s = db();
  if (!s) return null;
  const body = String(input.body ?? '').trim().slice(0, 8000);
  if (!body) return null;

  const { data, error } = await s
    .from('collab_messages')
    .insert({
      collab_id: collabId,
      author_role: input.authorRole,
      author_name: input.authorName ?? null,
      kind: input.kind ?? 'message',
      answers_id: input.answersId ?? null,
      body,
      template_id: input.templateId ?? null,
    } as any)
    .select('*')
    .single();

  if (error) return null;
  return data as CollabMessage;
}

/**
 * Is this template actually one of the options in this thread?
 *
 * ⚠️ `template_ids` ALONE IS NO LONGER THE ANSWER, AND THAT WAS A LIVE BUG WAITING. Once an option
 * has a v2, the revision is a new template row that never enters that array — so a client clicking
 * "I like this one" on the newest version of B would have been told *"That option is not on offer
 * here"*, about a page we built for her and put in front of her. The lineage in
 * `collab_option_versions` is equally on offer.
 *
 * Still a whitelist, not a relaxation: an id that is in neither place is refused, so a crafted
 * request cannot point a recorded decision at a site she was never shown.
 */
async function isOnOffer(collabId: string, collab: Collab, templateId: string): Promise<boolean> {
  if (collab.template_ids?.includes(templateId)) return true;
  const s = db();
  if (!s) return false;
  const { data } = await s
    .from('collab_option_versions')
    .select('id')
    .eq('collab_id', collabId)
    .eq('template_id', templateId)
    .limit(1);
  return !!data?.length;
}

/**
 * The option letter a template belongs to ('A'), or null. Used wherever a decision or a reply has
 * to NAME which option it is about.
 *
 * ⚠️ NOT AN ARRAY INDEX. `template_ids.indexOf()` returns -1 for every revision, so the thread
 * would record "Leaning towards this one" with no letter — in a document whose entire purpose is
 * being readable months later by someone reconstructing what was agreed.
 */
export async function optionLabelFor(collab: Collab, templateId: string | null): Promise<string | null> {
  if (!templateId) return null;
  const s = db();
  if (s) {
    // ⚠️ NOT `.maybeSingle()`. Nothing constrains a template to one lineage — the unique key is
    // (collab_id, option_key, version) — and maybeSingle() ERRORS on a second row, returning null,
    // which drops us into the index fallback and answers with a different letter than the one the
    // client has been using. Ambiguity resolves to the first option deterministically instead of
    // silently becoming a wrong label.
    const { data } = await s
      .from('collab_option_versions')
      .select('option_key')
      .eq('collab_id', collab.id)
      .eq('template_id', templateId)
      .order('option_key', { ascending: true })
      .limit(1);
    const key = (data?.[0] as any)?.option_key;
    if (key) return key as string;
  }
  const idx = (collab.template_ids ?? []).indexOf(templateId);
  return idx >= 0 ? String.fromCharCode(65 + idx) : null;
}

/**
 * Record which layout the client chose.
 *
 * ⚠️ ONLY AN ID THAT IS ACTUALLY ON OFFER. A decision naming a template outside `template_ids`
 * would be meaningless — and worse, it would let a crafted request point a client's recorded
 * choice at a site they were never shown.
 */
export async function recordDecision(collabId: string, templateId: string | null): Promise<boolean> {
  const s = db();
  if (!s) return false;

  const collab = await getCollab(collabId);
  if (!collab) return false;

  // null = "I have not decided after all". A preference someone can't take back is a trap,
  // not a decision — see the note on the route.
  if (templateId !== null && !(await isOnOffer(collabId, collab, templateId))) return false;

  // Idempotent: clicking the same option twice is not a second decision, and must not produce
  // a second entry in the thread. (It did: an accidental double-click left TWO "Picked this
  // one." messages attributed to the client, neither of which she wrote.)
  if (collab.decided_template_id === templateId) return true;

  const { error } = await s
    .from('client_collabs')
    .update({
      decided_template_id: templateId,
      status: templateId ? 'decided' : 'shared',
      updated_at: new Date().toISOString(),
    } as any)
    .eq('id', collabId);
  return !error;
}

/**
 * Template identity for an arbitrary set of ids — every version of every option, not just the
 * ones in `template_ids`. Keyed by id so a caller cannot accidentally render the wrong row.
 */
export async function templatesByIds(ids: string[]) {
  const s = db();
  const unique = [...new Set(ids.filter(Boolean))];
  if (!s || !unique.length) return {} as Record<string, TemplateRef>;
  const { data } = await s
    .from('templates')
    .select('id, slug, template_name, business_name')
    .in('id', unique);
  const out: Record<string, TemplateRef> = {};
  for (const t of (data ?? []) as any[]) out[t.id] = t as TemplateRef;
  return out;
}

export type TemplateRef = {
  id: string;
  slug: string;
  template_name: string | null;
  business_name: string | null;
};

/** The layouts under discussion, in the order the operator chose to present them. */
export async function listCollabTemplates(collab: Collab) {
  const s = db();
  if (!s || !collab.template_ids?.length) return [];
  const { data } = await s
    .from('templates')
    .select('id, slug, template_name, business_name')
    .in('id', collab.template_ids);

  const byId = new Map((data ?? []).map((t: any) => [t.id, t]));
  // Preserve presentation order — `.in()` returns rows in whatever order it likes, and the
  // sequence the operator chose is a design decision, not incidental.
  return collab.template_ids.map((id) => byId.get(id)).filter(Boolean);
}
