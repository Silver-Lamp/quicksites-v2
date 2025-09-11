export const runtime = 'nodejs';

const API = 'https://api.vercel.com';
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

function sanitizeHost(input: string) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\.$/, '');
}

export async function POST(req: Request) {
  try {
    const { domain } = (await req.json()) as { domain: string }; // e.g. "www.example.com"
    const project = process.env.VERCEL_PROJECT_ID || process.env.VERCEL_PROJECT_NAME;

    if (!process.env.VERCEL_TOKEN) {
      return Response.json({ ok: false, error: 'Missing VERCEL_TOKEN env' }, { status: 500 });
    }
    if (!project) {
      return Response.json({ ok: false, error: 'Missing VERCEL_PROJECT_ID or VERCEL_PROJECT_NAME env' }, { status: 500 });
    }

    const host = sanitizeHost(domain);
    if (!host) return Response.json({ ok: false, error: 'Domain required' }, { status: 400 });
    if (!DOMAIN_RX.test(host)) {
      return Response.json({ ok: false, error: 'Enter a valid domain like www.example.com (no https://).' }, { status: 400 });
    }

    const proj = encodeURIComponent(project);
    const qs = teamQS();

    // Verify the provided host (usually "www.example.com")
    const primaryVerify = await vfetch(
      `/v9/projects/${proj}/domains/${encodeURIComponent(host)}/verify${qs}`,
      { method: 'POST' }
    );
    if (!primaryVerify.ok) {
      return Response.json(
        { ok: false, error: 'Verify failed', details: primaryVerify.data },
        { status: 502 }
      );
    }

    // Optionally also verify apex if the caller passed "www.foo.com"
    const apex = host.replace(/^www\./, '');
    let apexVerified: boolean | undefined = undefined;
    if (apex !== host) {
      const apexRes = await vfetch(
        `/v9/projects/${proj}/domains/${encodeURIComponent(apex)}/verify${qs}`,
        { method: 'POST' }
      );
      // Non-OK here isn’t fatal; we just surface it in details
      apexVerified = apexRes.ok ? !!apexRes.data?.verified : false;
    }

    const verified = !!primaryVerify.data?.verified;

    return Response.json({
      ok: true,
      verified,
      // Optional debug payload — safe to ignore in UI
      details: {
        primary: host,
        primaryVerified: verified,
        apex: apex === host ? undefined : apex,
        apexVerified,
      },
    });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || 'Unexpected error' }, { status: 500 });
  }
}
