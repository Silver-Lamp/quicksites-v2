'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import {
  PlayCircle,
  Video,
  MapPinned,
  PhoneForwarded,
  Rocket,
  FileStack,
  ChevronDown,
  Mail,
  Phone,
  Plus,
  DollarSign,
  Wrench,
  Book,
  Users,
  ChefHat,
  ChartBar,
  FileText,
  Badge as BadgeIcon,
  Trophy,
  AlertCircle,
  Shield,
  Bell,
  User,
  Printer,
  DollarSignIcon,
} from 'lucide-react';
import clsx from 'clsx';

/* ---------------- Types ---------------- */
type NavItem =
  | { type: 'section'; label: string; adminOnly?: boolean }
  | {
      type: 'item';
      label: string;
      href?: string;
      icon: React.ReactNode;
      children?: { label: string; href: string; adminOnly?: boolean }[];
      adminOnly?: boolean;
    };

/* ---------------- Loading Overlay ---------------- */
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

/* ---------------- Nav Models ---------------- */
/** Non-admin can only see these */
const NAV_CORE: NavItem[] = [
  {
    type: 'item',
    label: 'QuickSites',
    href: '/',
    icon: <img src="/logo_v1.png" alt="QuickSites" className="h-10 w-auto block pointer-events-none select-none" />,
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
];

/** Admin-only extras live here (everything else you had before) */
const NAV_ADMIN: NavItem[] = [
  { type: 'item', label: 'Google Search Console', icon: <Mail size={18} />, adminOnly: true, children: [
      { label: 'Stats', href: '/admin/templates/gsc-bulk-stats' },
      { label: 'Sites', href: '/admin/gsc/sites' },
      { label: '(re)Connect', href: '/api/gsc/auth-url' },
    ] },
// ------------------------------------------------------------
{ type: 'section', label: 'Communications', adminOnly: true },
// ------------------------------------------------------------  
  { type: 'item', label: 'Sites Contact Form Email Logs', href: '/admin/email-logs', icon: <Mail size={18} />, adminOnly: true },
  { type: 'item', label: 'Twilio Call Logs', href: '/admin/call-logs', icon: <Phone size={18} />, adminOnly: true },
  {
    type: 'item',
    label: 'Platform Contact Form Inbox',
    href: '/admin/inbox',
    icon: <Mail size={18} />,
    adminOnly: true,
    children: [
      { label: 'All', href: '/admin/inbox?status=all' },
      { label: 'New', href: '/admin/inbox?status=new' },
      { label: 'Contacted', href: '/admin/inbox?status=contacted' },
      { label: 'Archived', href: '/admin/inbox?status=archived' },
    ],
  },
// ------------------------------------------------------------




// ------------------------------------------------------------
{ type: 'section', label: 'Marketing', adminOnly: true },
// ------------------------------------------------------------
{ type: 'item', label: 'Map of Opportunities', href: '/admin/the-grid', icon: <MapPinned size={18} />, adminOnly: true },
  { type: 'item', label: 'Leads', href: '/admin/leads', icon: <PhoneForwarded size={18} />, adminOnly: true },
  { type: 'item', label: 'Campaigns', icon: <Rocket size={18} />, adminOnly: true, children: [
      { label: 'View All Campaigns', href: '/admin/campaigns' },
      { label: 'Start New Campaign', href: '/admin/start-campaign' },
    ] },

// ------------------------------------------------------------
{ type: 'section', label: 'Workflow', adminOnly: true },
// ------------------------------------------------------------
{ type: 'item', label: 'Users', href: '/admin/users', icon: <Users size={18} />, adminOnly: true },
  { type: 'item', label: 'Feature Video Manager', href: '/admin/features/manage', icon: <Video size={18} />, adminOnly: true },
  { type: 'item', label: 'Features', href: '/features', icon: <PlayCircle size={18} />, adminOnly: true },
  { type: 'item', label: 'Platform Pricing', href: '/pricing', icon: <DollarSign size={18} />, adminOnly: true },
  { type: 'item', label: 'Book a demo', href: '/book', icon: <Book size={18} />, adminOnly: true },
  { type: 'item', label: 'Contact', href: '/contact', icon: <Mail size={18} />, adminOnly: true },

  // ------------------------------------------------------------
  { type: 'section', label: 'eCommerce Platform', adminOnly: false},
  // ------------------------------------------------------------
  { type: 'item', label: 'Rep My Payouts', href: '/rep/payouts', icon: <DollarSignIcon size={18}/>, adminOnly: false },
  { type: 'item', label: 'Rep My Taxes', href: '/rep/tax', icon: <DollarSignIcon size={18}/>, adminOnly: false },
  { type: 'item', label: 'Merchant Payments', href: '/merchant/payments', icon: <FileStack size={18} />, adminOnly: false },
  { type: 'item', label: 'Merchant Orders', href: '/merchant/orders', icon: <FileStack size={18} />, adminOnly: false },
  { type: 'item', label: 'Merchant Catalog', href: '/merchant/catalog', icon: <FileStack size={18} />, adminOnly: false },
  { type: 'item', label: 'Rep Referral Dashboard', href: '/rep/referrals', icon: <User size={18} />, adminOnly: false },
  { type: 'item', label: 'Checkout Success', href: '/checkout/success', icon: <FileStack size={18} />, adminOnly: false },
  { type: 'item', label: 'Checkout Cancel', href: '/checkout/cancel', icon: <FileStack size={18} />, adminOnly: false },
  // { type: 'item', label: 'Checkout Failure', href: '/checkout/failure', icon: <FileStack size={18} />, adminOnly: false },
  // { type: 'item', label: 'Checkout Pending', href: '/checkout/pending', icon: <FileStack size={18} />, adminOnly: false },
  // { type: 'item', label: 'Checkout Processing', href: '/checkout/processing', icon: <FileStack size={18} />, adminOnly: false },
  // { type: 'item', label: 'Checkout Complete', href: '/checkout/complete', icon: <FileStack size={18} />, adminOnly: false },
  // { type: 'item', label: 'Checkout Refund', href: '/checkout/refund', icon: <FileStack size={18} />, adminOnly: false },
  // { type: 'item', label: 'Checkout Refunded', href: '/checkout/refunded', icon: <FileStack size={18} />, adminOnly: false },



  // .admin below is for admin-only links
  { type: 'item', label: 'Admin Tools', href: '/admin/tools', icon: <Wrench size={18} />, adminOnly: true },
  { type: 'item', label: 'Admin Taxes: New Payout', href: '/admin/tax/payouts/new', icon: <DollarSignIcon size={18}/>, adminOnly: true },
  { type: 'item', label: 'Admin Taxes', href: '/admin/tax', icon: <DollarSignIcon size={18}/>, adminOnly: true },
  { type: 'item', label: 'View Payout Runs', href: '/admin/referrals/payout-runs', icon: <DollarSignIcon size={18}/>, adminOnly: true },
  { type: 'item', label: 'Referrals Payout Wizard', href: '/admin/referrals/payout-wizard', icon: <DollarSignIcon size={18}/>, adminOnly: true },
  { type: 'item', label: 'Billing Map', href: 'admin/billing/map', icon: <DollarSignIcon size={18}/>, adminOnly: true }, 
  { type: 'item', label: 'Merchants', href: '/admin/merchants', icon: <User size={18} />, adminOnly: true },
  { type: 'item', label: 'Referrals', href: '/admin/referrals', icon: <User size={18} />, adminOnly: true },
  { type: 'item', label: 'Catalog', href: '/admin/catalog', icon: <FileStack size={18} />, adminOnly: true },
  { type: 'item', label: 'Orders', href: '/admin/orders', icon: <FileStack size={18} />, adminOnly: true },
  { type: 'item', label: 'Payments', href: '/admin/payments', icon: <FileStack size={18} />, adminOnly: true },
  { type: 'item', label: 'Payment Accounts', href: '/admin/payment-accounts', icon: <FileStack size={18} />, adminOnly: true },
  { type: 'item', label: 'Payment Transactions', href: '/admin/payment-transactions', icon: <FileStack size={18} />, adminOnly: true },
  { type: 'item', label: 'Payment Transactions', href: '/admin/payment-transactions', icon: <FileStack size={18} />, adminOnly: true },
  
  // ------------------------------------------------------------
  { type: 'section', label: 'Delivered Menu', adminOnly: true },
// ------------------------------------------------------------
  { type: 'item', label: 'Meals', href: '/admin/meals', icon: <ChefHat size={18} />, adminOnly: true },
  { type: 'item', label: 'Chefs', href: '/chef/dashboard', icon: <ChefHat size={18} />, adminOnly: true },
  { type: 'item', label: 'Dev', href: '/admin/dev', icon: <Wrench size={18} />, adminOnly: true },

  // ------------------------------------------------------------
  // Keep your commented experimental/admin links here for convenience:
  // ------------------------------------------------------------
  // { type: 'item', label: 'Outreach (Coming Soon)', href: '/admin/outreach', icon: <Mail size={18} />, adminOnly: true },
  // { type: 'item', label: 'Revenue Estimator', href: '/admin/tools/revenue-estimator', icon: <DollarSign size={18} />, adminOnly: true },
  // { type: 'item', label: 'Posters', href: '/admin/tools/print-all', icon: <Printer size={18} />, adminOnly: true },
  // { type: 'item', label: 'Chart', href: '/admin/tools/chart', icon: <ChartBar size={18} />, adminOnly: true },
  // { type: 'item', label: 'Campaigns CSV', href: '/api/campaign-analytics', icon: <FileText size={18} />, adminOnly: true },
  // { type: 'item', label: 'Top Badges (ZIP)', href: '/api/badge/top', icon: <BadgeIcon size={18} />, adminOnly: true },
  // { type: 'item', label: 'Leaderboard', href: '/leaderboard', icon: <Trophy size={18} />, adminOnly: true },
  // { type: 'item', label: 'Analytics', href: '/admin/analytics', icon: <ChartBar size={18} />, adminOnly: true },
  // { type: 'item', label: 'Heatmap', href: '/admin/heatmap', icon: <ChartBar size={18} />, adminOnly: true },
  // { type: 'item', label: '404s', href: '/admin/not-found', icon: <AlertCircle size={18} />, adminOnly: true },
  // { type: 'item', label: 'Sitemap Diffs', href: '/docs/diffs', icon: <FileText size={18} />, adminOnly: true },
  // { type: 'item', label: 'Roles', href: '/admin/roles', icon: <Shield size={18} />, adminOnly: true },
  // { type: 'item', label: 'Notifications', href: '/admin/logs/notifications', icon: <Bell size={18} />, adminOnly: true },
  // { type: 'item', label: 'Session Logs', href: '/admin/logs/sessions', icon: <User size={18} />, adminOnly: true },
  // { type: 'item', label: 'Docs', href: '/admin/docs', icon: <Book size={18} />, adminOnly: true },
];

/* ---------------- Role helper ---------------- */
function useIsAdmin(): boolean {
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { if (!cancelled) setIsAdmin(false); return; }

        // Cache admin flag for 5 minutes per user
        const k = `qs:is_admin:${user.id}`;
        const cached = localStorage.getItem(k);
        if (cached) {
          const { v, t } = JSON.parse(cached) as { v: boolean; t: number };
          if (Date.now() - t < 5 * 60_000) { if (!cancelled) setIsAdmin(v); return; }
        }

        const { data } = await supabase
          .from('admin_users')
          .select('user_id')
          .eq('user_id', user.id)
          .maybeSingle();

        const v = !!data;
        localStorage.setItem(k, JSON.stringify({ v, t: Date.now() }));
        if (!cancelled) setIsAdmin(v);
      } catch {
        if (!cancelled) setIsAdmin(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);
  return isAdmin;
}

/* ---------------- Child Button/Link ---------------- */
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

/* ---------------- Main Component ---------------- */
export function AdminNavSections({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname();
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  const [navLoading, setNavLoading] = useState(false);
  const [inboxNewCount, setInboxNewCount] = useState<number | null>(null);
  const isAdmin = useIsAdmin();

  // Build the visible nav list based on role
  const items = useMemo<NavItem[]>(() => {
    // While role is resolving, show only core (safer UX)
    return isAdmin ? [...NAV_CORE, ...NAV_ADMIN] : [...NAV_CORE];
  }, [isAdmin]);

  // Fetch inbox "new" count only if the Inbox item exists (admin)
  useEffect(() => {
    let mounted = true;
    const hasInbox = items.some((i) => i.type === 'item' && i.href === '/admin/inbox');
    if (!hasInbox) { setInboxNewCount(null); return; }

    (async () => {
      try {
        const { count, error } = await supabase
          .from('contact_messages')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'new');
        if (!error && mounted) setInboxNewCount(count ?? 0);
      } catch {}
    })();

    return () => { mounted = false; };
  }, [items]);

  // Hide overlay once route commits
  useEffect(() => { if (navLoading) setNavLoading(false); }, [pathname]);

  // Auto-open matching submenus based on current path
  useEffect(() => {
    const updated: Record<string, boolean> = {};
    items.forEach((item) => {
      if (item.type === 'item' && item.children) {
        const isMatch = item.children.some((child) => pathname?.startsWith(child.href.split('?')[0]));
        if (isMatch || (item.href && pathname?.startsWith(item.href))) updated[item.label] = true;
      }
    });
    setOpenMenus(updated);
  }, [pathname, items]);

  const toggleMenu = (label: string) => setOpenMenus((prev) => ({ ...prev, [label]: !prev[label] }));
  const handleNavigateStart = (href: string) => { if (href && href !== pathname) setNavLoading(true); };

  return (
    <nav className="flex flex-col gap-1 px-1">
      {items.map((item, idx) => {
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
                      onClick={() => { if (child.href && child.href !== pathname) handleNavigateStart(child.href); }}
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
