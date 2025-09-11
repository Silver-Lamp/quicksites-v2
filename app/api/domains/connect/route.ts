export const runtime = 'nodejs';

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

const strip = (d: string) =>
  String(d || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\.$/, '');

export async function POST(req: Request) {
  try {
    const { domain, redirectToWWW = true /*, autoConfigure = false*/ } = (await req.json()) as {
      domain: string;
      redirectToWWW?: boolean;
      // autoConfigure?: boolean; // enable when wiring Namecheap fast-path
    };

    const project = process.env.VERCEL_PROJECT_ID || process.env.VERCEL_PROJECT_NAME;
    if (!project) {
      return Response.json(
        { ok: false, error: 'Missing VERCEL_PROJECT_ID or VERCEL_PROJECT_NAME env' },
        { status: 500 }
      );
    }
    if (!process.env.VERCEL_TOKEN) {
      return Response.json({ ok: false, error: 'Missing VERCEL_TOKEN env' }, { status: 500 });
    }

    const apex = strip(domain);
    if (!apex) return Response.json({ ok: false, error: 'Domain required' }, { status: 400 });
    if (!DOMAIN_RX.test(apex)) {
      return Response.json(
        { ok: false, error: 'Enter a valid domain like example.com (no https://, no paths).' },
        { status: 400 }
      );
    }

    const primary = redirectToWWW ? `www.${apex}` : apex;
    const redirectFrom = redirectToWWW ? apex : `www.${apex}`;
    const qs = teamQS();
    const proj = encodeURIComponent(project);

    // 1) Add primary (idempotent: accept 409 conflict as success)
    const addPrimary = await vfetch(`/v10/projects/${proj}/domains${qs}`, {
      method: 'POST',
      body: JSON.stringify({ name: primary }),
    });
    if (!addPrimary.ok && addPrimary.status !== 409) {
      const msg = addPrimary.data?.error?.message || addPrimary.data?.message || `Add primary failed`;
      return Response.json(
        { ok: false, error: `${msg}: ${addPrimary.status}`, details: addPrimary.data },
        { status: 502 }
      );
    }

    // 2) Add redirect (idempotent)
    const addRedirect = await vfetch(`/v10/projects/${proj}/domains${qs}`, {
      method: 'POST',
      body: JSON.stringify({ name: redirectFrom, redirect: primary, redirectStatusCode: 307 }),
    });
    if (!addRedirect.ok && addRedirect.status !== 409) {
      const msg = addRedirect.data?.error?.message || addRedirect.data?.message || `Add redirect failed`;
      return Response.json(
        { ok: false, error: `${msg}: ${addRedirect.status}`, details: addRedirect.data },
        { status: 502 }
      );
    }

    // 3) Domain config helper (recommended A/CNAME). 404 is fine for brand-new domains.
    const cfg = await vfetch(`/v6/domains/${encodeURIComponent(apex)}/config${qs}`);
    // Normalize recommendations to arrays with sane fallbacks
    const recommended = {
      ipv4: Array.isArray(cfg.data?.recommendedIPv4) && cfg.data?.recommendedIPv4.length
        ? cfg.data.recommendedIPv4
        : (cfg.data?.recommendedIPv4 ? [cfg.data.recommendedIPv4] : DEFAULT_A_IPS),
      cname: Array.isArray(cfg.data?.recommendedCNAME) && cfg.data?.recommendedCNAME.length
        ? cfg.data.recommendedCNAME
        : (cfg.data?.recommendedCNAME ? [cfg.data.recommendedCNAME] : DEFAULT_CNAME_TARGETS),
    };

    // 4) If Vercel requested verification challenges, surface them
    const verification = (addPrimary.data?.verification as any[]) || [];

    // 5) (Optional) Auto-apply DNS at Namecheap (when you wire the helper)
    // if (autoConfigure) {
    //   try {
    //     const mod = await import('@/lib/domains/namecheap');
    //     if (mod?.tryApplyNamecheapApexAndWWW) {
    //       await mod.tryApplyNamecheapApexAndWWW(apex, recommended.ipv4, recommended.cname[0]);
    //     }
    //   } catch (err) {
    //     console.warn('Namecheap auto-config skipped:', (err as Error)?.message);
    //   }
    // }

    return Response.json({
      ok: true,
      primary,                 // e.g. www.example.com
      redirectFrom,            // e.g. example.com
      verified: addPrimary.data?.verified === true,
      verification,
      recommended,             // { ipv4: string[], cname: string[] }
      next: { verifyEndpoint: '/api/domains/verify', method: 'POST', body: { domain: primary } },
    });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || 'Unexpected error' }, { status: 500 });
  }
}
