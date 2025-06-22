// app/api/me/nav/route.ts

import { NAV_SECTIONS } from '@/lib/nav/links';
import { createAppSupabaseClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createAppSupabaseClient(); // ✅ centralized helper

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { data: prefs } = await supabase
    .from('nav_preferences')
    .select('*')
    .eq('user_id', user.id)
    .single();

  const disabledFlags = prefs?.disabled_flags ?? [];
  const enabledLinks = prefs?.enabled_links ?? [];

  const filtered = NAV_SECTIONS.map((section) => ({
    ...section,
    routes: section.routes.filter((r) => {
      const roleMatch = !r.roles || r.roles.includes(user.role as any);
      const flagMatch = !r.flags || !r.flags.some((f) => disabledFlags.includes(f));
      const enabled = !enabledLinks.length || enabledLinks.includes(r.href);
      return roleMatch && flagMatch && enabled;
    }),
  }));

  return new Response(JSON.stringify(filtered), {
    headers: { 'Content-Type': 'application/json' },
  });
}
