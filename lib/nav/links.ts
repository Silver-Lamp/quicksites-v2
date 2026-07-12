export type NavRole = 'admin' | 'editor' | 'viewer' | 'owner' | null;
export type NavFlag = 'internal' | 'beta' | 'labs';

export type NavItem = {
  href: string;
  label: string;
  title?: string;
  icon?: string;
  external?: boolean;
  roles?: NavRole[];
  flags?: NavFlag[];
};

export type NavSection = {
  label: string;
  color: string;
  role?: NavRole;
  flags?: NavFlag[];
  routes: NavItem[];
};

export const NAV_SECTIONS: NavSection[] = [
  {
    label: '📊 Core',
    color: 'text-blue-300',
    routes: [
      { href: '/dashboard', label: '📈 Dashboard' },
      { href: '/admin/growth?tab=prospects', label: '📍 Businesses Near Me' },
      { href: '/admin/growth?tab=pipeline', label: '🚀 Outreach Pipeline' },
      { href: '/admin/drafts', label: '📝 Drafts' },
      { href: '/admin/guest-tokens', label: '🔐 Guest Tokens', flags: ['beta'] },
    ],
  },
  {
    label: '🛠 Tools',
    color: 'text-cyan-300',
    role: 'admin',
    routes: [{ href: '/admin/tools/prebuild-og', label: '🖼 OG Prebuilds', flags: ['internal'] }],
  },
];
