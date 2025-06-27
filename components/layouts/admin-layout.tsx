'use client';

import { ReactNode } from 'react';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="admin-layout">
      <aside className="w-64 p-4 bg-zinc-900 text-white">Admin Sidebar</aside>
      <main className="p-6 flex-1">{children}</main>
    </div>
  );
}
