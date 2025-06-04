/* components/layouts/AdminSidebarLayout.tsx */

'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Image from 'next/image';
import { Menu, X } from 'lucide-react';
import { HomeIcon, LayoutIcon, FileIcon, GalleryHorizontalIcon, SparklesIcon, BarChartIcon } from 'lucide-react';
import { useCurrentRole } from '@/admin/hooks/useCurrentRole';
import SafeLink from '@/components/admin/ui/SafeLink';
import { ImageIcon } from 'lucide-react';


const navSections = [
  {
    label: 'Main',
    routes: [
      { label: 'Dashboard', href: '/admin/dashboard', icon: HomeIcon },
      { label: 'Sites', href: '/admin/sites', icon: LayoutIcon },
      { label: 'Reports', href: '/admin/logs', icon: BarChartIcon },
      { label: 'Sitemap Diffs', href: '/docs/diffs', icon: SparklesIcon }
    ]
  }
];


const useDynamicNavSections = (role: string | null) => {
  const [dynamicSections, setDynamicSections] = useState<any[]>([]);

  useEffect(() => {
    const fetchRecentCompare = async () => {
      const res = await fetch('/api/compare-slugs');
      const json = await res.json();
      const recentSlug = json.slugs?.[0];

      const pinnedSlugs = JSON.parse(localStorage.getItem('pinnedCompareSlugs') || '[]');
      const pinnedLinks = pinnedSlugs.map((slug: string) => ({
        href: `/compare/${slug}`,
        label: `📌 ${slug.replace(/-/g, ' ')}`,
        icon: <BarChartIcon className="w-4 h-4" />,
        role: 'admin',
      }));

      setDynamicSections([
        {
          title: 'Management',
          items: [
            { href: '/dashboard', label: 'Dashboard', icon: <HomeIcon className="w-4 h-4" /> },
            { href: '/admin/sites', label: 'Sites', icon: <LayoutIcon className="w-4 h-4" /> },
            { href: '/admin/branding', label: 'Themes', icon: <SparklesIcon className="w-4 h-4" /> },
            { href: '/gallery', label: 'Gallery', icon: <GalleryHorizontalIcon className="w-4 h-4" /> },
            { href: '/admin/docs', label: 'Docs', icon: <FileIcon className="w-4 h-4" /> },
            { href: '/admin/templates', label: 'Templates' },
            { href: '/admin/templates-new', label: '+ New Template' },
          ],
        },
        {
          title: 'Analytics',
          items: [
            { href: '/admin/campaigns', label: 'Campaigns', icon: <BarChartIcon className="w-4 h-4" />, role: 'admin' },
          ],
        },
        {
          title: 'Tools',
          items: [
            recentSlug && {
              href: `/compare/${recentSlug}`,
              label: 'Latest Comparison',
              icon: <BarChartIcon className="w-4 h-4" />, // optional alternate icon
              role: 'admin'
            },
            {
              href: '/admin/tools/prebuild-og',
              label: 'OG Image Builder',
              icon: <ImageIcon className="w-4 h-4" />,
              role: 'admin',
            },
          ].filter(Boolean),
        },
      ]);
    };
    fetchRecentCompare();
  }, [role]);

  return dynamicSections;
};
//   {
//     title: 'Management',
//     items: [
//       { href: '/dashboard', label: 'Dashboard', icon: <HomeIcon className="w-4 h-4" /> },
//       { href: '/admin/sites', label: 'Sites', icon: <LayoutIcon className="w-4 h-4" /> },
//       { href: '/admin/branding', label: 'Themes', icon: <SparklesIcon className="w-4 h-4" /> },
//       { href: '/gallery', label: 'Gallery', icon: <GalleryHorizontalIcon className="w-4 h-4" /> },
//       { href: '/admin/docs', label: 'Docs', icon: <FileIcon className="w-4 h-4" /> },
//       { href: '/admin/templates', label: 'Templates' },
//       { href: '/admin/templates-new', label: '+ New Template' },
//     ],
//   },
//   $1,
//   {
//     $1
//       {
//         href: '/compare/demo-vs-placeholder',
//         label: 'Compare Demo',
//         icon: <BarChartIcon className="w-4 h-4" />, // reuse for preview test link
//         role: 'admin',
//       },
//       {
//         href: '/admin/tools/prebuild-og',
//         label: 'OG Image Builder',
//         icon: <ImageIcon className="w-4 h-4" />,
//         role: 'admin',
//       },
//     ],
//   }
//     ],
//   },
// ];

