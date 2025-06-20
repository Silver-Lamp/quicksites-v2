'use client';

import { usePathname } from 'next/navigation';
import SafeLink from '../ui/SafeLink';
import { useLiveAdminStats } from '@/hooks/useLiveAdminStats';

export function NavSections() {
  const pathname = usePathname();

  const isActive = (href: string) => pathname === href;
  const matches = (prefix: string) => pathname.startsWith(prefix);

  // Placeholder counts — replace with actual state/hooks as needed
  const { unclaimed, errors } = useLiveAdminStats();

  return (
    <nav className="flex flex-wrap gap-4 items-center text-sm">
      <details
        className="group"
        open={matches('/dashboard') || matches('/admin/leads') || matches('/admin/start-campaign')}
      >
        <summary className="cursor-pointer font-semibold text-blue-300 group-open:underline">
          Core
        </summary>
        <div className="flex flex-wrap gap-2 ml-2">
          <SafeLink href="/dashboard">Dashboard</SafeLink>
          <SafeLink href="/admin/leads">
            Leads{' '}
            {unclaimed !== null && unclaimed > 0 && (
              <span className="ml-1 text-xs text-yellow-400">({unclaimed})</span>
            )}
          </SafeLink>
          <SafeLink href="/admin/campaigns">Campaigns</SafeLink>
          <SafeLink href="/admin/start-campaign">Start Campaign</SafeLink>
        </div>
      </details>

      <details
        className="group"
        open={matches('/admin/logs') || matches('/admin/analytics') || matches('/admin/heatmap')}
      >
        <summary className="cursor-pointer font-semibold text-green-300 group-open:underline">
          Logs{' '}
          {errors !== null && errors > 0 && (
            <span className="ml-2 text-xs text-red-400">({errors})</span>
          )}
        </summary>
        <div className="flex flex-wrap gap-2 ml-2">
          <SafeLink href="/admin/logs">Logs</SafeLink>
          <SafeLink href="/admin/logs/sessions">Session Logs</SafeLink>
          <SafeLink href="/admin/analytics">Analytics</SafeLink>
          <SafeLink href="/admin/heatmap">Heatmap</SafeLink>
          <SafeLink href="/admin/not-found">404s</SafeLink>
        </div>
      </details>

      <details className="group" open={matches('/template-market') || matches('/admin/templates')}>
        <summary className="cursor-pointer font-semibold text-yellow-300 group-open:underline">
          Templates
        </summary>
        <div className="flex flex-wrap gap-2 ml-2">
          <SafeLink href="/template-market">Template Market</SafeLink>
          <SafeLink href="/admin/templates">All Templates</SafeLink>
          <SafeLink href="/admin/templates-new">+ New Template</SafeLink>
        </div>
      </details>

      <details
        className="group"
        open={matches('/docs') || matches('/admin/docs') || matches('/admin/query-usecases')}
      >
        <summary className="cursor-pointer font-semibold text-purple-300 group-open:underline">
          Docs & Dev
        </summary>
        <div className="flex flex-wrap gap-2 ml-2">
          <SafeLink href="/docs" target="_blank">
            📘 API Docs
          </SafeLink>
          <SafeLink href="/docs.yaml" target="_blank">
            🧾 /docs.yaml
          </SafeLink>
          <SafeLink href="/admin/docs">Internal Docs</SafeLink>
          <SafeLink href="/admin/query-usecases">Params</SafeLink>
          <SafeLink href="/admin/branding/og-editor/xyz">OG Editor</SafeLink>
        </div>
      </details>

      <details className="group" open={matches('/admin/users') || matches('/admin/roles')}>
        <summary className="cursor-pointer font-semibold text-red-300 group-open:underline">
          Admin
        </summary>
        <div className="flex flex-wrap gap-2 ml-2">
          <SafeLink href="/admin/users">Users</SafeLink>
          <SafeLink href="/admin/roles">Roles</SafeLink>
          <SafeLink href="/docs/diffs">📝 Sitemap Diffs</SafeLink>
        </div>
      </details>
    </nav>
  );
}
