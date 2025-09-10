export const runtime = 'nodejs';

const API = 'https://api.vercel.com';

function q(teamId?: string, teamSlug?: string) {
  const p = new URLSearchParams();
  if (teamId) p.set('teamId', teamId);
  if (teamSlug) p.set('slug', teamSlug);
  const s = p.toString();
  return s ? `?${s}` : '';
}

async function delDomain(projectId: string, d: string, teamId?: string, teamSlug?: string) {
  const res = await fetch(
    `${API}/v9/projects/${projectId}/domains/${encodeURIComponent(d)}${q(teamId, teamSlug)}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN!}` } }
  );
  // Treat 404 as success (idempotent)
  if (!res.ok && res.status !== 404) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Failed to remove ${d}: ${res.status} ${res.statusText} ${txt}`);
  }
  return res.status;
}

export async function POST(req: Request) {
  const { domain } = (await req.json()) as { domain: string }; // expects apex (e.g., example.com)
  const apex = String(domain || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\.$/, '');
  if (!apex) return new Response(JSON.stringify({ ok: false, error: 'Missing domain' }), { status: 400 });

  const projectId = process.env.VERCEL_PROJECT_ID!;
  const teamId = process.env.VERCEL_TEAM_ID;
  const teamSlug = process.env.VERCEL_TEAM_SLUG;

  const targets = [apex, `www.${apex}`];
  const results: Record<string, number> = {};

  try {
    for (const d of targets) {
      results[d] = await delDomain(projectId, d, teamId, teamSlug);
    }
    return new Response(JSON.stringify({ ok: true, removed: results }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || 'Remove failed' }), { status: 500 });
  }
}
