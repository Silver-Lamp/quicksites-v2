export const runtime = 'nodejs';

const API = 'https://api.vercel.com';
const DOMAIN_RX = /^([a-z0-9-]+\.)+[a-z]{2,}$/i;

function teamQS() {
  const qs = new URLSearchParams();
  if (process.env.VERCEL_TEAM_ID) qs.set('teamId', process.env.VERCEL_TEAM_ID);
  return qs.toString() ? `?${qs.toString()}` : '';
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

async function delDomain(project: string, host: string, qs: string) {
  const res = await fetch(
    `${API}/v10/projects/${encodeURIComponent(project)}/domains/${encodeURIComponent(host)}${qs}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN!}` },
      cache: 'no-store',
    }
  );

  // Treat 404 (not attached) as success for idempotency
  if (!res.ok && res.status !== 404) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Failed to remove ${host}: ${res.status} ${res.statusText} ${txt.slice(0, 200)}`);
  }
  return res.status; // 200/204/404 typical
}

export async function POST(req: Request) {
  try {
    const { domain } = (await req.json()) as { domain: string }; // expects apex (e.g., example.com)

    if (!process.env.VERCEL_TOKEN) {
      return Response.json({ ok: false, error: 'Missing VERCEL_TOKEN env' }, { status: 500 });
    }
    const project = process.env.VERCEL_PROJECT_ID || process.env.VERCEL_PROJECT_NAME;
    if (!project) {
      return Response.json(
        { ok: false, error: 'Missing VERCEL_PROJECT_ID or VERCEL_PROJECT_NAME env' },
        { status: 500 }
      );
    }

    const apex = normalizeApex(domain);
    if (!apex) return Response.json({ ok: false, error: 'Missing domain' }, { status: 400 });
    if (!DOMAIN_RX.test(apex)) {
      return Response.json(
        { ok: false, error: 'Enter a valid apex domain like example.com (no https://).' },
        { status: 400 }
      );
    }

    const qs = teamQS();
    const targets = [apex, `www.${apex}`];

    const results = await Promise.allSettled(targets.map((h) => delDomain(project, h, qs)));
    const removed: Record<string, number | string> = {};
    results.forEach((r, i) => {
      const host = targets[i];
      removed[host] = r.status === 'fulfilled' ? r.value : (r.reason as Error)?.message || 'error';
    });

    const ok = results.every((r) => r.status === 'fulfilled');
    return Response.json({ ok, removed });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || 'Remove failed' }, { status: 500 });
  }
}
