'use client';
import Link from 'next/link';
import { useRouter } from 'next/router';

const navItems = [
  { label: 'Dashboard', href: '/admin/dashboard' },
  { label: 'Sites', href: '/admin/sites' },
  { label: 'Logs', href: '/admin/logs' },
  { label: 'Reports', href: '/admin/reports', badge: '🆕' },
  { label: 'System Logs', href: '/system/logs', badge: '⚠️' },
];

export default function AdminSidebarLayout({ children }: { children: React.ReactNode }) {
  const { pathname } = useRouter();

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-zinc-900 p-4 space-y-2 text-white border-r border-zinc-800">
        {navItems.map(({ label, href, badge }) => (
          <Link
            key={href}
            href={href}
            className={`block px-4 py-2 rounded hover:bg-zinc-700 ${
              pathname.startsWith(href) ? 'bg-zinc-800 font-semibold' : ''
            }`}
          >
            <span className="flex items-center justify-between">
              {label}
              {badge && <span className="text-xs text-yellow-400 ml-2">{badge}</span>}
            </span>
          </Link>
        ))}
      </aside>
      <main className="flex-1">{children}</main>
    </div>
  );
}
