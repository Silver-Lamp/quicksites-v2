// app/api/subscribe/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";
import { rateLimitOr429 } from "@/lib/api/rateLimitGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  email: z.string().email(),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/),
  candidate_slug: z.string().min(1).optional(),
  recaptchaToken: z.string().optional(),
});

async function verifyRecaptcha(token?: string) {
  // The env var is RECAPTCHA_SECRET_KEY — this read said RECAPTCHA_SECRET, so it was always
  // undefined and the guard below always returned true. Captcha has been silently off here.
  // Renaming changes no behaviour today (no caller sends a token, so `!token` short-circuits
  // anyway); it means verification actually runs if one ever does. Whether this should fail
  // CLOSED when the secret is configured is a separate behaviour decision — failing closed
  // now would reject both existing callers. Rate-limiting this route is the unambiguous fix.
  if (!token || !process.env.RECAPTCHA_SECRET_KEY) return true;
  const params = new URLSearchParams({
    secret: process.env.RECAPTCHA_SECRET_KEY,
    response: token,
  });
  const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  const data = await res.json();
  return !!data.success;
}

export async function POST(req: Request) {
  try {
    // Per-IP throttle. This is a PUBLIC, unauthenticated endpoint that upserts into
    // `supporters`, and its captcha does not currently stop anything: no caller sends a
    // token, so verifyRecaptcha short-circuits to true on `!token`. Until that behaviour
    // question is settled, the rate limit is the protection.
    //
    // 5/hour matches `contact` (lib/api/rateLimitGuard.ts users), the closest analogue —
    // a public form that writes a contact record. Generous for a human (you subscribe
    // once) and fatal to a bot, which needs thousands. Counted per IP, so a shared office
    // or carrier-NAT address shares the budget; that is the accepted trade every other
    // public form here already makes.
    const limited = await rateLimitOr429(req, "subscribe", 5, 3600);
    if (limited) return limited;

    const json = await req.json();
    const parsed = Body.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
    }

    const ok = await verifyRecaptcha(parsed.data.recaptchaToken);
    if (!ok) return NextResponse.json({ ok: false, error: "BOT_CHECK_FAILED" }, { status: 400 });

    const { email, zip, candidate_slug } = parsed.data;

    const supabase = await getServerSupabase({ serviceRole: true });

    const { error } = await supabase
      .from("supporters")
      .upsert(
        { email, zip, candidate_slug },
        { onConflict: "email,candidate_slug" }
      );

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("subscribe error", e);
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}
