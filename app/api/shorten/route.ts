// app/api/shorten/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  target_url: z.string().url(),
  candidate_slug: z.string().min(1),
  prefer_code: z.string().regex(/^[0-9a-zA-Z-_]{2,12}$/).optional(),
});

const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || "http://localhost:3000";

function randomBase62(len = 3) {
  const a = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let s = "";
  for (let i = 0; i < len; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
}

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = Body.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "INVALID" }, { status: 400 });
    }
    const { target_url, candidate_slug, prefer_code } = parsed.data;

    const supabase = await getServerSupabase({ serviceRole: true });

    // Reuse existing mapping if present
    const { data: existing } = await supabase
      .from("short_links")
      .select("*")
      .eq("target_url", target_url)
      .eq("candidate_slug", candidate_slug)
      .limit(1)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        ok: true,
        code: existing.code,
        url: `${PUBLIC_BASE_URL}/c/${existing.code}`,
      });
    }

    // Try preferred code first, then exponential length growth on collision
    let code = prefer_code || randomBase62(3);
    for (let i = 0; i < 6; i++) {
      const { error } = await supabase.from("short_links").insert({
        code,
        target_url,
        candidate_slug,
      });
      if (!error) {
        return NextResponse.json({
          ok: true,
          code,
          url: `${PUBLIC_BASE_URL}/c/${code}`,
        });
      }
      code = randomBase62(3 + i + 1);
    }

    return NextResponse.json({ ok: false, error: "COLLISION" }, { status: 500 });
  } catch (e) {
    console.error("shorten error", e);
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}
