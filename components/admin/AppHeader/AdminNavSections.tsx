'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useMemo, useRef } from 'react';
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
  Activity,
  Check,
  ShoppingCart,
  Package,
  Boxes,
  CreditCard,
  Megaphone,
  LayoutGrid,
  Globe,
  Search,
  Filter,
  Gauge,
} from 'lucide-react';
import clsx from 'clsx';
import { useBrand } from '@/app/providers';

/* ---------------- Safe localStorage ---------------- */
const safeLS = {
  get<T = any>(k: string): T | null {
    try {
      const raw = localStorage.getItem(k);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },
  set(k: string, v: any) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {
      console.warn('[nav] localStorage.set failed:', e);
    }
  },
  remove(k: string) {
    try {
      localStorage.removeItem(k);
    } catch {}
  },
};

const OPEN_MENUS_KEY = 'qs:nav:open_menus:v1';
const INBOX_COUNT_KEY = 'qs:nav:inbox_new_count:v1';
const ADMIN_TTL_MS = 5 * 60_000; // 5 min
const INBOX_TTL_MS = 60_000;     // 60 sec

const slugify = (s: string) =>
  String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

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
  const { name, logoUrl } = useBrand();
  const brandLogo = logoUrl || '/logo_v1.png';
  if (!show) return null;
  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex items-center justify-center"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-3">
        <img
          src={brandLogo}
          alt={`${name} logo`}
          className="h-12 w-auto opacity-95 drop-shadow animate-pulse"
        />
        <div className="h-8 w-8 rounded-full border-2 border-white/40 border-t-white animate-spin" />
        <div className="text-white/80 text-sm">Loading…</div>
      </div>
    </div>
  );
}

/* ---------------- Merchant nav (shown to everyone, not just admins) ----------------
   These used to live inside NAV_ADMIN (gated by isAdmin), so real merchants never saw
   them. They're the day-to-day surfaces for anyone running a store. */
const NAV_MERCHANT: NavItem[] = [
  { type: 'section', label: 'Commerce' },
  { type: 'item', label: 'Getting started', href: '/merchant', icon: <Rocket size={18} /> },
  { type: 'item', label: 'Orders', href: '/merchant/orders', icon: <ShoppingCart size={18} /> },
  { type: 'item', label: 'Catalog', href: '/merchant/catalog', icon: <Package size={18} /> },
  { type: 'item', label: 'Inventory', href: '/merchant/inventory', icon: <Boxes size={18} /> },
  { type: 'item', label: 'Payments', href: '/merchant/payments', icon: <CreditCard size={18} /> },

  { type: 'section', label: 'Customers' },
  { type: 'item', label: 'Customers', href: '/merchant/customers', icon: <Users size={18} /> },
  { type: 'item', label: 'Campaigns', href: '/merchant/campaigns', icon: <Megaphone size={18} /> },

  { type: 'section', label: 'Partner' },
  { type: 'item', label: 'Referrals', href: '/rep/referrals', icon: <User size={18} /> },
  { type: 'item', label: 'Payouts', href: '/rep/payouts', icon: <DollarSign size={18} /> },
  { type: 'item', label: 'Taxes', href: '/rep/tax', icon: <FileText size={18} /> },
];

/* ---------------- Admin-only extras ----------------
   Grouped for discoverability: Growth (lead-gen/outreach) → Commerce → Payouts &
   Taxes → Communications → System → Platform. Dense clusters collapse into submenus
   so the top level stays scannable. Every link is preserved from the old flat list. */
