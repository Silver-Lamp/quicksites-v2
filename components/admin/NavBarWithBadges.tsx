'use client';
import Link from 'next/link';
import { useRouter } from 'next/router';

const routes = [
  { label: 'Dashboard', href: '/admin/dashboard' },
  { label: 'Sites', href: '/admin/sites' },
  { label: 'Logs', href: '/admin/logs' },
  { label: 'Sitemap Diffs', href: '/docs/diffs', badge: '🆕' }
];

export default function NavBarWithBadges() {
  const router = useRouter();

  return (
    <nav className="hidden md:flex items-center space-x-6 px-6 py-3 bg-zinc-900 text-white border-b border-zinc-800">
      {routes.map(({ label, href, badge }) => {
        const isActive = router.pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center text-sm font-medium hover:text-blue-400 transition ${
              isActive ? 'text-blue-400' : 'text-zinc-300'
            }`}
          >
            {label}
            {badge && (
              <span className="ml-2 px-2 py-0.5 text-yellow-400 text-xs bg-zinc-700 rounded-full">
                {badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
