import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getSupabaseRSC } from '@/lib/supabase/serverClient';
import AdminChrome from '@/components/admin/admin-chrome';
import { guestBuildEnabled } from '@/lib/flags/guestBuild';

// Anonymous (guest) users may ONLY reach the template editor — never the rest of
// the admin surface (dashboards, billing, etc. carry browser-client writes gated
// only by getUser()). Editor route: /admin/templates/<key> (not list/new/tools).
function isGuestAllowedPath(pathname: string): boolean {
  return /^\/admin\/templates\/(?!list(?:$|\/)|new(?:$|\/)|gsc-bulk-stats(?:$|\/))[^/]+/.test(
    pathname,
  );
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await getSupabaseRSC();              // ✅ RSC-safe
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent('/admin/templates/list')}`);

  // Guest (anonymous) gating — confined to the editor, only when the flag is on.
  if (user.is_anonymous) {
    const pathname = (await headers()).get('x-pathname') ?? '';
    if (!guestBuildEnabled() || !isGuestAllowedPath(pathname)) {
      // Fail closed: a guest anywhere other than their editor goes home.
      redirect('/');
    }
    return <AdminChrome isGuest>{children}</AdminChrome>;
  }

  return <AdminChrome>{children}</AdminChrome>;
}