const NAV_ADMIN: NavItem[] = [
  /* Overview — the cross-domain ops dashboard (inventory · markets · clients + next steps). */
  { type: 'section', label: 'Overview', adminOnly: true },
  { type: 'item', label: 'Operations', href: '/admin/ops', icon: <Activity size={18} />, adminOnly: true },
  { type: 'item', label: 'Domain Costs', href: '/admin/domains/costs', icon: <Globe size={18} />, adminOnly: true },

  /* Growth — the lead-gen + outreach engine, unified into one workspace (/admin/growth).
     The old scattered surfaces (Map of Opportunities, Leads, legacy Campaigns) ran on the
     retired leads/campaigns tables; they're folded out of the nav in favor of the new
     outreach_prospects/geo_industry_campaigns stack. Both items open the same workspace. */
  { type: 'section', label: 'Growth', adminOnly: true },
  { type: 'item', label: 'Businesses Near Me', href: '/admin/growth?tab=prospects', icon: <MapPinned size={18} />, adminOnly: true },
  { type: 'item', label: 'Outreach Pipeline', href: '/admin/growth?tab=pipeline', icon: <Rocket size={18} />, adminOnly: true },
  { type: 'item', label: 'Local-services Offer', href: '/local-services', icon: <Megaphone size={18} />, adminOnly: true },
  { type: 'item', label: 'Print Orders', href: '/admin/print-orders', icon: <Printer size={18} />, adminOnly: true },

  /* Restaurants — the delivered.menu / per-order business, split out from Growth because
     the model is entirely different (a take-rate on online orders, not geo-domain rent).
     Its own funnel cockpits (order-intent demand → launch readiness) + the owner offer.
     Discovery + the outreach pipeline stay in Growth: they feed both businesses. */
  { type: 'section', label: 'Restaurants', adminOnly: true },
  { type: 'item', label: 'Location Domains', href: '/admin/restaurant-domains', icon: <Trophy size={18} />, adminOnly: true },
  { type: 'item', label: 'Demand Funnel', href: '/admin/demand-funnel', icon: <Filter size={18} />, adminOnly: true },
  { type: 'item', label: 'Go-live Readiness', href: '/admin/go-live', icon: <Gauge size={18} />, adminOnly: true },
  { type: 'item', label: 'Restaurant Offer', href: '/restaurants', icon: <ChefHat size={18} />, adminOnly: true },

  /* Revenue, payouts & taxes. (The per-merchant Orders/Catalog/Payments admin pages
     don't exist yet — merchants use the /merchant/* surfaces in NAV_MERCHANT.) */
  { type: 'section', label: 'Revenue & Payouts', adminOnly: true },
  { type: 'item', label: 'Platform Revenue', href: '/admin/revenue', icon: <DollarSign size={18} />, adminOnly: true },
  {
    type: 'item', label: 'Payouts', icon: <DollarSign size={18} />, adminOnly: true,
    children: [
      { label: 'Partner Payouts', href: '/admin/partners/payouts' },
      { label: 'Referral Payout Runs', href: '/admin/referrals/payout-runs' },
      { label: 'Referral Payout Wizard', href: '/admin/referrals/payout-wizard' },
    ],
  },
  {
    type: 'item', label: 'Taxes', icon: <FileText size={18} />, adminOnly: true,
    children: [
      { label: 'Admin Taxes', href: '/admin/tax' },
      { label: 'New Payout', href: '/admin/tax/payouts/new' },
    ],
  },
  { type: 'item', label: 'Referrals', href: '/admin/referrals', icon: <User size={18} />, adminOnly: true },
  { type: 'item', label: 'Billing Map', href: '/admin/billing/map', icon: <ChartBar size={18} />, adminOnly: true },

  /* Communications. */
  { type: 'section', label: 'Communications', adminOnly: true },
  {
    type: 'item', label: 'Google Search Console', icon: <Globe size={18} />, adminOnly: true,
    children: [
      { label: 'Stats', href: '/admin/templates/gsc-bulk-stats' },
      { label: 'Sites', href: '/admin/gsc/sites' },
      { label: '(re)Connect', href: '/api/gsc/auth-url' },
    ],
  },
  { type: 'item', label: 'Contact Form Email Logs', href: '/admin/email-logs', icon: <Mail size={18} />, adminOnly: true },
  { type: 'item', label: 'Twilio Call Logs', href: '/admin/call-logs', icon: <Phone size={18} />, adminOnly: true },
  {
    type: 'item', label: 'Platform Inbox', href: '/admin/inbox', icon: <Mail size={18} />, adminOnly: true,
    children: [
      { label: 'All', href: '/admin/inbox?status=all' },
      { label: 'New', href: '/admin/inbox?status=new' },
      { label: 'Contacted', href: '/admin/inbox?status=contacted' },
      { label: 'Archived', href: '/admin/inbox?status=archived' },
    ],
  },

  /* System — ops + dev tooling. */
  { type: 'section', label: 'System', adminOnly: true },
  { type: 'item', label: 'AI Spend', href: '/admin/ai-costs', icon: <DollarSign size={18} />, adminOnly: true },
  { type: 'item', label: 'AI Pricing', href: '/admin/settings/ai-pricing', icon: <ChartBar size={18} />, adminOnly: true },
  { type: 'item', label: 'Cron Health', href: '/admin/cron', icon: <Activity size={18} />, adminOnly: true },
  { type: 'item', label: 'Tasks', href: '/admin/tasks', icon: <Check size={18} />, adminOnly: true },
  { type: 'item', label: 'Users', href: '/admin/users', icon: <Users size={18} />, adminOnly: true },
  { type: 'item', label: 'Admin Tools', href: '/admin/tools', icon: <Wrench size={18} />, adminOnly: true },
  { type: 'item', label: 'Agent Runner', href: '/admin/agents/block', icon: <Wrench size={18} />, adminOnly: true },
  { type: 'item', label: 'Dev', href: '/admin/dev', icon: <Wrench size={18} />, adminOnly: true },

  /* Platform — public marketing surfaces. */
  { type: 'section', label: 'Platform', adminOnly: true },
  { type: 'item', label: 'Features', href: '/features', icon: <PlayCircle size={18} />, adminOnly: true },
  { type: 'item', label: 'Feature Videos', href: '/admin/features/manage', icon: <Video size={18} />, adminOnly: true },
  { type: 'item', label: 'Platform Pricing', href: '/pricing', icon: <DollarSign size={18} />, adminOnly: true },
  { type: 'item', label: 'Book a demo', href: '/book', icon: <Book size={18} />, adminOnly: true },
  { type: 'item', label: 'Contact', href: '/contact', icon: <Mail size={18} />, adminOnly: true },
];

