// app/api/session/route.ts
import { getServerSupabase } from '@/lib/supabase/server';
import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const supabase = await getServerSupabase();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    return Response.json({ error: error.message }, { status: 401 });
  }

  if (!user) {
    return Response.json({ error: 'No session found' }, { status: 401 });
  }

  return Response.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.user_metadata?.role ?? 'viewer',
    },
  });
}
