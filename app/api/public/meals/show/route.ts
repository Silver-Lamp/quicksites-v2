import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: NextRequest) {
  const u = new URL(req.url);
  const meal_id = u.searchParams.get("meal_id");
  const meal_slug = u.searchParams.get("meal_slug");

  if (!meal_id && !meal_slug) {
    return NextResponse.json({ error: "meal_id or meal_slug required" }, { status: 400 });
  }

  let q = db.from("meals")
    .select("id, slug, title, image_url, price, price_cents, currency, rating_avg, rating_count, tags, chef_id, site_id")
    .eq("status","published")
    .eq("is_active", true)
    .limit(1);

  if (meal_id) q = q.eq("id", meal_id);
  if (meal_slug) q = q.eq("slug", meal_slug);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || !data.length) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const meal = data[0];

  // Optionally join chef name if you have a chefs table
  try {
    const { data: chef } = await db.from("chefs").select("display_name").eq("id", meal.chef_id).maybeSingle();
    (meal as any).chef_name = chef?.display_name || null;
  } catch {}

  return NextResponse.json(meal);
}