/* Flatten the nav into searchable leaves (each item + each child), tagged with its
   section, for the quick-find filter. */
type NavLeaf = { label: string; href: string; icon: React.ReactNode; group: string };
function flattenNavLeaves(list: NavItem[]): NavLeaf[] {
  const out: NavLeaf[] = [];
  let group = '';
  for (const it of list) {
    if (it.type === 'section') { group = it.label; continue; }
    if (it.href) out.push({ label: it.label, href: it.href, icon: it.icon, group });
    for (const c of it.children ?? []) {
      if (c.label.startsWith('__')) continue; // skip inline tool slots
      out.push({ label: `${it.label}: ${c.label}`, href: c.href, icon: it.icon, group });
    }
  }
  return out;
}

/* ---------------- Custom (Elect Info / campaign tools) ----------------
   Pinned to the very bottom of the sidebar under a "Custom" header. */
const NAV_ELECTINFO: NavItem[] = [
  { type: 'section', label: 'Custom', adminOnly: true },

  {
    type: 'item',
    label: 'Candidate Pages',
    icon: <Users size={18} />,
    adminOnly: true,
    children: [
      { label: 'New Candidate', href: '/admin/candidates/new', adminOnly: true },
      { label: 'Demo Page',     href: '/candidate/demo',       adminOnly: false },
    ],
  },

  {
    type: 'item',
    label: 'QR & Short Links',
    icon: <Printer size={18} />,
    adminOnly: true,
    children: [
      { label: 'Short Links', href: '/admin/short-links', adminOnly: true },
      // The “quick jump” will render inline below via a custom slot.
      { label: '__quick_slug_jump__', href: '#', adminOnly: true },
    ],
  },

];


