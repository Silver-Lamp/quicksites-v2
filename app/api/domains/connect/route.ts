export const runtime = 'nodejs';

const API = 'https://api.vercel.com';

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
  });
  const text = await res.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  return { ok: res.ok, status: res.status, data };
}

const strip = (d: string) =>
  String(d || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\.$/, '');

export async function POST(req: Request) {
  try {
    const { domain, redirectToWWW = true } = (await req.json()) as {
      domain: string; redirectToWWW?: boolean;
    };

    const project = process.env.VERCEL_PROJECT_ID || process.env.VERCEL_PROJECT_NAME;
    if (!project) {
      return Response.json({ ok: false, error: 'Missing VERCEL_PROJECT_ID or VERCEL_PROJECT_NAME env' }, { status: 500 });
    }
    if (!process.env.VERCEL_TOKEN) {
      return Response.json({ ok: false, error: 'Missing VERCEL_TOKEN env' }, { status: 500 });
    }

    const apex = strip(domain);
    if (!apex) return Response.json({ ok: false, error: 'Domain required' }, { status: 400 });

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
      return Response.json({ ok: false, error: `Add primary failed: ${addPrimary.status}`, details: addPrimary.data }, { status: 502 });
    }

    // 2) Add redirect (idempotent)
    const addRedirect = await vfetch(`/v10/projects/${proj}/domains${qs}`, {
      method: 'POST',
      body: JSON.stringify({ name: redirectFrom, redirect: primary, redirectStatusCode: 307 }),
    });
    if (!addRedirect.ok && addRedirect.status !== 409) {
      return Response.json({ ok: false, error: `Add redirect failed: ${addRedirect.status}`, details: addRedirect.data }, { status: 502 });
    }

    // 3) Domain config helper (recommended A/CNAME)
    const cfg = await vfetch(`/v6/domains/${encodeURIComponent(apex)}/config${qs}`);
    // 404 here can happen for brand-new domains at some registrars; just omit recs if so.
    const recommended = cfg.ok ? {
      ipv4: cfg.data?.recommendedIPv4,
      cname: cfg.data?.recommendedCNAME,
    } : {};

    // 4) If Vercel requested verification challenges, surface them
    const verification = (addPrimary.data?.verification as any[]) || [];

    return Response.json({
      ok: true,
      primary,                 // e.g. www.example.com
      redirectFrom,            // e.g. example.com
      verified: addPrimary.data?.verified !== false,
      verification,
      recommended,
      next: { verifyEndpoint: '/api/domains/verify', method: 'POST', body: { domain: primary } },
    });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || 'Unexpected error' }, { status: 500 });
  }
}
