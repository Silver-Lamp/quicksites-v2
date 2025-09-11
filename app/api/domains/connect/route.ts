// app/api/domains/connect/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { Resolver } from 'dns/promises';

const API = 'https://api.vercel.com';
const DEFAULT_A_IPS = ['76.76.21.21'];
const DEFAULT_CNAME_TARGETS = ['cname.vercel-dns.com'];
const DOMAIN_RX = /^([a-z0-9-]+\.)+[a-z]{2,}$/i;

function teamQS() {
  const qs = new URLSearchParams();
  if (process.env.VERCEL_TEAM_ID) qs.set('teamId', process.env.VERCEL_TEAM_ID);
  return qs.toString() ? `?${qs.toString()}` : '';
}

// Safe fetch that never throws and always returns JSON
async function vfetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.VERCEL_TOKEN!}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
    cache: 'no-store',
  });
  const text = await res.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  return { ok: res.ok, status: res.status, data };
}

function normalizeApex(input: string) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '') // strip protocol
    .replace(/\/.*$/, '')        // strip any path
    .replace(/^www\./, '')       // strip www
    .replace(/\.$/, '');         // strip trailing dot
}

async function detectIsNamecheap(apex: string): Promise<boolean> {
  try {
    const r = new Resolver();
    // public resolvers reduce local cache weirdness
    r.setServers(['1.1.1.1', '8.8.8.8']);
    const nss = await r.resolveNs(apex);
    const lower = nss.map((s) => s.toLowerCase());
    // Common Namecheap NS:
    // dns1.registrar-servers.com / dns2.registrar-servers.com
    // (also covers some legacy namecheaphosting domains)
    return lower.some(
      (ns) => ns.endsWith('registrar-servers.com') || ns.includes('namecheap')
    );
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const {
      domain,
      redirectToWWW = true,
      autoConfigure = false,
      wildcard = false,
    } = (await req.json()) as {
      domain: string;
      redirectToWWW?: boolean;
      autoConfigure?: boolean | 'detect';
      wildcard?: boolean; // NEW
    };

    const project =
      process.env.VERCEL_PROJECT_ID || process.env.VERCEL_PROJECT_NAME;
    if (!project) {
      return NextResponse.json(
        { ok: false, error: 'Missing VERCEL_PROJECT_ID or VERCEL_PROJECT_NAME env' },
        { status: 500 }
      );
    }
    if (!process.env.VERCEL_TOKEN) {
      return NextResponse.json(
        { ok: false, error: 'Missing VERCEL_TOKEN env' },
        { status: 500 }
      );
    }

    const apex = normalizeApex(domain);
    if (!apex)
      return NextResponse.json(
        { ok: false, error: 'Domain required' },
        { status: 400 }
      );
    if (!DOMAIN_RX.test(apex)) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Enter a valid apex like example.com (no https://, no paths).',
        },
        { status: 400 }
      );
    }

    const primary = redirectToWWW ? `www.${apex}` : apex;
    const redirectFrom = redirectToWWW ? apex : `www.${apex}`;
    const qs = teamQS();
    const proj = encodeURIComponent(project);

    // 1) Attach primary host (idempotent)
    const addPrimary = await vfetch(`/v10/projects/${proj}/domains${qs}`, {
      method: 'POST',
      body: JSON.stringify({ name: primary }),
    });
    if (!addPrimary.ok && addPrimary.status !== 409) {
      const msg =
        addPrimary.data?.error?.message ||
        addPrimary.data?.message ||
        `Add primary failed`;
      return NextResponse.json(
        { ok: false, error: `${msg}: ${addPrimary.status}`, details: addPrimary.data },
        { status: 502 }
      );
    }

    // 2) Attach redirect host (idempotent)
    const addRedirect = await vfetch(`/v10/projects/${proj}/domains${qs}`, {
      method: 'POST',
      body: JSON.stringify({
        name: redirectFrom,
        redirect: primary,
        redirectStatusCode: 307,
      }),
    });
    if (!addRedirect.ok && addRedirect.status !== 409) {
      const msg =
        addRedirect.data?.error?.message ||
        addRedirect.data?.message ||
        `Add redirect failed`;
      return NextResponse.json(
        { ok: false, error: `${msg}: ${addRedirect.status}`, details: addRedirect.data },
        { status: 502 }
      );
    }

    // 2.5) (NEW) Optionally attach wildcard *.apex (idempotent)
    let wildcardAttached = false;
    if (wildcard) {
      const addWildcard = await vfetch(`/v10/projects/${proj}/domains${qs}`, {
        method: 'POST',
        body: JSON.stringify({ name: `*.${apex}` }),
      });
      if (addWildcard.ok || addWildcard.status === 409) {
        wildcardAttached = true;
      } else {
        // Non-fatal; include diagnostics in response
        console.warn('Wildcard attach failed', addWildcard.status, addWildcard.data);
      }
    }

    // 3) Recommendations (useful fallbacks even if API can’t provide)
    const cfg = await vfetch(
      `/v6/domains/${encodeURIComponent(apex)}/config${qs}`
    );
    const recommended = {
      ipv4:
        Array.isArray(cfg.data?.recommendedIPv4) &&
        cfg.data?.recommendedIPv4.length
          ? cfg.data.recommendedIPv4
          : cfg.data?.recommendedIPv4
          ? [cfg.data.recommendedIPv4]
          : DEFAULT_A_IPS,
      cname:
        Array.isArray(cfg.data?.recommendedCNAME) &&
        cfg.data?.recommendedCNAME.length
          ? cfg.data.recommendedCNAME
          : cfg.data?.recommendedCNAME
          ? [cfg.data.recommendedCNAME]
          : DEFAULT_CNAME_TARGETS,
      // Optional hint for UI when wildcard was requested
      ...(wildcard ? { wildcardCNAME: 'cname.vercel-dns.com' } : {}),
    };

    // 4) Optional auto-configuration (Namecheap only; guarded)
    let autoConfigured:
      | { provider: 'namecheap'; applied: boolean; reason?: string }
      | undefined;

    if (autoConfigure) {
      const shouldTryNamecheap =
        autoConfigure === true ? true : await detectIsNamecheap(apex);

      if (shouldTryNamecheap) {
        try {
          // dynamic import so the route doesn’t hard-crash if file/env missing
          const mod = await import('@/lib/namecheap/verifyAndConfigureDomain');
          const txtToken = process.env.QS_DOMAIN_TXT_TOKEN || 'quicksites';
          await mod.verifyAndConfigureDomain(apex, {
            aIps: recommended.ipv4,
            cnameTarget: recommended.cname[0],
            txtToken,
            ttl: '300',
            // NOTE: the helper you installed sets @, www and _verify.
            // If you want it to also set "*", extend that helper accordingly.
          });
          autoConfigured = { provider: 'namecheap', applied: true };
        } catch (err: any) {
          autoConfigured = {
            provider: 'namecheap',
            applied: false,
            reason:
              err?.message ||
              'Namecheap module/env not configured or API call failed',
          };
          // Non-fatal — manual instructions below still work.
          console.warn('Namecheap auto-config error:', err);
        }
      } else {
        autoConfigured = {
          provider: 'namecheap',
          applied: false,
          reason: 'Provider not detected for this domain',
        };
      }
    }

    // 5) Vercel verification hints (TXT/CNAME) if any
    const verification = (addPrimary.data?.verification as any[]) || [];

    return NextResponse.json({
      ok: true,
      primary, // e.g. www.example.com
      redirectFrom, // e.g. example.com
      verified: addPrimary.data?.verified === true,
      verification,
      recommended, // { ipv4: string[], cname: string[], wildcardCNAME?: string }
      autoConfigured, // optional diagnostics
      wildcard: { requested: !!wildcard, attached: wildcardAttached }, // NEW
      next: {
        verifyEndpoint: '/api/domains/verify',
        method: 'POST',
        body: { domain: primary },
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || 'connect failed' },
      { status: 500 }
    );
  }
}
