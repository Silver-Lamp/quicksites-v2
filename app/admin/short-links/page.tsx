// app/admin/short-links/page.tsx
// Short links admin with 30-day scan counts + plan toggle + gate badges + Edit button.

import Link from "next/link";
import { headers } from "next/headers";
import { getServerSupabase } from "@/lib/supabase/server";
import CopyButtons from "components/admin/CopyButtons";
import PlanToggle from "@/components/admin/short-links/PlanToggle";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function hostPath(u: string) {
  try { const x = new URL(u); return (x.host + x.pathname).replace(/\/$/, ""); } catch { return u; }
}
function rewriteOrigin(u: string | null | undefined, newOrigin: string) {
  if (!u) return "";
  try { const x = new URL(u); return `${newOrigin}${x.pathname}${x.search}${x.hash}`; } catch { return u; }
}

async function getData() {
  const supabase = await getServerSupabase();
  const sinceIso = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const rpc = await supabase.rpc("admin_list_short_links", { p_since: sinceIso });
  if (!rpc.error && Array.isArray(rpc.data)) {
    return { rows: rpc.data.map((r: any) => ({
      id: r.id, code: r.code, target_url: r.target_url ?? r.long_url,
      candidate_slug: r.candidate_slug, created_at: r.created_at, scan_count: r.scan_count ?? 0,
    })) };
  }
  const svc = await getServerSupabase({ serviceRole: true });
  const { data: links } = await svc
    .from("public.short_links")
    .select("id, code, target_url, long_url, candidate_slug, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  const { data: scans } = await svc
    .from("public.short_link_clicks").select("code, ts").gte("ts", sinceIso);
  const counts = new Map<string, number>();
  for (const s of scans || []) counts.set(s.code, (counts.get(s.code) || 0) + 1);
  return {
    rows: (links || []).map((l: any) => ({
      id: l.id, code: l.code, target_url: l.target_url ?? l.long_url,
      candidate_slug: l.candidate_slug, created_at: l.created_at,
      scan_count: counts.get(l.code) || 0,
    })),
  };
}

type PageFlags = {
  slug: string; is_paid: boolean | null;
  allow_text: boolean | null; allow_email: boolean | null;
  enable_donations: boolean | null; enable_events: boolean | null;
  enable_newsletter: boolean | null; enable_endorsements: boolean | null; enable_volunteer: boolean | null;
};

function GateBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      title={label}
      className={[
        "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium",
        ok ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/20"
           : "bg-zinc-500/10 text-zinc-300 ring-1 ring-zinc-400/10",
      ].join(" ")}
    >
      {label}
    </span>
  );
}

