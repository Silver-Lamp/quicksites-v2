// app/api/domains/preflight/route.ts
//
// Admin-gated readiness check for the self-serve domain buy flow. Validates the
// Vercel token + team + project access + domains-API reachability + registrant
// contact + the register flag, so a misconfigured token is caught here instead
// of at a money-spending "Buy" click. Read-only — never registers anything.
//
// It cannot verify a payment method is on file (Vercel exposes no clean API for
// that), so it returns a `billingReminder` the UI surfaces as a manual step.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { readRegistrantContact } from '@/lib/domains/registrar';

const VERCEL_API = 'https://api.vercel.com';

function withTeam(path: string): string {
  const teamId = process.env.VERCEL_TEAM_ID;
  if (!teamId) return `${VERCEL_API}${path}`;
  const sep = path.includes('?') ? '&' : '?';
  return `${VERCEL_API}${path}${sep}teamId=${encodeURIComponent(teamId)}`;
}

type Check = { ok: boolean; detail: string };

async function vfetch(path: string): Promise<{ ok: boolean; status: number; data: any }> {
  const res = await fetch(withTeam(path), {
    headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` },
    cache: 'no-store',
  });
  const text = await res.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  return { ok: res.ok, status: res.status, data };
}

export async function GET() {
  if (!(await getAdminUser())) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const checks: Record<string, Check> = {};

  // 1) Token present + valid (identify the authed user/team).
  if (!process.env.VERCEL_TOKEN) {
    checks.token = { ok: false, detail: 'VERCEL_TOKEN is not set.' };
  } else {
    const who = await vfetch('/v2/user');
    checks.token = who.ok
      ? { ok: true, detail: `Valid token for ${who.data?.user?.username || who.data?.user?.email || 'account'}.` }
      : { ok: false, detail: `Token rejected (${who.status}). Create a write-scoped token at Vercel → Account Settings → Tokens.` };
  }

  // 2) Team resolution (informational).
  checks.team = process.env.VERCEL_TEAM_ID
    ? { ok: true, detail: `Scoped to team ${process.env.VERCEL_TEAM_ID}.` }
    : { ok: true, detail: 'Personal account (no VERCEL_TEAM_ID).' };

  // 3) Project access — proves the token can see the project it will attach to.
  const project = process.env.VERCEL_PROJECT_ID || process.env.VERCEL_PROJECT_NAME;
  if (!project) {
    checks.projectAccess = { ok: false, detail: 'Missing VERCEL_PROJECT_ID / VERCEL_PROJECT_NAME.' };
  } else if (checks.token.ok) {
    const proj = await vfetch(`/v9/projects/${encodeURIComponent(project)}`);
    checks.projectAccess = proj.ok
      ? { ok: true, detail: `Can access project "${proj.data?.name || project}".` }
      : { ok: false, detail: `Cannot access project (${proj.status}). Check the token's team scope.` };
  } else {
    checks.projectAccess = { ok: false, detail: 'Skipped — fix the token first.' };
  }

  // 4) Registrar API reachable — an availability lookup on a known-registered name should
  //    return available:false. Uses the NEW registrar API (the /v4/domains/* endpoints were
  //    sunsetted 2025-11-09). If this call itself fails, the buy path would hit the same error.
  if (checks.token.ok) {
    const status = await vfetch('/v1/registrar/domains/example.com/availability');
    checks.domainsApi = status.ok
      ? { ok: true, detail: 'Registrar API reachable with this token.' }
      : { ok: false, detail: `Registrar API call failed (${status.status}). ${status.data?.error?.message || status.data?.message || 'The token may lack domain permissions.'}` };
  } else {
    checks.domainsApi = { ok: false, detail: 'Skipped — fix the token first.' };
  }

  // 5) Registrant contact (required for buy).
  const registrant = readRegistrantContact();
  checks.registrantContact = registrant.ok
    ? { ok: true, detail: 'Registrant contact is complete.' }
    : { ok: false, detail: `Missing: ${registrant.missing.join(', ')}.` };

  // 6) The register kill-switch.
  const registerEnabled =
    process.env.VERCEL_DOMAIN_REGISTER_ENABLED === '1' ||
    process.env.VERCEL_DOMAIN_REGISTER_ENABLED === 'true';
  checks.registerFlag = registerEnabled
    ? { ok: true, detail: 'VERCEL_DOMAIN_REGISTER_ENABLED is on.' }
    : { ok: false, detail: 'VERCEL_DOMAIN_REGISTER_ENABLED is off (buying is blocked).' };

  const ready = Object.values(checks).every((c) => c.ok);

  return NextResponse.json({
    ok: true,
    ready,
    checks,
    billingReminder:
      'A valid payment method must be on the Vercel account/team (Settings → Billing) — the buy charges it and cannot be verified here.',
  });
}
