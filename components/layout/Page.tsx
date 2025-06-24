// ✅ FILE: /components/layout/Page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import AppHeader from '@/components/admin/AppHeader/app-header';
import AdminLayout from '@/components/admin/admin-layout';
import { supabase } from '@/lib/supabase/client';

export default function Page({ children }: { children: React.ReactNode }) {
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<string>('loading');

  useEffect(() => {
    const fetchUserRole = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!user) {
        setEmail(null);
        setRole('viewer');
        return;
      }

      setEmail(user.email ?? null);
      const cacheKey = `cached-role-${user.email ?? 'unknown'}`;
      let resolvedRole = localStorage.getItem(cacheKey) || 'viewer';

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profile?.role) {
        resolvedRole = profile.role;
        localStorage.setItem(cacheKey, resolvedRole);
      }

      setRole(resolvedRole);
    };

    fetchUserRole();
  }, []);

  return (
    <AdminLayout>
      <AppHeader />

      <div className="text-xs text-gray-400 bg-zinc-900 px-4 py-2 border-b border-zinc-700">
        <code>
          Session: {email ?? 'not signed in'} | Role: {role}
        </code>
      </div>

      <div className="p-4">{children}</div>
    </AdminLayout>
  );
}
