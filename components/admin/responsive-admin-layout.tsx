'use client';

import { useEffect, useState } from 'react';
import MobileDrawerSidebar from '@/components/admin/mobile-drawer-sidebar';
import NavBarWithBadges from '@/components/admin/nav-bar-with-badges';
import AdminSidebarLayout from '@/components/admin/layout/admin-sidebar-layout';
import AppHeader from '@/components/admin/AppHeader/app-header';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useCanonicalRole } from '@/hooks/useCanonicalRole';
import AdminSidebar from '@/components/admin/admin-sidebar';

export default function ResponsiveAdminLayout({ children }: { children: React.ReactNode }) {
  const [isMobile, setIsMobile] = useState(false);
  const { user, ready } = useCurrentUser();
  const { role } = useCanonicalRole();

  useEffect(() => {
    const checkSize = () => setIsMobile(window.innerWidth < 768);
    checkSize();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);

  if (!ready || !user) {
    return <div className="p-6 text-white">Loading user session...</div>;
  }

  return (
    <>
      <AdminSidebar />
      {isMobile ? (
        <>
          <MobileDrawerSidebar />
          <div className="pt-20 px-4">{children}</div>
        </>
      ) : (
        <div className="flex">
          <AdminSidebarLayout>
            <div className="w-full">
              <main className="p-6">{children}</main>
            </div>
          </AdminSidebarLayout>
        </div>
      )}
    </>
  );
}
