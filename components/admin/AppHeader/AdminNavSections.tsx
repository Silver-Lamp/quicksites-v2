'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  MapPinned,
  PhoneForwarded,
  Rocket,
  FileStack,
  Activity,
  ChevronDown,
} from 'lucide-react';
import clsx from 'clsx';

type NavItem = {
  label: string;
  href?: string;
  icon: React.ReactNode;
  children?: { label: string; href: string }[];
};

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/admin/dashboard',
    icon: <LayoutDashboard size={18} />,
  },
  {
    label: 'Map of Opportunities',
    href: '/admin/the-grid',
    icon: <MapPinned size={18} />,
  },
  {
    label: 'Leads',
    href: '/admin/leads',
    icon: <PhoneForwarded size={18} />,
  },
  {
    label: 'Campaigns',
    icon: <Rocket size={18} />,
    children: [
      { label: 'All Campaigns', href: '/admin/campaigns' },
      { label: 'Start Campaign', href: '/admin/start-campaign' },
    ],
  },
  {
    label: 'Templates',
    icon: <FileStack size={18} />,
    children: [
      { label: 'Browse Templates', href: '/admin/templates' },
      { label: 'Create Template', href: '/admin/templates/new' },
    ],
  },
  {
    label: 'Analytics',
    href: '/admin/analytics',
    icon: <Activity size={18} />,
  },
];

export function AdminNavSections({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname();
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});

  // Open any submenu containing the current path
  useEffect(() => {
    const updated = { ...openMenus };
    navItems.forEach((item) => {
      if (item.children) {
        const shouldOpen = item.children.some((child) => pathname?.startsWith(child.href));
        if (shouldOpen) updated[item.label] = true;
      }
    });
    setOpenMenus(updated);
  }, [pathname]);

  const toggleMenu = (label: string) => {
    setOpenMenus((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <nav className="flex flex-col gap-1 px-1">
      {navItems.map((item) => {
        const isActive = item.href && pathname?.startsWith(item.href);
        const isOpen = openMenus[item.label];

        return (
          <div key={item.label} className="relative group">
            <button
              onClick={() => item.children ? toggleMenu(item.label) : undefined}
              className={clsx(
                'w-full flex items-center gap-3 px-3 py-2 text-sm rounded transition',
                isActive
                  ? 'bg-zinc-800 font-semibold text-white'
                  : 'hover:bg-zinc-800 text-zinc-300',
                !item.children && 'text-left'
              )}
            >
              <span className="text-white">{item.icon}</span>
              <span
                className={clsx(
                  'whitespace-nowrap transition-all duration-200 flex-1 text-left',
                  collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto'
                )}
              >
                {item.label}
              </span>
              {item.children && !collapsed && (
                <ChevronDown
                  className={clsx(
                    'transition-transform',
                    isOpen ? 'rotate-180' : 'rotate-0'
                  )}
                  size={16}
                />
              )}
            </button>

            {/* Tooltip for collapsed state */}
            {collapsed && (
              <span className="absolute left-14 top-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-zinc-800 px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-all z-20 shadow-lg">
                {item.label}
              </span>
            )}

            {/* Submenu */}
            {item.children && isOpen && !collapsed && (
              <div className="ml-8 mt-1 flex flex-col gap-1">
                {item.children.map((child) => (
                  <Link
                    key={child.href}
                    href={child.href}
                    className={clsx(
                      'text-sm px-3 py-1 rounded transition',
                      pathname?.startsWith(child.href)
                        ? 'bg-zinc-800 text-white font-medium'
                        : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                    )}
                  >
                    {child.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
