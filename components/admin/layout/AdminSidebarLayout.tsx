// ✅ FILE: components/admin/layout/AdminSidebarLayout.tsx

'use client';

import { useEffect, useState, ReactNode } from 'react';
import GroupedNav from '@/components/admin/GroupedNav';
import { SidebarNavProvider } from '@/components/admin/context/SidebarNavContext';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export default function AdminSidebarLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [navBadges, setNavBadges] = useState<{ failed: number }>({ failed: 0 });

  useEffect(() => {
    fetch('/api/nav-badges')
      .then((res) => res.json())
      .then(setNavBadges)
      .catch(() => {});
  }, []);

  const { role: rawRole } = useCurrentUser();
  const role = rawRole || 'viewer';

  const navItems = [
    {
      label: 'Tools',
      routes: [
        {
          label: 'Posters',
          path: '/admin/tools/print-all',
          icon: '🖼️',
          roles: ['admin'],
        },
        {
          label: 'Chart',
          path: '/admin/tools/chart',
          icon: '📊',
          roles: ['admin'],
        },
        {
          label: 'Campaigns CSV',
          path: '/api/campaign-analytics',
          icon: '📁',
          roles: ['admin'],
        },
        {
          label: 'Top Badges (ZIP)',
          path: '/api/badge/top',
          icon: '🏅',
          roles: ['admin'],
        },
        {
          label: 'Leaderboard',
          path: '/leaderboard',
          icon: '🏆',
          roles: ['admin', 'viewer'],
        },
      ],
    },
    {
      label: 'Logs',
      routes: [
        {
          label: 'Notifications',
          path: '/admin/logs/notifications',
          icon: '📨',
          badge: navBadges.failed > 0 ? navBadges.failed : 'NEW',
          roles: ['admin'],
        },
        {
          label: 'Session Logs',
          path: '/admin/logs/sessions',
          icon: '🪵',
          roles: ['admin'],
        },
      ],
    },
  ];

  return (
    <SidebarNavProvider role={role} groups={navItems}>
      <div className="flex min-h-screen bg-black text-white">
        <aside className="w-64 bg-zinc-900 p-4 hidden md:block border-r border-zinc-700">
          <h2 className="text-lg font-bold mb-4">Admin Panel</h2>
          {process.env.NODE_ENV !== 'production' && (
            <div className="text-xs text-gray-400 mb-4">Role: {role}</div>
          )}
          <GroupedNav />
        </aside>

        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </SidebarNavProvider>
  );
}
