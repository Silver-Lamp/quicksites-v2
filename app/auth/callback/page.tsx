// app/auth/callback/page.tsx  (SERVER)
import { redirect } from 'next/navigation';
import { getSupabaseForAction } from '@/lib/supabase/serverClient';

export default async function AuthCallback({ searchParams }: { searchParams: { code?: string; next?: string } }) {
  const supabase = await getSupabaseForAction(); // ✅ RSC-safe (no cookie writes)
  if (searchParams.code) {
    await supabase.auth.exchangeCodeForSession(searchParams.code);
  }
  redirect(searchParams.next ? decodeURIComponent(searchParams.next) : '/');
}
