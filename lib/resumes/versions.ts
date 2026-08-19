// lib/resumes/versions.ts
//
// The private résumé-version library behind the Verbatim workspace: many tailored versions, at
// most one of them served publicly.
//
// ⚠️ READ THE MIGRATION HEADER (20260824) FIRST. The short version: a version's LABEL names the
// company it was tailored for, which is the `job_postings` disclosure one indirection removed, so
// it is owner-scoped by RLS with no admin bypass — and it must never reach a storage path, a URL,
// or an outgoing filename.
//
// ⚠️ THESE READS AND WRITES USE THE CALLER'S OWN CLIENT, NOT THE SERVICE ROLE — same reasoning as
// lib/jobs/postings.ts. RLS is the guarantee here, not the backstop, so a forgotten filter returns
// nothing instead of everything. The ONE service-role entry point is `resolvePublicVersion`, which
// is unavoidable (its caller is an anonymous visitor) and is therefore written to be narrow: it
// can only ever return a row whose owner explicitly marked it public.

import type { SupabaseClient } from '@supabase/supabase-js';

export const RESUME_BUCKET = 'resume-versions';

/** Formats we accept. Closed on purpose: each one is a MIME type we are willing to serve. */
export const RESUME_FORMATS = {
  pdf: { ext: 'pdf', contentType: 'application/pdf', label: 'PDF' },
  docx: {
    ext: 'docx',
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    label: 'Word',
  },
  md: { ext: 'md', contentType: 'text/markdown; charset=utf-8', label: 'Markdown' },
} as const;

export type ResumeFormat = keyof typeof RESUME_FORMATS;

export function isResumeFormat(v: unknown): v is ResumeFormat {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(RESUME_FORMATS, v);
}

export type ResumeFile = {
  format: ResumeFormat;
  path: string;
  size_bytes: number;
  content_type: string;
};

export type ResumeVersion = {
  id: string;
  owner_id: string;
  label: string;
  notes: string | null;
  files: ResumeFile[];
  is_public: boolean;
  /** The ONE site that serves this version. Null unless `is_public`. */
  public_site_id: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Where a file lives in the private bucket.
 *
 * ⚠️ EVERY SEGMENT IS SERVER-DERIVED. The client supplies a format and bytes, never a name. That
 * is what makes it structurally impossible for "Indeed" to end up in a path: there is no argument
 * through which it could arrive.
 */
export function storagePathFor(ownerId: string, versionId: string, format: ResumeFormat): string {
  return `${ownerId}/${versionId}/resume.${RESUME_FORMATS[format].ext}`;
}

/**
 * The filename a downloader receives.
 *
 * ⚠️ NEVER THE VERSION LABEL. A résumé is forwarded — that is its entire purpose — and a file
 * named for the company it was tailored to is the leak arriving by hand, in an attachment, to
 * someone who was not that company. Neutral, always, for the owner's own download too: the copy
 * on their disk is the one they attach to an email.
 */
export function downloadFilenameFor(personName: string, format: ResumeFormat): string {
  const base =
    (personName || 'Resume')
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-') || 'Resume';
  return `${base}-Resume.${RESUME_FORMATS[format].ext}`;
}

function rows(data: unknown): ResumeVersion[] {
  return ((data as ResumeVersion[]) ?? []).map((v) => ({
    ...v,
    files: Array.isArray(v.files) ? v.files : [],
  }));
}

export async function listVersions(db: SupabaseClient): Promise<ResumeVersion[]> {
  // No owner filter — RLS scopes it. Adding one would be harmless; RELYING on one would be the
  // mistake, since a filter is what a refactor drops and a policy is not.
  const { data } = await db
    .from('resume_versions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  return rows(data);
}

export async function createVersion(
  db: SupabaseClient,
  ownerId: string,
  input: { label?: string | null; notes?: string | null }
): Promise<{ version?: ResumeVersion; error?: string }> {
  const label = (input.label ?? '').trim();
  if (!label) return { error: 'Give this version a name — what it was tailored for.' };

  const { data, error } = await db
    .from('resume_versions')
    .insert({ owner_id: ownerId, label, notes: (input.notes ?? '').trim() || null })
    .select('*')
    .single();

  if (error) return { error: error.message };
  return { version: rows([data])[0] };
}

export async function updateVersion(
  db: SupabaseClient,
  id: string,
  input: { label?: string | null; notes?: string | null }
): Promise<string | null> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ('label' in input) {
    const label = (input.label ?? '').trim();
    if (!label) return 'A version needs a name.';
    patch.label = label;
  }
  if ('notes' in input) patch.notes = (input.notes ?? '').trim() || null;
  const { error } = await db.from('resume_versions').update(patch).eq('id', id);
  return error ? error.message : null;
}

/**
 * Point ONE SITE's public download at one version, or at none.
 *
 * ⚠️ THE SITE IS THE SUBJECT, NOT THE OWNER — see migration 20260830. Scoping this to the owner
 * meant every site they owned served the résumé (2,227 of them, on the account it was built for),
 * under each site's own name. "The sites you own" is not "the site that is about you".
 *
 * ⚠️ UNSET FIRST, THEN SET, and the order is a safety property rather than style. A partial unique
 * index allows one public row per site, so set-then-unset would simply fail; unset-then-set fails
 * in the safe direction — if the second statement dies the site has NO public résumé rather than
 * the wrong one. Nothing public is a broken link; the wrong one public is a document sent to the
 * world on someone's behalf.
 */
export async function setPublicVersion(
  db: SupabaseClient,
  id: string | null,
  siteId: string | null
): Promise<string | null> {
  if (id && !siteId) return 'Choose which site should serve it.';

  // Scoped to this site: another site's public choice is none of this call's business.
  const clear = await db
    .from('resume_versions')
    .update({ is_public: false, public_site_id: null, updated_at: new Date().toISOString() })
    .eq('is_public', true)
    .eq('public_site_id', siteId ?? '');
  if (clear.error) return clear.error.message;
  if (!id) return null;

  const { error } = await db
    .from('resume_versions')
    .update({ is_public: true, public_site_id: siteId, updated_at: new Date().toISOString() })
    .eq('id', id);
  return error ? error.message : null;
}

export async function deleteVersion(db: SupabaseClient, id: string): Promise<string | null> {
  const { error } = await db.from('resume_versions').delete().eq('id', id);
  return error ? error.message : null;
}

export function fileOf(version: ResumeVersion, format: ResumeFormat): ResumeFile | null {
  return version.files.find((f) => f.format === format) ?? null;
}

/** Formats a version actually has a file for, in a stable display order. */
export function formatsOf(version: ResumeVersion): ResumeFormat[] {
  const order: ResumeFormat[] = ['pdf', 'docx', 'md'];
  return order.filter((f) => !!fileOf(version, f));
}
