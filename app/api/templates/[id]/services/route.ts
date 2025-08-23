// app/api/templates/[id]/services/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export const runtime = 'nodejs';

function clean(arr: unknown[]) {
  return Array.from(
    new Set((arr ?? []).map((s: any) => String(s ?? '').trim()).filter(Boolean))
  );
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { services = [] } = await req.json().catch(() => ({ services: [] }));
  const cleaned = clean(services);

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          // next/headers returns { name, value }[]
          return cookieStore.getAll().map(({ name, value }) => ({ name, value }));
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set({ name, value, ...options });
          });
        },
      },
    }
  );

  const { data, error } = await supabase
    .from('templates')
    .update({ services: cleaned })
    .eq('id', params.id) // <-- adjust if your PK differs
    .select('services')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ services: data.services });
}
