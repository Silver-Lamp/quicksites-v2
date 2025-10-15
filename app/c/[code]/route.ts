// app/c/[code]/route.ts
// Short-link resolver + scan logger (fire-and-forget).
// Uses getServerSupabase({ serviceRole: true }) for consistency.

import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseCityRegion(headers: Headers) {
  // Map any edge/CDN geo headers your platform provides
  return {
    city: headers.get("x-geo-city") || null,
    region: headers.get("x-geo-region") || null,
  };
}

export async function GET(req: Request, { params }: { params: { code: string } }) {
  const code = params.code;
  const url = new URL(req.url);

  const supabase = await getServerSupabase({ serviceRole: true });

  // Lookup the short link
  const { data: link, error } = await supabase
    .from("short_links")
    .select("*")
    .eq("code", code)
    .maybeSingle();

  if (error || !link?.target_url) {
    // Not found → send home (or a 404 page if you prefer)
    return NextResponse.redirect(new URL("/", url.origin), 302);
  }

  // Fire-and-forget scan log (do not await)
  try {
    const ua = req.headers.get("user-agent") || null;
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0] || null;
    const { city, region } = parseCityRegion(req.headers);

    // No need to await; let it run in the background.
    supabase
      .from("short_scans")
      .insert({ code, ua, ip, city, region })
      .then(() => {})
  } catch {
    // swallow logging errors
  }

  // Redirect to the long URL (cache briefly at the edge)
  const res = NextResponse.redirect(link.target_url, 302);
  res.headers.set("Cache-Control", "public, max-age=60, s-maxage=300");
  return res;
}
