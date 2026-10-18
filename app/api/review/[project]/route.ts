// app/api/review/[project]/route.ts
//
// The review surface's data: GET the project's takes + threads; POST a vote, a comment or a reply.
// Identity is EITHER an admin session (the owner, who replies) OR a signed reviewer link
// (`token`, minted per person on the page) — never a name typed into the body.
import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { rateLimitOr429 } from '@/lib/api/rateLimitGuard';
import { reviewProject } from '@/lib/creative/projects';
import { verifyReviewToken, OWNER_REVIEWER, type Reviewer } from '@/lib/creative/reviewToken';
import { listVersions, listFeedback, threadFeedback, getVersion, setVote, addComment } from '@/lib/creative/versions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function identify(req: Request, project: string, tokenFromBody?: string | null): Promise<{ who: Reviewer; isOwner: boolean } | null> {
  const admin = await getAdminUser().catch(() => null);
  if (admin) return { who: OWNER_REVIEWER, isOwner: true };
  const url = new URL(req.url);
  const token = tokenFromBody || url.searchParams.get('token');
  const who = verifyReviewToken(token, project);
  return who ? { who, isOwner: false } : null;
}

export async function GET(req: Request, ctx: { params: Promise<{ project: string }> }) {
  const { project: key } = await ctx.params;
  const project = reviewProject(key);
  if (!project) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const id = await identify(req, project.key);
  if (!id) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const versions = await listVersions(project.key);
  const feedback = await listFeedback(versions.map((v) => v.id));
  return NextResponse.json({
    ok: true,
    viewer: id.who,
    isOwner: id.isOwner,
    threads: versions.map((v) => threadFeedback(v, feedback)),
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ project: string }> }) {
  const { project: key } = await ctx.params;
  const project = reviewProject(key);
  if (!project) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const limited = await rateLimitOr429(req, 'creative-review', 120, 3600);
  if (limited) return limited;
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const id = await identify(req, project.key, typeof body.token === 'string' ? body.token : null);
  if (!id) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const versionId = String(body.versionId ?? '');
  const version = versionId ? await getVersion(versionId) : null;
  if (!version || version.project !== project.key) return NextResponse.json({ error: 'version_not_found' }, { status: 404 });

  const action = String(body.action ?? '');
  if (action === 'vote') {
    const vote = body.vote === 'up' || body.vote === 'down' ? body.vote : null;
    await setVote(version.id, id.who, vote);
    return NextResponse.json({ ok: true });
  }
  if (action === 'comment') {
    const parentId = typeof body.parentId === 'string' && body.parentId ? body.parentId : null;
    try {
      const row = await addComment(version.id, id.who, String(body.body ?? ''), parentId);
      return NextResponse.json({ ok: true, comment: row });
    } catch (e: any) {
      return NextResponse.json({ error: e?.message === 'empty comment' ? 'empty' : 'failed' }, { status: 400 });
    }
  }
  return NextResponse.json({ error: 'unknown_action' }, { status: 400 });
}
