'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { createClient as createBrowserClient } from '@supabase/supabase-js';
import {
  PlayCircle,
  Video,
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
  Badge as BadgeIcon,
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

// ---------------- Types ----------------
type NavItem =
  | { type: 'section'; label: string }
  | {
      type: 'item';
      label: string;
      href?: string;
      icon: React.ReactNode;
      children?: { label: string; href: string }[];
    };

// ---------------- Loading Overlay ----------------
function LoadingOverlay({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex items-center justify-center"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-3">
        <img src="/logo_v1.png" alt="Loading…" className="h-12 w-auto opacity-95 drop-shadow animate-pulse" />
        <div className="h-8 w-8 rounded-full border-2 border-white/40 border-t-white animate-spin" />
        <div className="text-white/80 text-sm">Loading…</div>
      </div>
    </div>
  );
}

// ---------------- Nav Model ----------------
const navItems: NavItem[] = [
  {
    type: 'item',
    label: 'QuickSites',
    href: '/',
    icon: <img src="/logo_v1.png" alt="QuickSites" className="h-10 w-auto block pointer-events-none select-none" />,
  },
  // { type: 'item', label: 'Dashboard', href: '/admin/dashboard', icon: <LayoutDashboard size={18} /> },
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
  { type: 'item', label: 'Map of Opportunities', href: '/admin/the-grid', icon: <MapPinned size={18} /> },
  { type: 'item', label: 'Leads', href: '/admin/leads', icon: <PhoneForwarded size={18} /> },
  {
    type: 'item',
    label: 'Campaigns',
    icon: <Rocket size={18} />,
    children: [
      { label: 'View All Campaigns', href: '/admin/campaigns' },
      { label: 'Start New Campaign', href: '/admin/start-campaign' },
    ],
  },
  { type: 'section', label: 'Workflow' },
  { type: 'item', label: 'Platform Pricing', href: '/pricing', icon: <DollarSign size={18} /> },

  { type: 'item', label: 'Features', href: '/features', icon: <PlayCircle size={18} /> },
  { type: 'item', label: 'Book a demo', href: '/book', icon: <Book size={18} /> },
  { type: 'item', label: 'Feature Video Manager', href: '/admin/features/manage', icon: <Video size={18} /> },
  { type: 'item', label: 'Dev', href: '/admin/dev', icon: <Wrench size={18} /> },

  {
    type: 'item',
    label: 'Platform Contact Form Inbox',
    href: '/admin/inbox',
    icon: <Mail size={18} />,
    children: [
      { label: 'All', href: '/admin/inbox?status=all' },
      { label: 'New', href: '/admin/inbox?status=new' },
      { label: 'Contacted', href: '/admin/inbox?status=contacted' },
      { label: 'Archived', href: '/admin/inbox?status=archived' },
    ],
  },

  { type: 'section', label: 'Integrations' },
  { type: 'item', label: 'Sites Contact Form Email Logs', href: '/admin/email-logs', icon: <Mail size={18} /> },
  { type: 'item', label: 'Twilio Call Logs', href: '/admin/call-logs', icon: <Phone size={18} /> },
  { type: 'section', label: 'DM Tools' },
  { type: 'item', label: 'Admin', href: '/admin/tools', icon: <Wrench size={18} /> },
  { type: 'item', label: 'Meals', href: '/admin/meals', icon: <ChefHat size={18} /> },
  { type: 'item', label: 'Chefs', href: '/chef/dashboard', icon: <ChefHat size={18} /> },
  { type: 'item', label: 'Dev', href: '/admin/dev', icon: <Wrench size={18} /> },
  // { type: 'section', label: 'Experimental' },
  // { type: 'item', label: 'Outreach (Coming Soon)', href: '/admin/outreach', icon: <Mail size={18} /> },
  // { type: 'item', label: 'Revenue Estimator', href: '/admin/tools/revenue-estimator', icon: <DollarSign size={18} /> },
  // { type: 'item', label: 'Posters', href: '/admin/tools/print-all', icon: <Printer size={18} /> },
  // { type: 'item', label: 'Chart', href: '/admin/tools/chart', icon: <ChartBar size={18} /> },
  // { type: 'item', label: 'Campaigns CSV', href: '/api/campaign-analytics', icon: <FileText size={18} /> },
  // { type: 'item', label: 'Top Badges (ZIP)', href: '/api/badge/top', icon: <BadgeIcon size={18} /> },
  // { type: 'item', label: 'Leaderboard', href: '/leaderboard', icon: <Trophy size={18} /> },
  // { type: 'item', label: 'Analytics', href: '/admin/analytics', icon: <ChartBar size={18} /> },
  // { type: 'item', label: 'Heatmap', href: '/admin/heatmap', icon: <ChartBar size={18} /> },
  // { type: 'item', label: '404s', href: '/admin/not-found', icon: <AlertCircle size={18} /> },
  // { type: 'item', label: 'Sitemap Diffs', href: '/docs/diffs', icon: <FileText size={18} /> },
  // { type: 'item', label: 'Users', href: '/admin/users', icon: <Users size={18} /> },
  // { type: 'item', label: 'Roles', href: '/admin/roles', icon: <Shield size={18} /> },
  // { type: 'item', label: 'Notifications', href: '/admin/logs/notifications', icon: <Bell size={18} /> },
  // { type: 'item', label: 'Session Logs', href: '/admin/logs/sessions', icon: <User size={18} /> },
  // { type: 'item', label: 'Docs', href: '/admin/docs', icon: <Book size={18} /> },
];

// ---------------- Child Button/Link ----------------
function NavItemButtonOrLink({
  item,
  isActive,
  isOpen,
  collapsed,
  toggleMenu,
  onNavigateStart,
  inboxNewCount,
}: {
  item: Extract<NavItem, { type: 'item' }>;
  isActive: boolean;
  isOpen: boolean;
  collapsed: boolean;
  toggleMenu: () => void;
  onNavigateStart: (href: string) => void;
  inboxNewCount?: number | null;
}) {
  const pathname = usePathname();
  const baseClasses = clsx(
    'group relative w-full flex items-center gap-3 px-3 py-2 text-sm rounded transition',
    isActive ? 'bg-zinc-800 font-semibold text-white' : 'hover:bg-zinc-800 text-zinc-300',
    collapsed && 'justify-center'
  );

  const firstChild = item.children?.[0];
  const defaultHref = item.href || firstChild?.href || '#';
  const targetLabel = collapsed && firstChild ? firstChild.label : item.label;

  const icon = (
    <div className={clsx('text-white shrink-0 flex items-center justify-center', collapsed ? 'w-10' : 'w-10')}>
      {item.icon}
    </div>
  );

  const isInbox = item.href === '/admin/inbox';
  const count = inboxNewCount ?? 0;

  const label = (
    <span
      className={clsx('whitespace-nowrap transition-all duration-200 flex-1 text-left', collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto')}
    >
      {item.label}
      {isInbox && count > 0 && (
        <span className="ml-2 inline-flex items-center justify-center rounded-full bg-red-600 text-white text-[10px] leading-none h-4 min-w-[16px] px-1 align-middle">
          {count > 99 ? '99+' : count}
        </span>
      )}
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
          if (collapsed) {
            if (defaultHref && pathname !== defaultHref) onNavigateStart(defaultHref);
            return;
          }
          e.preventDefault();
          toggleMenu();
          return;
        }
        if (defaultHref && pathname !== defaultHref) onNavigateStart(defaultHref);
      }}
      className={baseClasses}
      aria-expanded={!!item.children && !collapsed ? isOpen : undefined}
      aria-haspopup={!!item.children && !collapsed ? 'menu' : undefined}
    >
      {icon}
      {label}
      {item.children && !collapsed && (
        <ChevronDown className={clsx('transition-transform duration-300', isOpen ? 'rotate-180' : 'rotate-0')} size={16} />
      )}
      {tooltip}
    </Link>
  );
}

