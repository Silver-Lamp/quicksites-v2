// components/admin/AppHeader/NavSections.tsx
import SafeLink from '../ui/SafeLink';

export function NavSections() {
  return (
    <nav className="flex flex-wrap gap-4 items-center text-sm">
      <details className="group" open>
        <summary className="cursor-pointer font-semibold text-blue-300 group-open:underline">Core</summary>
        <div className="flex flex-wrap gap-2 ml-2">
          <SafeLink href="/dashboard">Dashboard</SafeLink>
          <SafeLink href="/admin/leads">Leads</SafeLink>
          <SafeLink href="/admin/campaigns">Campaigns</SafeLink>
          <SafeLink href="/admin/start-campaign">Start Campaign</SafeLink>
        </div>
      </details>
      <details className="group">
        <summary className="cursor-pointer font-semibold text-green-300 group-open:underline">Logs</summary>
        <div className="flex flex-wrap gap-2 ml-2">
          <SafeLink href="/admin/logs">Logs</SafeLink>
          <SafeLink href="/admin/logs/sessions">Session Logs</SafeLink>
          <SafeLink href="/admin/analytics">Analytics</SafeLink>
          <SafeLink href="/admin/heatmap">Heatmap</SafeLink>
        </div>
      </details>
      <details className="group">
        <summary className="cursor-pointer font-semibold text-yellow-300 group-open:underline">Templates</summary>
        <div className="flex flex-wrap gap-2 ml-2">
          <SafeLink href="/admin/templates">All Templates</SafeLink>
          <SafeLink href="/admin/templates-new">+ New Template</SafeLink>
        </div>
      </details>
      <details className="group">
        <summary className="cursor-pointer font-semibold text-purple-300 group-open:underline">Dev</summary>
        <div className="flex flex-wrap gap-2 ml-2">
          <SafeLink href="/admin/docs">Docs</SafeLink>
          <SafeLink href="/admin/query-usecases">Params</SafeLink>
          <SafeLink href="/admin/branding/og-editor/xyz">OG Editor</SafeLink>
        </div>
      </details>
      <details className="group">
        <summary className="cursor-pointer font-semibold text-red-300 group-open:underline">Admin</summary>
        <div className="flex flex-wrap gap-2 ml-2">
          <SafeLink href="/admin/users">Users</SafeLink>
          <SafeLink href="/admin/roles">Roles</SafeLink>
          <SafeLink href="/docs/diffs">📝 Sitemap Diffs</SafeLink>
        </div>
      </details>
    </nav>
  );
}
