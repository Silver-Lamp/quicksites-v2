import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function verifyRoleFromJWT(token: string): Promise<{
  role: string | null;
  userId: string | null;
  error?: string;
}> {
  try {
    const decoded = jwt.verify(token, process.env.SUPABASE_JWT_SECRET!) as { sub: string };
    const userId = decoded.sub;

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      return { role: null, userId, error: error.message };
    }

    return { role: profile?.role ?? null, userId };
  } catch (err: any) {
    return { role: null, userId: null, error: err.message };
  }
}
