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

  const { data: admin } = await supabase
    .from('admin_users')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  return NextResponse.json({
    userPresent: true,
    user: { id: user.id, email: user.email },
    isAdmin: !!admin,
  })
}
