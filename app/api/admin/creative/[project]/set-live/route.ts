// app/api/admin/creative/[project]/set-live/route.ts
//
// Make one take the one the client's site plays: swap the matching `audio`/`video` block's URL in
// EVERY copy of the template tree (§8: blocks + content_blocks, content + props), commit through
// the RPC, republish BOTH served snapshots, and mirror `is_live` on the version rows. Replaces
// the scratch script that did this by hand for the first regenerated jingle.
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireUser';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { commitTemplatePatch } from '@/lib/templates/commitTemplatePatch';
import { republishIfPublished } from '@/lib/templates/republishIfPublished';
import { reviewProject } from '@/lib/creative/projects';
import { getVersion, listVersions, markLive } from '@/lib/creative/versions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function fmtDuration(s: number | null): string | null {
  if (typeof s !== 'number' || !Number.isFinite(s) || s <= 0) return null;
  return `${Math.round(s)} s`;
}

export async function POST(req: Request, ctx: { params: Promise<{ project: string }> }) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;
  const admin = gate as { id?: string };
  const { project: key } = await ctx.params;
  const project = reviewProject(key);
  if (!project) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const version = await getVersion(String(body?.versionId ?? ''));
  if (!version || version.project !== project.key) return NextResponse.json({ error: 'version_not_found' }, { status: 404 });
  const track = project.tracks.find((t) => t.key === version.track);
  const all = await listVersions(project.key);
  const currentLive = all.find((v) => v.track === version.track && v.is_live) ?? null;

  const { data: row, error } = await supabaseAdmin.from('templates').select('id, rev, data').eq('slug', project.templateSlug).single();
  if (error || !row) return NextResponse.json({ error: 'template_not_found' }, { status: 404 });
  const d: any = structuredClone((row as any).data);
  const blockType = version.kind === 'audio' ? 'audio' : 'video';
  const urlKey = version.kind === 'audio' ? 'url' : 'video_url';
  const matches = (c: any) =>
    !!c && ((currentLive && c[urlKey] === currentLive.url) || (!currentLive && track?.blockTitle && c.title === track.blockTitle));
  let swapped = 0;
  for (const page of d.pages ?? []) {
    for (const listKey of ['blocks', 'content_blocks']) {
      for (const b of page[listKey] ?? []) {
        if (b?.type !== blockType) continue;
        for (const holder of ['content', 'props']) {
          const c = b[holder];
          if (!matches(c)) continue;
          c[urlKey] = version.url;
          if (version.kind === 'audio') {
            const dur = fmtDuration(version.duration_seconds);
            c.caption = dur ? `Ad jingle · ${dur}` : c.caption;
          }
          swapped++;
        }
      }
    }
  }
  if (!swapped) {
    return NextResponse.json(
      { error: 'no_block_for_track', hint: `No ${blockType} block on ${project.templateSlug} matched this track (live URL or title "${track?.blockTitle ?? ''}"). Add the block in the editor once; after that the swap matches on the live take.` },
      { status: 409 },
    );
  }
  const cErr = await commitTemplatePatch((row as any).id, (row as any).rev ?? 0, { data: d }, admin.id ?? null);
  if (cErr) return NextResponse.json({ error: 'commit_failed', detail: cErr }, { status: 502 });
  const pub = await republishIfPublished((row as any).id);
  await markLive(project.key, version.track, version.id);
  return NextResponse.json({ ok: true, swapped, republished: pub.republished, warning: pub.warning ?? null });
}
