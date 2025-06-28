'use client';

// Use DashboardPage() when you need to display the dashboard page
// Use getUserFromRequest() when you need the user context

import { useEffect } from 'react';
import Page from '@/components/layout/page';
import Dashboard from '@/components/admin/dashboard-grid-draggable';
import { supabase } from '@/admin/lib/supabaseClient';
import Link from 'next/link';
import AuthGuard from '@/components/admin/auth-guard';

export default function DashboardPage() {
  useEffect(() => {
    async function logAccess() {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) return;

      let geo: any = {};
      try {
        const res = await fetch('https://ipapi.co/json/');
        geo = await res.json();
      } catch (e) {
        console.warn('🌍❌ [Geo Lookup Failed]', e);
      }

      await supabase.from('dashboard_access_log').insert({
        user_id: user.id,
        email: user.email,
        timestamp: new Date().toISOString(),
        user_agent: navigator.userAgent,
        ip_address: geo?.ip ?? null,
        city: geo?.city ?? null,
        region: geo?.region ?? null,
        country: geo?.country_name ?? null,
      });
    }

    logAccess();
  }, []);

  return (
    <Page>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">Admin Dashboard</h1>
        <Link href="/admin/logs/dashboard" className="text-sm text-blue-600 hover:underline">
          View Access Logs
        </Link>
      </div>

      <AuthGuard roles={['admin']}>
        <Dashboard
          renderers={{}}
          order={[]}
          hidden={[]}
          onSave={() => {}}
          onAddBlock={() => {}}
          settings={{}}
          updateBlockSetting={() => {}}
        />
      </AuthGuard>
    </Page>
  );
}
