// app/api/rebuild/resume/route.ts
//
// "Paste your résumé, walk out with an About-Me site." A second front door onto the pipeline
// /api/rebuild already uses — the difference is only where the ProfileSpec comes from.
//
//   URL path:    scrapeSite → profileFromScrape ─┐
//   RÉSUMÉ path: profileFromResume ──────────────┴→ rebuildSpecFromProfile
//                                                   → buildRebuildTemplate → insert
//
// ⚠️ NO AI CALL, SO NO AI GATE. /api/rebuild spends a metered LLM call to infer a spec from a
// stranger's marketing site. This parses text the person pasted about themselves, so there is
// nothing to infer and nothing to meter — and, more to the point, a CV is a factual claim about
// someone's employment. A model that "tidies" a job history invents one. The per-IP draft limit
// still applies, because inserting rows is the thing worth rate-limiting.
//
// Guest-friendly on purpose, matching /build: someone should be able to try this without an
// account, and the draft auto-claims when they sign up (same uid → owner_id).
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSupabase } from '@/lib/supabase/server';
import { checkRateLimit, clientIp } from '@/lib/rateLimit';
import { guestBuildEnabled } from '@/lib/flags/guestBuild';
import { buildResumeSite } from '@/lib/rebuild/buildResumeSite';
import { resumeIntakeFromBody, MAX_RESUME_CHARS } from '@/lib/rebuild/resumeIntakeFromBody';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const uuid = () => globalThis.crypto.randomUUID();

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as any));

  const resumeText = String(body?.resumeText ?? '').slice(0, MAX_RESUME_CHARS);
  if (resumeText.trim().length < 40) {
    return NextResponse.json(
      { error: 'Paste your résumé text to get started.', code: 'resume_too_short' },
      { status: 400 },
    );
  }

  // Rate limit on the thing that costs us: inserted rows.
  const ip = clientIp(req);
  const limited = await checkRateLimit(
    `resume_draft:${ip}`,
    Number(process.env.GUEST_DRAFT_HOURLY_LIMIT_PER_IP || 10),
    3600,
  ).catch(() => ({ ok: true } as any));
  if (!limited?.ok) {
    // ⚠️ A SHARED IP IS NOT AN ATTACKER, AND THIS IS THE CASE THAT WILL ACTUALLY HAPPEN. The cap
    // is per-IP and a library, school or co-working space NATs everyone behind one address — so a
    // room of a dozen people doing this together trips it, and the eleventh person sees a wall in
    // front of the librarian whose trust is the entire reason we are in the room.
    //
    // The cap stays (inserted rows are the thing worth limiting), but the person is not sent away
    // empty-handed: /api/verbatim/export creates nothing, so it is always available, and the file
    // is the part that was theirs to keep anyway.
    return NextResponse.json(
      {
        error:
          'A lot of sites have been started from this connection — which happens when everyone is on the same wifi. You can still download your page below and make a site later.',
        code: 'rate_limited',
        exportAvailable: true,
      },
      { status: 429 },
    );
  }

  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  const isAnonymous = !!(user as any)?.is_anonymous;
  if (!user && !guestBuildEnabled()) {
    return NextResponse.json({ error: 'Sign in to build a site.', code: 'needs_signup' }, { status: 401 });
  }

  // ⚠️ Shared with /api/verbatim/export — same body, same parse, same caps. Two front doors onto
  // one parser that read the body separately would eventually disagree about the same paste.
  const { profile, template, gaps } = buildResumeSite(resumeIntakeFromBody(body));

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  let insertedId: string | null = null;
  let slug = template.slug;
  for (let attempt = 0; attempt < 3 && !insertedId; attempt++) {
    const { data, error } = await admin
      .from('templates')
      .insert({
        id: uuid(),
        template_name: attempt === 0 ? template.template_name : `${template.template_name} ${attempt + 1}`,
        slug,
        data: template.data,
        color_mode: template.color_mode,
        header_block: template.header_block,
        footer_block: template.footer_block,
        is_site: false,
        industry: template.industry,
        business_name: template.business_name,
        owner_id: user?.id ?? null,
        claim_source: isAnonymous ? 'guest_build' : 'resume_import',
      } as any)
      .select('id, slug')
      .single();
    if (!error && data) {
      insertedId = (data as any).id;
      slug = (data as any).slug;
      break;
    }
    if (error && `${error.code}` === '23505') {
      slug = `${template.slug}-${Math.random().toString(36).slice(2, 5)}`;
      continue;
    }
    return NextResponse.json(
      { error: error?.message || 'Could not save the draft.', code: 'insert_failed' },
      { status: 500 },
    );
  }
  if (!insertedId) {
    return NextResponse.json({ error: 'Could not allocate a unique draft.', code: 'insert_failed' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    id: insertedId,
    slug,
    editorUrl: `/admin/templates/${insertedId}`,
    // ⚠️ `gaps` is returned so the UI can say what the résumé did NOT contain. A parser that
    // reports only what it found lets someone publish a page missing their own name without
    // noticing. Telling them beats guessing for them.
    gaps,
    read: {
      name: profile.name,
      skills: profile.skills?.length ?? 0,
      roles: profile.experience?.length ?? 0,
      links: profile.links.length,
    },
  });
}
