export const runtime = 'nodejs';

const API = 'https://api.vercel.com';

function teamQS() {
  const qs = new URLSearchParams();
  if (process.env.VERCEL_TEAM_ID) qs.set('teamId', process.env.VERCEL_TEAM_ID);
  return qs.toString() ? `?${qs.toString()}` : '';
}

async function vfetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN!}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  const text = await res.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  return { ok: res.ok, status: res.status, data };
}

export async function POST(req: Request) {
  try {
    const { domain } = (await req.json()) as { domain: string }; // e.g. www.example.com
    const project = process.env.VERCEL_PROJECT_ID || process.env.VERCEL_PROJECT_NAME;
    if (!project) return Response.json({ ok: false, error: 'Missing project env' }, { status: 500 });

    const proj = encodeURIComponent(project);
    const qs = teamQS();

    const res = await vfetch(`/v9/projects/${proj}/domains/${encodeURIComponent(domain)}/verify${qs}`, { method: 'POST' });
    if (!res.ok) return Response.json({ ok: false, error: 'Verify failed', details: res.data }, { status: 502 });

    return Response.json({ ok: true, verified: !!res.data?.verified });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || 'Unexpected error' }, { status: 500 });
  }
}
