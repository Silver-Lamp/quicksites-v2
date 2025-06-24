// /app/api/test-login/route.ts
import { createClient } from '@supabase/supabase-js';
export async function GET() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { error } = await supabase.auth.signInWithOtp({
    email: 'sandonjurowski@gmail.com',
    options: { emailRedirectTo: 'http://localhost:3000/login' },
  });
  return new Response(JSON.stringify({ error }), { status: 200 });
}