/* ---------------- Role helper (cached) ---------------- */
function useIsAdmin(): boolean {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          if (!cancelled) setIsAdmin(false);
          return;
        }

        const k = `qs:is_admin:${user.id}`;
        const cached = safeLS.get<{ v: boolean; t: number }>(k);
        if (cached && Date.now() - cached.t < ADMIN_TTL_MS) {
          if (!cancelled) setIsAdmin(cached.v);
          return;
        }

        const { data } = await supabase
          .from('admin_users')
          .select('user_id')
          .eq('user_id', user.id)
          .maybeSingle();

        const v = !!data;
        safeLS.set(k, { v, t: Date.now() });
        if (!cancelled) setIsAdmin(v);
      } catch {
        if (!cancelled) setIsAdmin(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return isAdmin;
}

/* ---------------- Brand Switcher ---------------- */
type OrgLite = { id: string; slug: string; name: string; logo_url: string | null };

function BrandSwitcher({
  collapsed,
  onWillSwitch,
  isPlatformAdmin, // ← NEW
}: {
  collapsed: boolean;
  onWillSwitch: () => void;
  isPlatformAdmin: boolean; // ← NEW
}) {
  const { name, logoUrl, slug } = useBrand();
  const brandLogo = logoUrl || '/logo_v1.png';
  const [open, setOpen] = useState(false);
  const [orgs, setOrgs] = useState<OrgLite[] | null>(null);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const fetchOrgs = async () => {
    setLoading(true);
    try {
      if (isPlatformAdmin) {
        // Super admin: list ALL orgs (no membership required)
        const { data } = await supabase
          .from('organizations_public')
          .select('id, slug, name, logo_url')
          .order('name', { ascending: true });
        setOrgs(
          (data ?? []).map((r: any) => ({
            id: String(r.id),
            slug: String(r.slug),
            name: String(r.name),
            logo_url: r.logo_url ?? null,
          }))
        );
      } else {
        // Regular user: list orgs they belong to (fallback to current)
        const { data: me } = await supabase.auth.getUser();
        const uid = me?.user?.id;
        if (!uid) {
          setOrgs([{ id: 'current', slug, name, logo_url: brandLogo }]);
          setLoading(false);
          return;
        }

        const { data: mem } = await supabase
          .from('org_members')
          .select('org_id')
          .eq('user_id', uid);

        const ids = (mem ?? []).map((m: any) => m.org_id).filter(Boolean);
        if (!ids.length) {
          setOrgs([{ id: 'current', slug, name, logo_url: brandLogo }]);
          setLoading(false);
          return;
        }

        const { data: rows } = await supabase
          .from('organizations_public')
          .select('id, slug, name, logo_url')
          .in('id', ids);

        setOrgs(
          (rows ?? []).map((r: any) => ({
            id: String(r.id),
            slug: String(r.slug),
            name: String(r.name),
            logo_url: r.logo_url ?? null,
          }))
        );
      }
    } catch {
      setOrgs([{ id: 'current', slug, name, logo_url: brandLogo }]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!open) return;
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onEsc);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const switchTo = (newSlug: string) => {
    if (!newSlug || newSlug === slug) { setOpen(false); return; }
    onWillSwitch();
    const url = new URL(window.location.href);
    url.searchParams.set('org', newSlug); // middleware captures and sets cookie
    window.location.assign(url.toString());
  };

  return (
    <div ref={ref} className="px-1 pt-1 pb-2">
      <button
        type="button"
        onClick={async () => {
          if (!open && orgs === null) await fetchOrgs();
          setOpen((o) => !o);
        }}
        className={clsx(
          'group relative w-full flex items-center gap-3 px-3 py-2 text-sm rounded transition',
          'hover:bg-zinc-800 text-zinc-300',
          collapsed && 'justify-center'
        )}
        aria-haspopup="menu"
        aria-expanded={open}
        title={name}
      >
        <div className={clsx('shrink-0 flex items-center justify-center', collapsed ? 'w-10' : 'w-10')}>
          <img src={brandLogo} alt={`${name} logo`} className="h-10 w-auto block pointer-events-none select-none" />
        </div>
        <span
          className={clsx(
            'whitespace-nowrap transition-all duration-200 flex-1 text-left',
            collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto'
          )}
        >
          {name}
        </span>
        {!collapsed && (
          <ChevronDown size={16} className={clsx('transition-transform', open ? 'rotate-180' : 'rotate-0')} />
        )}
        {collapsed && (
          <span className="absolute left-14 top-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-zinc-800 px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-50 shadow-md pointer-events-none">
            Switch organization
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className={clsx(
            'mt-1 ml-3 mr-2 rounded-lg border border-white/10 bg-zinc-900/95 shadow-xl',
            'backdrop-blur supports-[backdrop-filter]:bg-zinc-900/70',
            collapsed ? 'absolute left-14 top-2 z-[10000] w-56' : ''
          )}
        >
          <div className="max-h-72 overflow-auto py-1">
            {loading && <div className="px-3 py-2 text-xs text-zinc-400">Loading orgs…</div>}
            {!loading && (orgs ?? []).map((o) => {
              const active = o.slug === slug;
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => switchTo(o.slug)}
                  className={clsx(
                    'w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-zinc-800',
                    active && 'bg-zinc-800'
                  )}
                >
                  <img src={o.logo_url || '/logo_v1.png'} alt="" className="h-5 w-5 rounded-sm object-contain" />
                  <span className="flex-1">{o.name}</span>
                  {active && <Check size={14} className="text-emerald-400" />}
                </button>
              );
            })}
            {!loading && (orgs ?? []).length === 0 && (
              <div className="px-3 py-2 text-xs text-zinc-400">No organizations.</div>
            )}
          </div>
          <div className="border-t border-white/10 px-3 py-2">
            <Link href="/admin/org" className="block text-xs text-zinc-300 hover:text-white" onClick={() => setOpen(false)}>
              Manage organization
            </Link>
          </div>
        </div>
      )}
    </div>
  );
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
  domId,        // NEW
  kbdSelected,  // NEW
}: {
  item: Extract<NavItem, { type: 'item' }>;
  isActive: boolean;
  isOpen: boolean;
  collapsed: boolean;
  toggleMenu: () => void;
  onNavigateStart: (href: string) => void;
  inboxNewCount?: number | null;
  domId?: string;        // NEW
  kbdSelected?: boolean; // NEW
}) {
  const pathname = usePathname();
  const baseClasses = clsx(
    'group relative w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors',
    // Active gets a subtle fill + a sky accent bar on the left; inactive stays quiet
    // and brightens on hover.
    isActive
      ? 'bg-white/[0.07] font-medium text-white before:absolute before:left-0 before:top-1/2 before:h-5 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-sky-400'
      : 'text-zinc-400 hover:bg-white/[0.04] hover:text-white',
    collapsed && 'justify-center',
    kbdSelected && 'ring-2 ring-purple-500 ring-offset-0 ring-offset-transparent'
  );

  const firstChild = item.children?.[0];
  const defaultHref = item.href || firstChild?.href || '#';
  const targetLabel = collapsed && firstChild ? firstChild.label : item.label;

  const icon = (
    <div className="shrink-0 flex w-10 items-center justify-center [&_svg]:h-[18px] [&_svg]:w-[18px]">
      {item.icon}
    </div>
  );

  const isInbox = item.href === '/admin/inbox';
  const count = inboxNewCount ?? 0;

  const label = (
    <span
      className={clsx(
        'whitespace-nowrap transition-all duration-200 flex-1 text-left',
        collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto'
      )}
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
      id={domId}
      role="menuitem"
      aria-selected={kbdSelected || undefined}
      aria-current={isActive ? 'page' : undefined}
      tabIndex={-1}
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

function QuickSlugJump({
  collapsed,
  onNavigateStart,
}: {
  collapsed: boolean;
  onNavigateStart: (href: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState('');

  useEffect(() => {
    if (!open) setSlug('');
  }, [open]);

  const go = () => {
    const s = (slug || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
    if (!s) return;
    setOpen(false);
    const href = `/admin/candidate/${s}/print`;
    onNavigateStart(href);
    window.location.assign(href);
  };

  return (
    <div className="px-3 py-2">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full rounded-md border border-zinc-700/80 bg-zinc-900/50 px-3 py-1.5 text-left text-sm text-zinc-300 hover:text-white hover:border-zinc-500"
          title="Open quick jump"
        >
          Go to Print & QR by slug…
        </button>
      ) : (
        <div className="rounded-md border border-zinc-700/80 bg-zinc-900/70 p-2">
          <div className="text-xs text-zinc-400 mb-1">Candidate slug</div>
          <input
            autoFocus
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') go();
              if (e.key === 'Escape') setOpen(false);
            }}
            placeholder="e.g. alex-rivera"
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm text-white outline-none focus:border-zinc-500"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={go}
              className="rounded bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-500"
            >
              Go
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:text-white hover:border-zinc-500"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Main Component ---------------- */
export function AdminNavSections({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname();
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  const [navLoading, setNavLoading] = useState(false);
  const [inboxNewCount, setInboxNewCount] = useState<number | null>(null);
  const [cleared, setCleared] = useState(false);
  const [query, setQuery] = useState('');
  const isAdmin = useIsAdmin();

  const navRef = useRef<HTMLDivElement | null>(null);           // NEW
  const [selectedIdx, setSelectedIdx] = useState<number>(0);    // NEW

  const { name: brandName, logoUrl } = useBrand();
  const brandLogo = logoUrl || '/logo_v1.png';

  // Core nav (without brand; brand handled by BrandSwitcher). Flat rows under the
  // "Sites" header — consistent with every other section (Commerce/Customers/…),
  // instead of a nested dropdown that duplicated the header + a lone green button.
  const coreItems = useMemo<NavItem[]>(
    () => [
      { type: 'section', label: 'Sites' },
      { type: 'item', label: 'Browse sites', href: '/admin/templates/list', icon: <LayoutGrid size={18} /> },
      { type: 'item', label: 'New site', href: '/admin/templates/new', icon: <Plus size={18} /> },
    ],
    []
  );

  // Merchant nav is for everyone; the admin sections layer on top for platform admins.
  const items = useMemo<NavItem[]>(
    () =>
      isAdmin
        ? [...coreItems, ...NAV_MERCHANT, ...NAV_ADMIN, ...NAV_ELECTINFO]
        : [...coreItems, ...NAV_MERCHANT],
    [isAdmin, coreItems]
  );

  // Quick-find: flatten every nav destination into a searchable list.
  const leaves = useMemo(() => flattenNavLeaves(items), [items]);
  const q = query.trim().toLowerCase();
  const results = useMemo(
    () => (q ? leaves.filter((l) => l.label.toLowerCase().includes(q) || l.group.toLowerCase().includes(q)) : []),
    [leaves, q],
  );

  /* -------- persist/restore open submenu state -------- */
  useEffect(() => {
    const cached = safeLS.get<Record<string, boolean>>(OPEN_MENUS_KEY);
    if (cached) setOpenMenus(cached);
  }, []);
  useEffect(() => {
    safeLS.set(OPEN_MENUS_KEY, openMenus);
  }, [openMenus]);

  // Auto-open matching submenus based on current path (merge with cache)
  useEffect(() => {
    const merged: Record<string, boolean> = { ...(safeLS.get<Record<string, boolean>>(OPEN_MENUS_KEY) || {}) };
    items.forEach((item) => {
      if (item.type === 'item' && item.children) {
        const matchChild = item.children.some((c) => pathname?.startsWith(c.href.split('?')[0]));
        const matchSelf = item.href ? pathname?.startsWith(item.href) : false;
        if (matchChild || matchSelf) merged[item.label] = true;
      }
    });
    setOpenMenus(merged);
  }, [pathname, items]);

  /* -------- inbox "new" count -------- */
  useEffect(() => {
    let mounted = true;
    const hasInbox = items.some((i) => i.type === 'item' && i.href === '/admin/inbox');
    if (!hasInbox) {
      setInboxNewCount(null);
      return;
    }

    const cached = safeLS.get<{ count: number; t: number }>(INBOX_COUNT_KEY);
    if (cached && Date.now() - cached.t < INBOX_TTL_MS) {
      setInboxNewCount(cached.count);
    }

    const fetchCount = async () => {
      try {
        const { count, error } = await supabase
          .from('contact_messages')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'new');
        if (!error && mounted) {
          setInboxNewCount(count ?? 0);
          safeLS.set(INBOX_COUNT_KEY, { count: count ?? 0, t: Date.now() });
        }
      } catch {}
    };

    if (!cached || Date.now() - cached.t >= INBOX_TTL_MS) {
      void fetchCount();
    }

    const onFocus = () => void fetchCount();
    window.addEventListener('focus', onFocus);
    window.addEventListener('visibilitychange', onFocus);
    return () => {
      mounted = false;
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('visibilitychange', onFocus);
    };
  }, [items]);

  // Hide overlay once route commits
  useEffect(() => {
    if (navLoading) setNavLoading(false);
  }, [pathname, navLoading]);

  // Scroll the sidebar's scroll container back to the top (folder taps use this so an
  // opened folder + its children land in view instead of below the fold).
  const scrollSidebarToTop = () => {
    const nav = navRef.current;
    if (!nav) return;
    let p: HTMLElement | null = nav.parentElement;
    while (p) {
      const oy = getComputedStyle(p).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight) {
        p.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      p = p.parentElement;
    }
    nav.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  const toggleMenu = (label: string) =>
    setOpenMenus((prev) => {
      const willOpen = !prev[label];
      const next = { ...prev, [label]: !prev[label] };
      safeLS.set(OPEN_MENUS_KEY, next);
      // On open, reposition the sidebar to the top.
      if (willOpen) requestAnimationFrame(() => scrollSidebarToTop());
      return next;
    });

  const handleNavigateStart = (href: string) => {
    if (href && href !== pathname) setNavLoading(true);
  };

  /* -------- DEV: clear nav cache hotkey -------- */
  const clearNavCache = () => {
    try {
      safeLS.remove(OPEN_MENUS_KEY);
      setOpenMenus({});
      safeLS.remove(INBOX_COUNT_KEY);
      setInboxNewCount(null);
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith('qs:is_admin:')) localStorage.removeItem(k);
      });
      setCleared(true);
      setTimeout(() => setCleared(false), 1800);
      console.info('[nav] cleared local cache');
    } catch (e) {
      console.warn('[nav] clear cache failed:', e);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        clearNavCache();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* -------- Keyboard navigation (↑/↓/Enter) -------- */
  type FocusRow = { id: string; kind: 'parent' | 'child'; label: string; href?: string; parentLabel?: string };

  const focusRows = useMemo<FocusRow[]>(() => {
    const rows: FocusRow[] = [];
    items.forEach((it) => {
      if (it.type === 'section') return;

      const pid = `nav-parent-${slugify(it.label)}`;
      rows.push({ id: pid, kind: 'parent', label: it.label, href: (it as any).href });

      const open = !!openMenus[it.label];
      if (!collapsed && open && it.children?.length) {
        it.children.forEach((ch, ci) => {
          const cid = `nav-child-${slugify(it.label)}-${ci}`;
          rows.push({ id: cid, kind: 'child', label: ch.label, href: ch.href, parentLabel: it.label });
        });
      }
    });
    return rows;
  }, [items, openMenus, collapsed]);

  // keep selected index valid
  useEffect(() => {
    if (selectedIdx >= focusRows.length) {
      setSelectedIdx(focusRows.length > 0 ? focusRows.length - 1 : 0);
    }
  }, [focusRows.length, selectedIdx]);

  // choose initial selection based on current path
  useEffect(() => {
    if (!focusRows.length) return;
    const current = focusRows.findIndex(r => r.href && pathname?.startsWith(r.href.split('?')[0]));
    if (current >= 0) setSelectedIdx(current);
  }, [pathname, focusRows]);

  // scroll selected into view
  useEffect(() => {
    const id = focusRows[selectedIdx]?.id;
    if (!id) return;
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ block: 'nearest' });
  }, [selectedIdx, focusRows]);

  // handle keys when nav has focus
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;

    const onKey = (e: KeyboardEvent) => {
      const k = e.key;
      if (k !== 'ArrowDown' && k !== 'ArrowUp' && k !== 'Enter') return;

      const withinNav = el.contains(document.activeElement);
      if (!withinNav) return;

      if (k === 'ArrowDown') {
        e.preventDefault();
        if (focusRows.length) setSelectedIdx((i) => (i + 1) % focusRows.length);
      } else if (k === 'ArrowUp') {
        e.preventDefault();
        if (focusRows.length) setSelectedIdx((i) => (i - 1 + focusRows.length) % focusRows.length);
      } else if (k === 'Enter') {
        e.preventDefault();
        const row = focusRows[selectedIdx];
        if (!row) return;
        document.getElementById(row.id)?.click();
      }
    };

    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  }, [focusRows, selectedIdx]);

  // make nav focusable
  useEffect(() => {
    navRef.current?.setAttribute('tabindex', '0');
  }, []);

  return (
    <nav
      ref={navRef}
      role="navigation"
      aria-label="Sidebar"
      className="flex flex-col gap-1 px-1 focus:outline-none"
    >
      {/* Brand + org switcher at the top */}
      <BrandSwitcher
        collapsed={collapsed}
        onWillSwitch={() => setNavLoading(true)}
        isPlatformAdmin={isAdmin}
      />

      {/* Quick-find filter — type to jump to any feature. */}
      {!collapsed && (
        <div className="px-2 pb-2 pt-1">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setQuery('');
                if (e.key === 'Enter' && results[0]) { handleNavigateStart(results[0].href); window.location.assign(results[0].href); }
              }}
              placeholder="Find a feature…"
              aria-label="Find a feature"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900/60 py-1.5 pl-8 pr-2 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-purple-500"
            />
          </div>
        </div>
      )}

      {/* Search results (flat) when filtering; otherwise the grouped nav. */}
      {q ? (
        <div className="flex flex-col gap-0.5">
          {results.length === 0 ? (
            <div className="px-3 py-4 text-sm text-zinc-500">No matches for “{query}”.</div>
          ) : (
            results.map((r) => (
              <Link
                key={`${r.group}-${r.label}-${r.href}`}
                href={r.href}
                onClick={() => { if (r.href !== pathname) handleNavigateStart(r.href); }}
                className="group flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-300 transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                <span className="flex w-10 shrink-0 items-center justify-center [&_svg]:h-[18px] [&_svg]:w-[18px]">{r.icon}</span>
                <span className="min-w-0 flex-1 truncate">{r.label}</span>
                <span className="shrink-0 text-[10px] uppercase tracking-wide text-zinc-600">{r.group}</span>
              </Link>
            ))
          )}
        </div>
      ) : (
      items.map((item, idx) => {
        if (item.type === 'section') {
          return !collapsed ? (
            <div
              key={`section-${item.label}-${idx}`}
              className="px-3 pt-5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500"
            >
              {item.label}
            </div>
          ) : (
            // Collapsed rail: a thin divider stands in for the section label.
            <div key={`section-${item.label}-${idx}`} className="mx-auto my-2 h-px w-6 bg-white/10" />
          );
        }

        const isActive =
          (item.href && pathname?.startsWith(item.href)) ||
          (item.children?.some((c) => pathname?.startsWith(c.href.split('?')[0])) ?? false);

        const isOpen = openMenus[item.label];

        const parentId = `nav-parent-${slugify(item.label)}`;
        const parentSelected = focusRows[selectedIdx]?.id === parentId;

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
              domId={parentId}              // NEW
              kbdSelected={parentSelected}  // NEW
            />

            <div
              className={clsx(
                'ml-8 transition-all duration-300 overflow-hidden',
                collapsed || !isOpen ? 'max-h-0' : 'max-h-64 mt-1'
              )}
            >
              {!collapsed &&
                item.children?.map((child, ci) => {
                  // Special inline tool for Elect Info quick jump
                  if (child.label === '__quick_slug_jump__') {
                    return (
                      <div key={`quick-jump-${ci}`} className="mt-1">
                        <QuickSlugJump
                          collapsed={collapsed}
                          onNavigateStart={handleNavigateStart}
                        />
                      </div>
                    );
                  }

                  const isActiveChild = pathname?.startsWith(child.href.split('?')[0]);
                  const isNewTemplate = child.href === '/admin/templates/new';

                  const rowId = `nav-child-${slugify(item.label)}-${ci}`;
                  const kbdSelected = focusRows[selectedIdx]?.id === rowId;

                  const baseChild = 'block text-sm px-3 py-1 rounded transition';
                  const ringIfSelected = kbdSelected ? 'ring-2 ring-purple-500' : '';

                  const newBtnClasses = clsx(
                    'mt-1 inline-flex items-center gap-2 rounded-md px-3 py-1.5 font-medium shadow-sm',
                    ringIfSelected,
                    isActiveChild
                      ? 'bg-emerald-700 text-white ring-1 ring-emerald-300/30'
                      : 'bg-emerald-600 text-white hover:bg-emerald-500'
                  );
                  const normalClasses = clsx(
                    baseChild,
                    ringIfSelected,
                    isActiveChild
                      ? 'bg-zinc-800 text-white font-medium'
                      : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                  );

                  return (
                    <Link
                      id={rowId}
                      role="menuitem"
                      tabIndex={-1}
                      key={child.href}
                      href={child.href}
                      className={isNewTemplate ? newBtnClasses : normalClasses}
                      title={isNewTemplate ? 'Create a new site' : child.label}
                      onClick={() => {
                        if (child.href && child.href !== pathname) handleNavigateStart(child.href);
                      }}
                    >
                      {isNewTemplate && <Plus size={14} />}
                      {child.label}
                    </Link>
                  );
                })}

            </div>
          </div>
        );
      })
      )}

      {/* Dev-only: Clear nav cache */}
      {process.env.NODE_ENV !== 'production' && (
        <div className="mt-3 px-2 pb-2">
          <button
            type="button"
            onClick={clearNavCache}
            className="w-full text-[11px] rounded border border-zinc-700/80 hover:border-zinc-500 px-2 py-1 text-zinc-300 hover:text-white bg-zinc-900/50"
            title="Clear cached admin flag, inbox count, and submenu state (⌥⌘K)"
          >
            Dev: Clear nav cache <span className="opacity-70">(⌥⌘K)</span>
          </button>
          {cleared && <div className="mt-1 text-[11px] text-emerald-400">Cleared.</div>}
        </div>
      )}

      <LoadingOverlay show={navLoading} />
    </nav>
  );
}
