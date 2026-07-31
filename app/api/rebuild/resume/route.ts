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
import type { ProfileLink } from '@/lib/rebuild/importProfile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_RESUME_CHARS = 40_000; // a long CV is ~10k; 40k is generous and bounds the parse
const MAX_PARAGRAPH_CHARS = 2_000;
const uuid = () => globalThis.crypto.randomUUID();

function sanitizeLinks(raw: any): ProfileLink[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((l: any) => ({ label: String(l?.label ?? '').trim(), href: String(l?.href ?? '').trim() }))
    .filter((l) => l.href && /^(https?:\/\/|mailto:|tel:)/i.test(l.href))
    .slice(0, 12);
}

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
    return NextResponse.json(
      { error: 'That’s a lot of drafts from one place. Try again in a bit.', code: 'rate_limited' },
      { status: 429 },
    );
  }

  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  const isAnonymous = !!(user as any)?.is_anonymous;
  if (!user && !guestBuildEnabled()) {
    return NextResponse.json({ error: 'Sign in to build a site.', code: 'needs_signup' }, { status: 401 });
  }

  const { profile, template, gaps } = buildResumeSite({
    resumeText,
    sinceParagraph: String(body?.sinceParagraph ?? '').slice(0, MAX_PARAGRAPH_CHARS),
    name: body?.name ? String(body.name).slice(0, 120) : undefined,
    headline: body?.headline ? String(body.headline).slice(0, 160) : undefined,
    location: body?.location ? String(body.location).slice(0, 120) : undefined,
    email: body?.email ? String(body.email).slice(0, 160) : undefined,
    links: sanitizeLinks(body?.links),
  });

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
