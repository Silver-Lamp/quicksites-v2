// lib/creative/versions.ts
//
// Takes of a client's creative (ad jingles, spots) and the review thread on each. Data access is
// service-role (the tables are deny-default); the pure parts — threading comments under their
// parent, tallying votes — are exported for tests and the page.
import { supabaseAdmin } from '@/lib/supabase/admin';

export type CreativeVersion = {
  id: string;
  project: string;
  track: string;
  version: number;
  kind: 'audio' | 'video';
  title: string;
  url: string;
  content_type: string | null;
  duration_seconds: number | null;
  transcript: string | null;
  transcript_status: 'pending' | 'done' | 'failed' | 'skipped';
  notes: string | null;
  is_live: boolean;
  created_at: string;
};

export type Feedback = {
  id: string;
  version_id: string;
  author_key: string;
  author_name: string;
  vote: 'up' | 'down' | null;
  body: string | null;
  parent_id: string | null;
  created_at: string;
};

export type Comment = Feedback & { replies: Feedback[] };

export type VersionThread = {
  version: CreativeVersion;
  up: string[];   // reviewer names who voted up
  down: string[];
  comments: Comment[];
};

/** Pure: group a version's feedback rows into votes + top-level comments with their replies. */
export function threadFeedback(version: CreativeVersion, rows: Feedback[]): VersionThread {
  const mine = rows.filter((r) => r.version_id === version.id);
  const up: string[] = [];
  const down: string[] = [];
  const comments: Comment[] = [];
  const byId = new Map<string, Comment>();
  for (const r of mine) {
    if (r.vote && !r.body && !r.parent_id) {
      (r.vote === 'up' ? up : down).push(r.author_name);
      continue;
    }
    if (!r.body) continue;
    if (!r.parent_id) {
      const c: Comment = { ...r, replies: [] };
      byId.set(r.id, c);
      comments.push(c);
    }
  }
  for (const r of mine) {
    if (!r.body || !r.parent_id) continue;
    const parent = byId.get(r.parent_id);
    if (parent) parent.replies.push(r);
    else comments.push({ ...r, replies: [] }); // orphan reply: show it rather than drop it
  }
  const byTime = (a: { created_at: string }, b: { created_at: string }) => a.created_at.localeCompare(b.created_at);
  comments.sort(byTime);
  for (const c of comments) c.replies.sort(byTime);
  return { version, up, down, comments };
}

/** Pure: the next version number for a track. */
export function nextVersion(existing: Array<{ track: string; version: number }>, track: string): number {
  return existing.filter((v) => v.track === track).reduce((m, v) => Math.max(m, v.version), 0) + 1;
}

export async function listVersions(project: string): Promise<CreativeVersion[]> {
  const { data, error } = await supabaseAdmin
    .from('creative_versions')
    .select('*')
    .eq('project', project)
    .order('track')
    .order('version', { ascending: false })
    .limit(500);
  if (error) throw new Error(`listVersions: ${error.message}`);
  return (data ?? []) as CreativeVersion[];
}

export async function listFeedback(versionIds: string[]): Promise<Feedback[]> {
  if (!versionIds.length) return [];
  const { data, error } = await supabaseAdmin
    .from('creative_feedback')
    .select('*')
    .in('version_id', versionIds)
    .order('created_at')
    .limit(2000);
  if (error) throw new Error(`listFeedback: ${error.message}`);
  return (data ?? []) as Feedback[];
}

export async function getVersion(id: string): Promise<CreativeVersion | null> {
  const { data } = await supabaseAdmin.from('creative_versions').select('*').eq('id', id).maybeSingle();
  return (data as CreativeVersion | null) ?? null;
}

export async function addVersion(row: {
  project: string;
  track: string;
  kind: 'audio' | 'video';
  title: string;
  url: string;
  contentType?: string | null;
  durationSeconds?: number | null;
  notes?: string | null;
  transcript?: string | null;
  transcriptStatus?: CreativeVersion['transcript_status'];
  createdBy?: string | null;
}): Promise<CreativeVersion> {
  const existing = await listVersions(row.project);
  const version = nextVersion(existing, row.track);
  const { data, error } = await supabaseAdmin
    .from('creative_versions')
    .insert({
      project: row.project,
      track: row.track,
      version,
      kind: row.kind,
      title: row.title,
      url: row.url,
      content_type: row.contentType ?? null,
      duration_seconds: row.durationSeconds ?? null,
      notes: row.notes ?? null,
      transcript: row.transcript ?? null,
      transcript_status: row.transcriptStatus ?? 'pending',
      created_by: row.createdBy ?? null,
    })
    .select('*')
    .single();
  if (error) throw new Error(`addVersion: ${error.message}`);
  return data as CreativeVersion;
}

export async function setTranscript(id: string, transcript: string | null, status: CreativeVersion['transcript_status'], durationSeconds?: number | null): Promise<void> {
  const patch: Record<string, unknown> = { transcript, transcript_status: status };
  if (typeof durationSeconds === 'number') patch.duration_seconds = durationSeconds;
  await supabaseAdmin.from('creative_versions').update(patch).eq('id', id);
}

/** Mirror which take of a track the site plays: exactly one is_live per (project, track). */
export async function markLive(project: string, track: string, versionId: string): Promise<void> {
  await supabaseAdmin.from('creative_versions').update({ is_live: false }).eq('project', project).eq('track', track);
  await supabaseAdmin.from('creative_versions').update({ is_live: true }).eq('id', versionId);
}

/** A standing vote: one per reviewer per version, replaced on change, cleared with null. */
export async function setVote(versionId: string, author: { key: string; name: string }, vote: 'up' | 'down' | null): Promise<void> {
  const { error: dErr } = await supabaseAdmin
    .from('creative_feedback')
    .delete()
    .eq('version_id', versionId)
    .eq('author_key', author.key)
    .is('body', null)
    .is('parent_id', null)
    .not('vote', 'is', null);
  if (dErr) throw new Error(`setVote clear: ${dErr.message}`);
  if (!vote) return;
  const { error } = await supabaseAdmin
    .from('creative_feedback')
    .insert({ version_id: versionId, author_key: author.key, author_name: author.name, vote, body: null, parent_id: null });
  if (error) throw new Error(`setVote: ${error.message}`);
}

export async function addComment(versionId: string, author: { key: string; name: string }, body: string, parentId: string | null): Promise<Feedback> {
  const text = String(body ?? '').trim().slice(0, 4000);
  if (!text) throw new Error('empty comment');
  const { data, error } = await supabaseAdmin
    .from('creative_feedback')
    .insert({ version_id: versionId, author_key: author.key, author_name: author.name, vote: null, body: text, parent_id: parentId })
    .select('*')
    .single();
  if (error) throw new Error(`addComment: ${error.message}`);
  return data as Feedback;
}
