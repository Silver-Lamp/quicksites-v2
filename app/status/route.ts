// app/status/route.ts
//
// Rule 7b of the adopted config standard: a runtime panel answering **"is it actually
// live?"** from inside the running process.
//
// Rule 7 (the boot check) tells you when you weren't looking. This tells you what is true
// right now, in one request. Between them they cover the three failure modes that produced
// nine incidents across the mesh in a day:
//
//   config missing      → a gate reports `incomplete`
//   deploy stale        → `build.sha` is not the commit you just merged
//   dependency vanished → (future) the probe block; see the note at the bottom
//
// DeckSketch's case is why `build.sha` is here at all: their launcher was built correctly
// and its embed id was verifiably inlined in the shipped JS, yet it wasn't live, because
// the production domain pointed at a stale deployment. Config was right and reality wasn't,
// and no settings page could have shown that.
//
// ── PUBLIC SURFACE RULES (HJ, from shipping theirs) ─────────────────────────────────────
// Coarse by design. Per-feature ready/off/incomplete plus counts — and **never the names of
// missing keys**. A list of precisely which secrets are unset is reconnaissance, so the
// key-level detail stays behind auth (see ?detail=1 below). Rule 7's loudness must not
// become an information leak.
//
// Also NOT here: synchronous dependency probes. A public endpoint that pings OpenAI or a
// partner API on every hit is a cost/DoS amplifier — an attacker turns this page into paid
// API calls billed to us. When dependency health lands it must be cron-refreshed and read
// from cache.

import { NextResponse } from 'next/server';
import { configHealth } from '@/lib/config/health';
import { getAdminUser } from '@/lib/auth/getAdminUser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The commit actually running, so "is prod on my merge?" is one request, not a guess. */
function buildInfo() {
  return {
    sha: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ?? process.env.GIT_COMMIT_SHA?.slice(0, 8) ?? null,
    ref: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    // Resolved from the RUNTIME, never from which database we're connected to — the whole
    // point of hard rule 1 (a shared DB can't distinguish environments).
    env_scope: process.env.VERCEL_ENV ?? process.env.APP_ENV ?? process.env.NODE_ENV ?? null,
    region: process.env.VERCEL_REGION ?? null,
  };
}

export async function GET(req: Request) {
  const health = configHealth();
  const url = new URL(req.url);

  // Key-level detail is admin-only. Everyone else gets status + counts.
  const wantsDetail = url.searchParams.get('detail') === '1';
  const admin = wantsDetail ? await getAdminUser() : null;
  const detailed = wantsDetail && !!admin;

  return NextResponse.json(
    {
      ok: health.ok,
      build: buildInfo(),
      summary: { ready: health.ready, off: health.off, incomplete: health.incomplete },
      features: health.gates.map((g) => ({
        key: g.key,
        label: g.label,
        status: g.status,
        degrades: g.degradeOnly,
        // `breaks` is safe to show — it names consequences, not secrets — and it's the
        // field that makes an incomplete gate actionable rather than just red.
        ...(g.status === 'incomplete' ? { breaks: g.breaks } : {}),
        // Missing KEY NAMES are recon. Admin only.
        ...(detailed && g.missing.length ? { missing: g.missing } : {}),
      })),
      ...(wantsDetail && !admin ? { note: 'detail=1 requires an admin session; showing the public view' } : {}),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