// ---------------- Main Component ----------------
export function AdminNavSections({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname();
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  const [navLoading, setNavLoading] = useState(false);
  const [inboxNewCount, setInboxNewCount] = useState<number | null>(null);

  // Fetch inbox "new" count on mount (client-side via RLS)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        if (!url || !anon) return;
        const supabase = createBrowserClient(url, anon);
        const { count, error } = await supabase
          .from('contact_messages')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'new');
        if (!error && mounted) setInboxNewCount(count ?? 0);
      } catch {}
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Hide overlay once route commits
  useEffect(() => {
    if (navLoading) setNavLoading(false);
  }, [pathname]);

  // Auto-open matching submenus based on current path
  useEffect(() => {
    const updated: Record<string, boolean> = {};
    navItems.forEach((item) => {
      if (item.type === 'item' && item.children) {
        const isMatch = item.children.some((child) => pathname?.startsWith(child.href.split('?')[0]));
        if (isMatch || (item.href && pathname?.startsWith(item.href))) updated[item.label] = true;
      }
    });
    setOpenMenus(updated);
  }, [pathname]);

  const toggleMenu = (label: string) => setOpenMenus((prev) => ({ ...prev, [label]: !prev[label] }));
  const handleNavigateStart = (href: string) => {
    if (href && href !== pathname) setNavLoading(true);
  };

  return (
    <nav className="flex flex-col gap-1 px-1">
      {navItems.map((item, idx) => {
        if (item.type === 'section') {
          return !collapsed ? (
            <div key={`section-${item.label}-${idx}`} className="text-xs uppercase text-zinc-500 px-3 pt-4 pb-1 tracking-wide">
              — {item.label}
            </div>
          ) : null;
        }

        const isActive =
          (item.href && pathname?.startsWith(item.href)) ||
          (item.children?.some((c) => pathname?.startsWith(c.href.split('?')[0])) ?? false);

        const isOpen = openMenus[item.label];

        return (
          <div key={`item-${item.label}`}>
            <NavItemButtonOrLink
              item={item}
              isActive={!!isActive}
              isOpen={!!isOpen}
              collapsed={collapsed}
              toggleMenu={() => item.children && toggleMenu(item.label)}
              onNavigateStart={handleNavigateStart}
              inboxNewCount={inboxNewCount ?? undefined}
            />

            <div className={clsx('ml-8 transition-all duration-300 overflow-hidden', collapsed || !isOpen ? 'max-h-0' : 'max-h-64 mt-1')}>
              {!collapsed &&
                item.children?.map((child) => {
                  const isActiveChild = pathname?.startsWith(child.href.split('?')[0]);
                  const isNewTemplate = child.href === '/admin/templates/new';

                  const baseChild = 'block text-sm px-3 py-1 rounded transition';
                  const newBtnClasses = clsx(
                    'mt-1 inline-flex items-center gap-2 rounded-md px-3 py-1.5 font-medium shadow-sm',
                    isActiveChild ? 'bg-emerald-700 text-white ring-1 ring-emerald-300/30' : 'bg-emerald-600 text-white hover:bg-emerald-500'
                  );
                  const normalClasses = clsx(baseChild, isActiveChild ? 'bg-zinc-800 text-white font-medium' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white');

                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      className={isNewTemplate ? newBtnClasses : normalClasses}
                      title={isNewTemplate ? 'Create a new template or site' : child.label}
                      onClick={() => {
                        if (child.href && child.href !== pathname) handleNavigateStart(child.href);
                      }}
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
      <LoadingOverlay show={navLoading} />
    </nav>
  );
}
