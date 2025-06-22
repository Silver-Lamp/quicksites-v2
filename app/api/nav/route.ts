export const runtime = 'nodejs';

import { NextRequest } from 'next/server';

export async function GET(_req: NextRequest) {
  const nav = [
    {
      label: 'Core',
      color: 'text-blue-300',
      routes: [
        { href: '/dashboard', label: 'Dashboard' },
        { href: '/admin/leads', label: 'Leads' },
        { href: '/admin/campaigns', label: 'Campaigns' },
        { href: '/admin/start-campaign', label: 'Start Campaign' },
      ],
    },
    {
      label: 'Logs',
      color: 'text-green-300',
      routes: [
        { href: '/admin/logs', label: 'Logs' },
        { href: '/admin/logs/sessions', label: 'Session Logs' },
        { href: '/admin/analytics', label: 'Analytics' },
        { href: '/admin/heatmap', label: 'Heatmap' },
        { href: '/admin/not-found', label: '404s' },
      ],
    },
    {
      label: 'Templates',
      color: 'text-yellow-300',
      routes: [
        { href: '/template-market', label: 'Template Market' },
        { href: '/admin/templates', label: 'All Templates' },
        { href: '/admin/templates-new', label: '+ New Template' },
      ],
    },
    {
      label: 'Docs & Dev',
      color: 'text-purple-300',
      routes: [
        { href: '/docs', label: '📘 API Docs', external: true },
        { href: '/docs.yaml', label: '🧾 /docs.yaml', external: true },
        { href: '/admin/docs', label: 'Internal Docs' },
        { href: '/admin/query-usecases', label: 'Params' },
        { href: '/admin/branding/og-editor/xyz', label: 'OG Editor' },
      ],
    },
    {
      label: 'Admin',
      color: 'text-red-300',
      routes: [
        { href: '/admin/users', label: 'Users' },
        { href: '/admin/roles', label: 'Roles' },
        { href: '/docs/diffs', label: '📝 Sitemap Diffs' },
      ],
    },
  ];

  return new Response(JSON.stringify(nav), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
