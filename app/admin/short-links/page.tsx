// app/admin/short-links/page.tsx
// Server-rendered admin table for short links with 30-day scan counts.
// Uses your getServerSupabase({ serviceRole: true }) helper.

import Link from "next/link";
import { getServerSupabase } from "@/lib/supabase/server";
import CopyButtons from "components/admin/CopyButtons";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function hostPath(u: string) {
  try {
    const x = new URL(u);
    return (x.host + x.pathname).replace(/\/$/, "");
  } catch {
    return u;
  }
}

async function getData() {
  const supabase = await getServerSupabase({ serviceRole: true });

  // Recent links (tweak limit as needed)
  const { data: links, error: linksErr } = await supabase
    .from("short_links")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (linksErr) throw linksErr;

  // Last 30 days of scans
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const { data: scans, error: scansErr } = await supabase
    .from("short_scans")
    .select("code, ts")
    .gte("ts", since);
  if (scansErr) throw scansErr;

  const counts = new Map<string, number>();
  for (const s of scans || []) {
    counts.set(s.code, (counts.get(s.code) || 0) + 1);
  }

  return { links: links || [], counts };
}

export default async function ShortLinksAdminPage() {
  const { links, counts } = await getData();
  const base = process.env.PUBLIC_BASE_URL || "http://localhost:3000";

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Short Links</h1>
          <p className="mt-1 text-sm text-gray-600">
            Last {links.length} links. Scan counts aggregated over the past 30 days.
          </p>
        </div>
        <Link href="/admin" className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50">
          ← Admin
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border">
        <table className="min-w-[880px] w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Code</th>
              <th className="px-3 py-2 text-left font-semibold">Short URL</th>
              <th className="px-3 py-2 text-left font-semibold">Target</th>
              <th className="px-3 py-2 text-left font-semibold">Candidate</th>
              <th className="px-3 py-2 text-right font-semibold">Scans (30d)</th>
              <th className="px-3 py-2 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {links.map((l: any) => {
              const shortUrl = `${base}/c/${l.code}`;
              const scanCount = counts.get(l.code) || 0;
              return (
                <tr key={l.id} className="border-t">
                  <td className="px-3 py-2 font-mono">{l.code}</td>
                  <td className="px-3 py-2">
                    <a href={shortUrl} target="_blank" className="text-indigo-600 hover:underline">
                      {hostPath(shortUrl)}
                    </a>
                  </td>
                  <td className="px-3 py-2 max-w-[420px] truncate" title={l.target_url}>
                    <a href={l.target_url} target="_blank" className="text-gray-800 hover:underline">
                      {hostPath(l.target_url)}
                    </a>
                  </td>
                  <td className="px-3 py-2">{l.candidate_slug || ""}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{scanCount}</td>
                  <td className="px-3 py-2 text-right">
                    <CopyButtons shortUrl={shortUrl} targetUrl={l.target_url} />
                  </td>
                </tr>
              );
            })}
            {links.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-gray-500">
                  No short links found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-gray-500">
        Hint: use <code>POST /api/shorten</code> with <code>{`{ target_url, candidate_slug }`}</code> to mint
        new links, then scan via <code>/c/&lt;code&gt;</code> to see counts populate here.
      </p>
    </div>
  );
}
