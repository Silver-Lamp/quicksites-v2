// /app/api/public/meal/[handle]/reviews/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
export const runtime='nodejs'; export const dynamic='force-dynamic';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: NextRequest, { params }: { params:{ handle:string } }) {
  const url = new URL(req.url);
  const mealId = url.searchParams.get('mealId'); // or resolve from slug if you want
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);
  const { data, error } = await db
    .from('reviews')
    .select('id, rating, comment, photos, created_at, is_verified')
    .eq('meal_id', mealId)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reviews: data ?? [] });
}
