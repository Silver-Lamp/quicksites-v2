// components/admin/AppHeader/AdminNavSections.tsx
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
  ChevronDown,
  Mail,
  Phone,
  Search,
} from 'lucide-react';
import clsx from 'clsx';

type NavItem =
  | { type: 'section'; label: string }
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
        label: 'Outreach (Coming Soon)',
        href: '/admin/outreach',
        icon: <Mail size={18} />,
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
          { label: 'View All Campaigns', href: '/admin/campaigns' },
          { label: 'Start New Campaign', href: '/admin/start-campaign' },
        ],
      },
      {
        type: 'item',
        label: 'Templates & Sites',
        icon: <FileStack size={18} />,
        children: [
          { label: 'Browse Sites and Templates', href: '/admin/templates/list' },
          { label: 'Create New Site or Template', href: '/admin/templates/new' },
         ],
      },    
      {
        type: 'item',
        label: 'Google Search Console',
        icon: <Search size={18} />,
        children: [
          { label: 'Google Search Console Stats', href: '/admin/templates/gsc-bulk-stats' },
          { label: 'Connect', href: '/api/gsc/auth-url' },
          { label: 'Sites', href: '/admin/gsc/sites' },
        ],
      },
    
      { type: 'item', label: 'Email Logs', href: '/admin/email-logs', icon: <Mail size={18} /> },
      { type: 'item', label: 'Call Logs', href: '/admin/call-logs', icon: <Phone size={18} /> },
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

  const firstChild = item.children?.[0];
  const defaultHref = item.href || firstChild?.href || '#';

  // What the user will actually go to on click
  const targetLabel = collapsed && firstChild ? firstChild.label : item.label;

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

  // Collapsed custom tooltip now shows the real destination (first child) when applicable
  const tooltip =
    collapsed && (
      <span className="absolute left-14 top-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-zinc-800 px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-50 shadow-md pointer-events-none">
        {item.children ? `${item.label} → ${firstChild?.label ?? ''}` : item.label}
      </span>
    );

  return (
    <Link
      href={defaultHref}
      title={targetLabel}            // native tooltip mirrors target
      aria-label={targetLabel}       // improves a11y & tooltips on some UIs
      onClick={(e) => {
        if (item.children) {
          if (collapsed) return;     // collapsed: navigate to first child
          e.preventDefault();        // expanded: toggle submenu instead
          toggleMenu();
        }
      }}
      className={baseClasses}
      aria-expanded={!!item.children && !collapsed ? isOpen : undefined}
      aria-haspopup={!!item.children && !collapsed ? 'menu' : undefined}
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

        // ✅ active if parent matches OR any child matches
        const isActive =
          (item.href && pathname?.startsWith(item.href)) ||
          (item.children?.some((c) => pathname?.startsWith(c.href)) ?? false);

        const isOpen = openMenus[item.label];

        return (
          <div key={`item-${item.label}`}>
            <NavItemButtonOrLink
              item={item}
              isActive={!!isActive}
              isOpen={!!isOpen}
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
