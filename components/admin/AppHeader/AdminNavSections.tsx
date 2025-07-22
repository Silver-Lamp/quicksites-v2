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

type NavItem =
  | {
      type: 'section';
      label: string;
    }
  | {
      type: 'item';
      label: string;
      href?: string;
      icon: React.ReactNode;
      children?: { label: string; href: string }[];
    };

const navItems: NavItem[] = [
  { type: 'section', label: 'Core' },
  {
    type: 'item',
    label: 'Dashboard',
    href: '/admin/dashboard',
    icon: <LayoutDashboard size={18} />,
  },
  {
    type: 'item',
    label: 'Map of Opportunities',
    href: '/admin/the-grid',
    icon: <MapPinned size={18} />,
  },
  {
    type: 'item',
    label: 'Leads',
    href: '/admin/leads',
    icon: <PhoneForwarded size={18} />,
  },
  { type: 'section', label: 'Tools' },
  {
    type: 'item',
    label: 'Campaigns',
    icon: <Rocket size={18} />,
    children: [
      { label: 'All Campaigns', href: '/admin/campaigns' },
      { label: 'Start Campaign', href: '/admin/start-campaign' },
    ],
  },
  {
    type: 'item',
    label: 'Templates & Sites',
    icon: <FileStack size={18} />,
    children: [
      { label: 'Browse', href: '/admin/templates' },
      { label: 'Create', href: '/admin/templates/new' },
    ],
  },
  // {
  //   type: 'item',
  //   label: 'Analytics',
  //   href: '/admin/analytics',
  //   icon: <Activity size={18} />,
  // },
];

function NavItemButtonOrLink({
  item,
  isActive,
  isOpen,
  collapsed,
  toggleMenu,
}: {
  item: Extract<NavItem, { type: 'item' }>;
  isActive: boolean;
  isOpen: boolean;
  collapsed: boolean;
  toggleMenu: () => void;
}) {
  const baseClasses = clsx(
    'group relative w-full flex items-center gap-3 px-3 py-2 text-sm rounded transition',
    isActive ? 'bg-zinc-800 font-semibold text-white' : 'hover:bg-zinc-800 text-zinc-300'
  );

  const icon = <div className="text-white">{item.icon}</div>;
  const label = (
    <span
      className={clsx(
        'whitespace-nowrap transition-all duration-200 flex-1 text-left',
        collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto'
      )}
    >
      {item.label}
    </span>
  );
  const tooltip = collapsed && (
    <span className="absolute left-14 top-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-zinc-800 px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-50 shadow-md pointer-events-none">
      {item.label}
    </span>
  );

  // 👇 Determine if we want to default to first child for click
  const defaultHref = item.href || item.children?.[0]?.href;

  return (
    <Link
      href={defaultHref || '#'}
      onClick={(e) => {
        // only toggle menu if explicitly clicked and has children
        if (item.children) {
          e.preventDefault(); // prevent nav
          toggleMenu();
        }
      }}
      className={baseClasses}
    >
      {icon}
      {label}
      {item.children && !collapsed && (
        <ChevronDown
          className={clsx('transition-transform duration-300', isOpen ? 'rotate-180' : 'rotate-0')}
          size={16}
        />
      )}
      {tooltip}
    </Link>
  );
}


export function AdminNavSections({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname();
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const updated: Record<string, boolean> = {};
    navItems.forEach((item) => {
      if (item.type === 'item' && item.children) {
        const isMatch = item.children.some((child) => pathname?.startsWith(child.href));
        if (isMatch) updated[item.label] = true;
      }
    });
    setOpenMenus(updated);
  }, [pathname]);

  const toggleMenu = (label: string) =>
    setOpenMenus((prev) => ({ ...prev, [label]: !prev[label] }));

  return (
    <nav className="flex flex-col gap-1 px-1">
      {navItems.map((item, idx) => {
        if (item.type === 'section') {
          return !collapsed ? (
            <div
              key={`section-${item.label}-${idx}`}
              className="text-xs uppercase text-zinc-500 px-3 pt-4 pb-1 tracking-wide"
            >
              — {item.label}
            </div>
          ) : null;
        }

        const isActive = item.href && pathname?.startsWith(item.href);
        const isOpen = openMenus[item.label];

        return (
          <div key={`item-${item.label}`}>
            <NavItemButtonOrLink
              item={item}
              isActive={!!isActive}
              isOpen={isOpen}
              collapsed={collapsed}
              toggleMenu={() => item.children && toggleMenu(item.label)}
            />
            <div
              className={clsx(
                'ml-8 transition-all duration-300 overflow-hidden',
                collapsed || !isOpen ? 'max-h-0' : 'max-h-64 mt-1'
              )}
            >
              {!collapsed &&
                item.children?.map((child) => (
                  <Link
                    key={child.href}
                    href={child.href}
                    className={clsx(
                      'block text-sm px-3 py-1 rounded transition',
                      pathname?.startsWith(child.href)
                        ? 'bg-zinc-800 text-white font-medium'
                        : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                    )}
                  >
                    {child.label}
                  </Link>
                ))}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
