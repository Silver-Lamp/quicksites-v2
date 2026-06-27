// app/api/auth/whoami/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async get(name: string) { return (await cookies()).get(name)?.value },
        async set(name, value, options) { (await cookies()).set({ name, value, ...options }) },
        async remove(name, options) { (await cookies()).delete({ name, ...options }) },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ userPresent: false }, { status: 200 })

  // Anonymous (guest) users are real auth users with no identity. Never treat
  // them as admin; surface an explicit 'guest' role for the client.
  const isAnonymous = !!user.is_anonymous

  const admin = isAnonymous
    ? null
    : (await supabase
        .from('admin_users')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle()).data

  const role = isAnonymous ? 'guest' : admin ? 'admin' : 'viewer'

  return NextResponse.json({
    userPresent: true,
    user: { id: user.id, email: user.email ?? null },
    isAdmin: !isAnonymous && !!admin,
    isAnonymous,
    role,
  })
}
