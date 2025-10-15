// lib/server/shortener.ts
import { getServerSupabase } from "@/lib/supabase/server";

function randCode(len = 6) {
  return Math.random().toString(36).slice(2, 2 + len);
}

type EnsureOpts = { candidateSlug?: string };

/**
 * Prefer RPC (SECURITY DEFINER) to bypass RLS safely.
 * Falls back to service-role direct insert if RPC is missing.
 */
export async function ensureShortLink(
  longUrl: string,
  desiredCode?: string | null,
  supabaseArg?: any,
  opts: EnsureOpts = {},
) {
  const host = (process.env.PUBLIC_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
  const cleanUrl = longUrl.replace(/\/+$/, "");

  // Use provided client or a normal server client (RPC runs as definer)
  const supabase = supabaseArg ?? (await getServerSupabase());

  // --- 1) Try RPC path (bypasses RLS)
  const rpc = await supabase.rpc("ensure_short_link", {
    p_url: cleanUrl,
    p_code: desiredCode ?? null,
    p_candidate_slug: opts.candidateSlug ?? null,
    p_target_url: cleanUrl,
  });

  if (!rpc.error && rpc.data) {
    return `${host}/c/${rpc.data}`;
  }

  // If RPC missing or not deployed yet, fall back to service-role direct insert.
  const needsFallback =
    rpc.error &&
    /function .*ensure_short_link.* does not exist|rpc|procedure/i.test(rpc.error.message);

  if (!needsFallback) {
    // Some other RPC error—bubble it up
    throw rpc.error;
  }

  // --- 2) Fallback: direct insert with service-role (bypasses RLS)
  const svc = await getServerSupabase({ serviceRole: true });
  const base = (desiredCode || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const attempts = [
    ...[base, `${base}-2`, `${base}-3`, `${base}-4`].filter(Boolean),
    randCode(),
    randCode(),
    randCode(),
  ];

  for (const code of attempts) {
    const record = {
      id: crypto.randomUUID(),
      code,
      long_url: cleanUrl,
      target_url: cleanUrl,
      candidate_slug: opts.candidateSlug ?? null,
    };

    const { data, error } = await svc
      .from("short_links")
      .insert(record)
      .select("code")
      .single();

    if (!error && data?.code) return `${host}/c/${data.code}`;
    if (error?.code === "23505") continue; // unique violation on code → try next
    if (error && /row-level security/i.test(error.message)) {
      throw new Error(
        "RLS blocked insert; confirm SUPABASE_SERVICE_ROLE_KEY is configured for the server.",
      );
    }
    if (error) throw error;
  }

  throw new Error("Unable to reserve a short code after several attempts.");
}
