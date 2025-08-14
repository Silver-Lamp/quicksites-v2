import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: NextRequest) {
  const u = new URL(req.url);
  const meal_id = u.searchParams.get("meal_id");
  const chef_id = u.searchParams.get("chef_id");
  const site_id = u.searchParams.get("site_id");
  const limit = Math.min(parseInt(u.searchParams.get("limit") || "6", 10), 50);
  const offset = parseInt(u.searchParams.get("offset") || "0", 10);
  const sort = (u.searchParams.get("sort") || "recent") as "recent"|"top";
  const minStars = parseInt(u.searchParams.get("min_stars") || "");
  const includeSummary = u.searchParams.get("include_summary") === "1";

  if (!meal_id && !chef_id && !site_id) {
    return NextResponse.json({ error: "meal_id, chef_id, or site_id required" }, { status: 400 });
  }

  let sel = db.from("reviews")
    .select("id, meal_id, chef_id, site_id, rating, comment, created_at, user_name")
    .order(sort === "top" ? "rating" : "created_at", { ascending: sort === "recent" ? false : false }) // top=rating desc, recent=created_at desc

  if (meal_id) sel = sel.eq("meal_id", meal_id);
  if (chef_id) sel = sel.eq("chef_id", chef_id);
  if (site_id) sel = sel.eq("site_id", site_id);
  if (!Number.isNaN(minStars)) sel = sel.gte("rating", minStars);

  const { data, error } = await sel.range(offset, offset + limit - 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!includeSummary) return NextResponse.json({ reviews: data || [] });

  // Summary (count, avg, star buckets)
  let sumQ = db.from("reviews").select("rating");
  if (meal_id) sumQ = sumQ.eq("meal_id", meal_id);
  if (chef_id) sumQ = sumQ.eq("chef_id", chef_id);
  if (site_id) sumQ = sumQ.eq("site_id", site_id);
  const { data: allRatings } = await sumQ;
  const stars: Record<string, number> = { "1":0,"2":0,"3":0,"4":0,"5":0 };
  let total = 0, n = 0;
  (allRatings || []).forEach(r => {
    const v = (r as any).rating as number;
    if (v >=1 && v <=5) { stars[String(v)]++; total += v; n++; }
  });
  const avg = n ? total / n : 0;

  return NextResponse.json({ reviews: data || [], summary: { count: n, avg, stars } });
}
