// lib/jobs/postings.ts
//
// Saved job postings — the persistent half of the Verbatim job-seeker workspace.
//
// ⚠️ READ THE MIGRATION HEADER (20260823) BEFORE ADDING ANYTHING HERE. A row is "this named person
// is applying to this named company", which is the fact most job seekers hide from their current
// employer. The table is owner-scoped by RLS with no admin bypass, deliberately.
//
// ⚠️ THAT IS WHY THESE READS USE THE USER'S OWN CLIENT, NOT THE SERVICE ROLE. Most of this codebase
// queries with the service role and relies on route-level authorization (CLAUDE.md §6) — which is
// fine for a menu and wrong here: it would mean every query is capable of reading anyone's job
// search, with only a correct `.eq('owner_id', …)` standing between. Going through the caller's
// session makes RLS the guarantee rather than the backstop, so a forgotten filter returns nothing
// instead of everything.

import type { SupabaseClient } from '@supabase/supabase-js';

export type JobPosting = {
  id: string;
  owner_id: string;
  template_id: string | null;
  url: string | null;
  company: string | null;
  title: string | null;
  body: string | null;
  notes: string | null;
  stage: string | null;
  created_at: string;
  updated_at: string;
};

export type JobPostingInput = {
  url?: string | null;
  company?: string | null;
  title?: string | null;
  body?: string | null;
  notes?: string | null;
  stage?: string | null;
  templateId?: string | null;
};

function clean(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : '';
  return s ? s : null;
}

/** A posting with neither a link nor pasted text is not a record of anything. */
export function validatePosting(input: JobPostingInput): string | null {
  const url = clean(input.url);
  if (!url && !clean(input.body)) {
    return 'Paste the posting text or its link — one of the two.';
  }
  if (url && !/^https?:\/\//i.test(url)) {
    return 'The link should start with http:// or https://';
  }
  return null;
}

/**
 * ⚠️ WE DO NOT FETCH THE POSTING. Only what the user pasted is stored. Fetching a job board from
 * our servers is fragile and usually against its terms — and it would mean we hold a copy of a
 * page they chose only to LINK. Paste is a choice; fetch is a decision made on their behalf.
 */
export async function createPosting(
  db: SupabaseClient,
  ownerId: string,
  input: JobPostingInput,
): Promise<{ posting?: JobPosting; error?: string }> {
  const invalid = validatePosting(input);
  if (invalid) return { error: invalid };

  const { data, error } = await db
    .from('job_postings')
    .insert({
      owner_id: ownerId,
      template_id: input.templateId ?? null,
      url: clean(input.url),
      company: clean(input.company),
      title: clean(input.title),
      body: clean(input.body),
      notes: clean(input.notes),
      stage: clean(input.stage),
    })
    .select('*')
    .single();

  if (error) return { error: error.message };
  return { posting: data as JobPosting };
}

export async function listPostings(db: SupabaseClient): Promise<JobPosting[]> {
  // No owner filter — RLS scopes it. Adding one would be harmless; RELYING on one would be the
  // mistake, since a filter is the thing a refactor drops and a policy is not.
  const { data } = await db
    .from('job_postings')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  return (data as JobPosting[]) ?? [];
}

export async function deletePosting(db: SupabaseClient, id: string): Promise<string | null> {
  const { error } = await db.from('job_postings').delete().eq('id', id);
  return error ? error.message : null;
}

export async function updatePosting(
  db: SupabaseClient,
  id: string,
  input: JobPostingInput,
): Promise<string | null> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of ['url', 'company', 'title', 'body', 'notes', 'stage'] as const) {
    if (k in input) patch[k] = clean(input[k]);
  }
  if ('templateId' in input) patch.template_id = input.templateId ?? null;
  const { error } = await db.from('job_postings').update(patch).eq('id', id);
  return error ? error.message : null;
}

/** Interview stages HiveJournal's rehearsal engine understands. */
export const REHEARSAL_STAGES = [
  'recruiter_screen',
  'hiring_manager',
  'founder_exec',
  'technical',
  'onsite',
] as const;
export type RehearsalStage = (typeof REHEARSAL_STAGES)[number];

export const STAGE_LABELS: Record<string, string> = {
  recruiter_screen: 'Recruiter screen',
  hiring_manager: 'Hiring manager',
  founder_exec: 'Founder / exec',
  technical: 'Technical',
  onsite: 'Onsite',
};

/**
 * Deep-link into HiveJournal's rehearsal room for one posting.
 *
 * ⚠️ THE HANDOFF IS USER-INITIATED AND CARRIES NOTHING WE WERE NOT ASKED TO CARRY. Their engine is
 * stateless and stores nothing — their words, and the reason the persistence lives here instead.
 * So this builds a link a person clicks; nothing is sent when a posting is merely saved, and no
 * résumé is POSTed anywhere on a schedule.
 *
 * ⚠️ THE POSTING BODY IS DELIBERATELY NOT IN THE URL. A job description in a query string ends up
 * in browser history, in any referrer header, and in the receiving server's access logs — three
 * copies of a private document created by the convenience of prefilling. The link carries company,
 * role and stage, which is enough to open the right rehearsal; the person pastes the rest if they
 * want it there.
 */
export function rehearsalLinkFor(
  posting: Pick<JobPosting, 'company' | 'title' | 'stage'>,
  base = 'https://www.hivejournal.com/rehearsal-room/interview',
): string {
  const p = new URLSearchParams();
  if (posting.company) p.set('company', posting.company);
  if (posting.title) p.set('role', posting.title);
  if (posting.stage) p.set('stage', posting.stage);
  const qs = p.toString();
  return qs ? `${base}?${qs}` : base;
}