const teams = ['Team A', 'Team B', 'Team C'];

export default function AdminSidebarLayout({ children }: { children: React.ReactNode }) {
  const { pathname } = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [team, setTeam] = useState('Team A');
  const [impersonating, setImpersonating] = useState('');
  const role = useCurrentRole();

  useEffect(() => {
    const stored = localStorage.getItem('sidebar_collapsed');
    if (stored) setCollapsed(stored === 'true');
    const imp = localStorage.getItem('impersonating');
    if (imp) setImpersonating(imp);
  }, []);

  const toggleSidebar = () => setMobileOpen(!mobileOpen);
  const version = 'v1.0.0';

  const renderLink = (href: string, label: string, icon?: React.ReactNode) => {
    const active = pathname.startsWith(href);
    return (
      <SafeLink key={href} href={href}>
        <span
          className={`flex items-center gap-2 px-3 py-2 rounded hover:bg-gray-700 cursor-pointer focus:outline-none focus:ring-2 ring-white ring-offset-2 ring-offset-gray-800 ${
            active ? 'bg-gray-700 font-semibold' : ''
          }`}
          title={collapsed ? label : undefined}
          tabIndex={0}
          aria-current={active ? 'page' : undefined}
        >
          {icon && <span className="shrink-0">{icon}</span>}
          {!collapsed && <span className="truncate">{label}</span>}
          {collapsed && !icon && <span>{label.charAt(0)}</span>}
        </span>
      </SafeLink>
    );
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-100 md:flex-row">
      {/* Sidebar */}
      <aside className={`bg-gray-800 text-white p-4 h-screen sticky top-0 transition-all ${collapsed ? 'w-16' : 'w-64'} hidden md:flex flex-col justify-between`}>
        <div>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <Image src="/logo.png" alt="Logo" width={28} height={28} className="rounded-sm" />
              {!collapsed && <span className="text-lg font-bold">QuickSites</span>}
            </div>
            <button
              onClick={() => {
                setCollapsed(!collapsed);
                localStorage.setItem('sidebar_collapsed', String(!collapsed));
              }}
              className="text-xs text-gray-400 hover:text-white"
              title="Toggle Sidebar"
            >
              {collapsed ? '➡️' : '⬅️'}
            </button>
          </div>

          <nav className="space-y-4">
            {navSections.map(section => (
              <div key={section.title}>
                {!collapsed && (
                  <p className="text-xs uppercase tracking-wide text-gray-400 px-3 mb-1">
                    {section.title}
                  </p>
                )}
                <div className="space-y-1">
                  {section.items
                    .filter((link: any) => !link.role || link.role === role)
                    .map(({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) => renderLink(href, label, icon))}
                </div>
              </div>
            ))}
          </nav>
        </div>

        <div className="space-y-2 text-xs text-gray-300">
          <div>
            <label>Team:</label>
            <select
              className="bg-gray-800 border border-gray-600 rounded w-full mt-1"
              value={team}
              onChange={e => setTeam(e.target.value)}
            >
              {teams.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          {impersonating && (
            <div>
              <p className="text-yellow-300">Impersonating: {impersonating}</p>
              <button
                className="underline text-red-400"
                onClick={() => {
                  localStorage.removeItem('impersonating');
                  setImpersonating('');
                }}
              >
                Revert
              </button>
            </div>
          )}
          <p>{version}</p>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="md:hidden bg-gray-800 text-white flex justify-between items-center p-4">
        <div className="flex items-center space-x-2">
          <Image src="/logo.png" alt="Logo" width={28} height={28} className="rounded-sm" />
          <span className="text-lg font-bold">QuickSites</span>
        </div>
        <button onClick={toggleSidebar}>
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {mobileOpen && (
        <div className="md:hidden fixed top-0 left-0 w-64 h-full bg-gray-800 text-white z-50 p-4">
          <nav className="space-y-3">
            {navSections.flatMap(section =>
              section.items
                .filter((link: any) => !link.role || link.role === role)
                .map(({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) => renderLink(href, label, icon))
            )}
          </nav>
        </div>
      )}

      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