export default async function ShortLinksAdminPage() {
  const { rows } = await getData();

  // origin selection
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const protoHeader = h.get("x-forwarded-proto");
  const isLocal = /^localhost(:\d+)?$|^127\.0\.0\.1(:\d+)?$|\.local$/i.test(host);
  const currentOrigin = host ? `${protoHeader ?? (isLocal ? "http" : "https")}://${host}` : null;
  const configuredBase = (process.env.PUBLIC_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
  const base = isLocal && currentOrigin ? currentOrigin : configuredBase;

  // plan/gates per slug
  const slugs = Array.from(new Set(rows.map((r) => r.candidate_slug).filter(Boolean)));
  const svc = await getServerSupabase({ serviceRole: true });
  const { data: pages } = await svc
    .from("candidate_pages")
    .select("slug, is_paid, allow_text, allow_email, enable_donations, enable_events, enable_newsletter, enable_endorsements, enable_volunteer")
    .in("slug", slugs.length ? slugs : ["__none__"]);
  const pageBySlug = new Map<string, PageFlags>();
  for (const p of pages || []) pageBySlug.set(p.slug, p as PageFlags);

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Short Links</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Last {rows.length} links. Scan counts aggregated over the past 30 days.
          </p>
        </div>
        <Link href="/admin" className="rounded border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
          ← Admin
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <table className="min-w-[1100px] w-full text-sm text-gray-900 dark:text-gray-100">
          <thead className="bg-gray-50 dark:bg-gray-800/80">
            <tr className="text-gray-700 dark:text-gray-300">
              <th className="px-3 py-2 text-left font-semibold">Code</th>
              <th className="px-3 py-2 text-left font-semibold">Short URL</th>
              <th className="px-3 py-2 text-left font-semibold">Target</th>
              <th className="px-3 py-2 text-left font-semibold">Candidate</th>
              <th className="px-3 py-2 text-left font-semibold">Plan</th>
              <th className="px-3 py-2 text-left font-semibold">Gates</th>
              <th className="px-3 py-2 text-right font-semibold">Scans (30d)</th>
              <th className="px-3 py-2 text-right font-semibold">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {rows.map((l) => {
              const shortUrl = `${base}/c/${l.code}`;
              const targetHref = isLocal ? rewriteOrigin(l.target_url, base) : l.target_url;
              const flags = l.candidate_slug ? pageBySlug.get(l.candidate_slug) : undefined;

              return (
                <tr key={l.id} className="odd:bg-white even:bg-gray-50 hover:bg-gray-50 dark:odd:bg-gray-900 dark:even:bg-gray-950 dark:hover:bg-gray-800/60">
                  <td className="px-3 py-2 font-mono text-xs text-gray-700 dark:text-gray-300">{l.code}</td>
                  <td className="px-3 py-2">
                    <a href={shortUrl} target="_blank" className="text-indigo-600 hover:underline dark:text-indigo-400">
                      {hostPath(shortUrl)}
                    </a>
                  </td>
                  <td className="px-3 py-2 max-w-[420px] truncate" title={targetHref}>
                    <a href={targetHref} target="_blank" className="text-gray-800 hover:underline dark:text-gray-200">
                      {hostPath(targetHref)}
                    </a>
                  </td>
                  <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{l.candidate_slug || ""}</td>

                  {/* Plan toggle */}
                  <td className="px-3 py-2">
                    {l.candidate_slug && <PlanToggle slug={l.candidate_slug} isPaid={!!flags?.is_paid} />}
                  </td>

                  {/* Gate badges */}
                  <td className="px-3 py-2">
                    {flags ? (
                      <div className="flex flex-wrap gap-1.5">
                        <GateBadge ok={!!flags.enable_donations} label="Donations" />
                        <GateBadge ok={!!flags.enable_events} label="Events" />
                        <GateBadge ok={!!flags.enable_newsletter} label="Newsletter" />
                        <GateBadge ok={!!flags.enable_endorsements} label="Endorsements" />
                        <GateBadge ok={!!flags.enable_volunteer} label="Volunteer" />
                        <GateBadge ok={!!flags.allow_text} label="Text" />
                        <GateBadge ok={!!flags.allow_email} label="Email" />
                      </div>
                    ) : (
                      <span className="text-xs text-gray-500 dark:text-gray-400">—</span>
                    )}
                  </td>

                  <td className="px-3 py-2 text-right">
                    <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                      {l.scan_count}
                    </span>
                  </td>

                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-2">
                        {l.candidate_slug && (
                        <>
                            <Link
                            href={`/admin/candidate/${l.candidate_slug}/print`}
                            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                            >
                            Print &amp; QR
                            </Link>
                            <Link
                            href={`/admin/candidate/${l.candidate_slug}/edit`}
                            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                            >
                            Edit
                            </Link>
                        </>
                        )}
                        <CopyButtons shortUrl={shortUrl} targetUrl={targetHref} />
                    </div>
                  </td>
                </tr>
              );
            })}

            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-gray-500 dark:text-gray-400">
                  No short links found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
        Hint: use <code>POST /api/shorten</code> with <code>{`{ target_url, candidate_slug }`}</code> to mint new links. In local/dev, links will open on <code>{base}</code>.
      </p>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Toggling <strong>Paid</strong> updates <code>candidate_pages.is_paid</code> and sets gates: donations, events, newsletter, endorsements, volunteer, and Text/Email CTAs.
      </p>
    </div>
  );
}
