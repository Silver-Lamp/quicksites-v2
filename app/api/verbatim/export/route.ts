// app/api/verbatim/export/route.ts
//
// Résumé text in, ONE self-contained HTML file out. No account, no draft row, no database.
//
// ⚠️ THIS ROUTE DELIBERATELY WRITES NOTHING. That is the feature, not an omission. The whole
// argument for putting Verbatim in front of library patrons is that they leave with something
// that is theirs and survives us; a version that required us to store their employment history
// first would be the dependency it claims not to be. Parsing is deterministic (see
// lib/rebuild/importResume.ts), so the same text always yields the same file and there is
// nothing worth persisting.
//
// It also means this path has no insert to rate-limit — which matters more than it looks. The
// draft-creating route is capped per IP, and a library runs every patron through one NAT address,
// so a room of a dozen people would hit that cap. Everyone can always get their file.
import { NextResponse } from 'next/server';
import { buildResumeSite } from '@/lib/rebuild/buildResumeSite';
import { exportProfileHtml, exportFilename } from '@/lib/verbatim/exportProfile';
import { resumeIntakeFromBody, resumeTooShort } from '@/lib/rebuild/resumeIntakeFromBody';
import { checkRateLimit, clientIp } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as any));
  const intake = resumeIntakeFromBody(body);

  if (resumeTooShort(intake)) {
    return NextResponse.json(
      { error: 'Paste your résumé text to get started.', code: 'resume_too_short' },
      { status: 400 },
    );
  }

  // A generous cap purely against someone hammering the parser — an order of magnitude above the
  // draft limit, because nothing here is created and the cost is CPU on text the caller supplied.
  // ⚠️ Do NOT tighten this to match the draft route's per-IP limit: the shared-IP case (a library,
  // a school, a co-working space) is exactly who this endpoint is for.
  const limited = await checkRateLimit(`verbatim_export:${clientIp(req)}`, 120, 3600).catch(
    () => ({ ok: true } as any),
  );
  if (!limited?.ok) {
    return NextResponse.json({ error: 'Too many requests — try again shortly.' }, { status: 429 });
  }

  const { profile, gaps } = buildResumeSite(intake);

  return new NextResponse(exportProfileHtml(profile, gaps), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="${exportFilename(profile.name)}"`,
      // Someone's employment history: never cached by an intermediary.
      'Cache-Control': 'no-store, private',
    },
  });
}
