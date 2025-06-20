'use client';
import { useEffect, useState } from 'react';
import MobileDrawerSidebar from '@/components/admin/mobile-drawer-sidebar';
import NavBarWithBadges from '@/components/admin/nav-bar-with-badges';
import AdminSidebarLayout from '@/components/admin/layout/admin-sidebar-layout';

export default function ResponsiveAdminLayout({ children }: { children: React.ReactNode }) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkSize = () => setIsMobile(window.innerWidth < 768);
    checkSize();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);

  return isMobile ? (
    <>
      <MobileDrawerSidebar />
      <div className="pt-20 px-4">{children}</div>
    </>
  ) : (
    <div className="flex">
      <AdminSidebarLayout>
        <div className="w-full">
          <NavBarWithBadges />
          <main className="p-6">{children}</main>
        </div>
      </AdminSidebarLayout>
    </div>
  );
}
