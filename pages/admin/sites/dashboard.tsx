'use client';

import { useEffect } from 'react';
import Page from '@/components/layout/Page';
import Dashboard from '@/components/admin/Dashboard';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function DashboardPage() {
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        let geo = {};
        try {
          const res = await fetch('https://ipapi.co/json/');
          geo = await res.json();
        } catch (e) {
          console.warn('Geo lookup failed');
        }

        await supabase.from('dashboard_access_log').insert({
          user_id: user.id,
          email: user.email,
          timestamp: new Date().toISOString(),
          user_agent: navigator.userAgent,
          ip_address: geo.ip || null,
          city: geo.city || null,
          region: geo.region || null,
          country: geo.country_name || null
        });
      }
    })();
  }, []);

  return (
    <Page>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">Admin Dashboard</h1>
        <Link href="/admin/logs/dashboard" className="text-sm text-blue-600 hover:underline">
          View Access Logs
        </Link>
      </div>
      <Dashboard />
    </Page>
  );
}
