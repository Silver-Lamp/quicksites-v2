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
  Plus,
  DollarSign,
  Printer,
  ChartBar,
  FileText,
  Badge,
  Trophy,
  AlertCircle,
  Users,
  Shield,
  Bell,
  User,
  List,
  Wrench,
  Book,
  ChefHat,
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
  {
    type: 'item',
    label: 'Dashboard',
    href: '/admin/dashboard',
    icon: <LayoutDashboard size={18} />,
  },
  {
    type: 'item',
    label: 'Sites & Templates',
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
      { label: 'Stats', href: '/admin/templates/gsc-bulk-stats' },
      { label: 'Sites', href: '/admin/gsc/sites' },
      { label: '(re)Connect', href: '/api/gsc/auth-url' },
    ],
  },
  { type: 'section', label: 'Marketing' },
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

  {
    type: 'item',
    label: 'Campaigns',
    icon: <Rocket size={18} />,
    children: [
      { label: 'View All Campaigns', href: '/admin/campaigns' },
      { label: 'Start New Campaign', href: '/admin/start-campaign' },
    ],
  },

  { type: 'section', label: 'Integrations' },
  { type: 'item', label: 'Contact Form Email Logs', href: '/admin/email-logs', icon: <Mail size={18} /> },
  { type: 'item', label: 'Twilio Call Logs', href: '/admin/call-logs', icon: <Phone size={18} /> },
  { type: 'section', label: 'DM Tools' },
  { type: 'item', label: 'Admin', href: '/admin/tools', icon: <Wrench size={18} /> },
  { type: 'item', label: 'Meals', href: '/admin/meals', icon: <ChefHat size={18} /> },
  { type: 'item', label: 'Chefs', href: '/chef/dashboard', icon: <ChefHat size={18} /> },
  { type: 'item', label: 'Dev', href: '/admin/dev', icon: <Wrench size={18} /> },
  { type: 'section', label: 'Experimental' },
  { type: 'item', label: 'Outreach (Coming Soon)', href: '/admin/outreach', icon: <Mail size={18} /> },
  { type: 'item', label: 'Revenue Estimator', href: '/admin/tools/revenue-estimator', icon: <DollarSign size={18} /> },
  { type: 'item', label: 'Posters', href: '/admin/tools/print-all', icon: <Printer size={18} /> },
  { type: 'item', label: 'Chart', href: '/admin/tools/chart', icon: <ChartBar size={18} /> },
  { type: 'item', label: 'Campaigns CSV', href: '/api/campaign-analytics', icon: <FileText size={18} /> },
  { type: 'item', label: 'Top Badges (ZIP)', href: '/api/badge/top', icon: <Badge size={18} /> },
  { type: 'item', label: 'Leaderboard', href: '/leaderboard', icon: <Trophy size={18} /> },
  { type: 'item', label: 'Analytics', href: '/admin/analytics', icon: <ChartBar size={18} /> },
  { type: 'item', label: 'Heatmap', href: '/admin/heatmap', icon: <ChartBar size={18} /> },
  { type: 'item', label: '404s', href: '/admin/not-found', icon: <AlertCircle size={18} /> },
  { type: 'item', label: 'Sitemap Diffs', href: '/docs/diffs', icon: <FileText size={18} /> },
  { type: 'item', label: 'Users', href: '/admin/users', icon: <Users size={18} /> },
  { type: 'item', label: 'Roles', href: '/admin/roles', icon: <Shield size={18} /> },
  { type: 'item', label: 'Notifications', href: '/admin/logs/notifications', icon: <Bell size={18} /> },
  { type: 'item', label: 'Session Logs', href: '/admin/logs/sessions', icon: <User size={18} /> },
  { type: 'item', label: 'Docs', href: '/admin/docs', icon: <Book size={18} /> },
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

  const tooltip =
    collapsed && (
      <span className="absolute left-14 top-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-zinc-800 px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-50 shadow-md pointer-events-none">
        {item.children ? `${item.label} → ${firstChild?.label ?? ''}` : item.label}
      </span>
    );

  return (
    <Link
      href={defaultHref}
      title={targetLabel}
      aria-label={targetLabel}
      onClick={(e) => {
        if (item.children) {
          if (collapsed) return; // collapsed: navigate to first child
          e.preventDefault(); // expanded: toggle submenu
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
                item.children?.map((child) => {
                  const isActiveChild = pathname?.startsWith(child.href);
                  const isNewTemplate = child.href === '/admin/templates/new';

                  // Standard child link classes
                  const baseChild =
                    'block text-sm px-3 py-1 rounded transition';

                  // Special green "New Template" button
                  const newBtnClasses = clsx(
                    'mt-1 inline-flex items-center gap-2 rounded-md px-3 py-1.5 font-medium shadow-sm',
                    isActiveChild
                      ? 'bg-emerald-700 text-white ring-1 ring-emerald-300/30'
                      : 'bg-emerald-600 text-white hover:bg-emerald-500'
                  );

                  const normalClasses = clsx(
                    baseChild,
                    isActiveChild
                      ? 'bg-zinc-800 text-white font-medium'
                      : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                  );

                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      className={isNewTemplate ? newBtnClasses : normalClasses}
                      title={isNewTemplate ? 'Create a new template or site' : child.label}
                    >
                      {isNewTemplate && <Plus size={14} />}
                      {isNewTemplate ? 'New Template' : child.label}
                    </Link>
                  );
                })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
