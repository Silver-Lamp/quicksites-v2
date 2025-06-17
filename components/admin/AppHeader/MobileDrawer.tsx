// components/admin/AppHeader/MobileDrawer.tsx
import SafeLink from '../ui/SafeLink';

export function MobileDrawer({
  drawerOpen,
  onClose,
}: {
  drawerOpen: boolean;
  onClose: () => void;
}) {
  if (!drawerOpen) return null;

  return (
    <div className="fixed top-0 left-0 w-64 h-full bg-zinc-900 text-white z-40 p-4 shadow-lg sm:hidden">
      <h2 className="text-lg font-bold mb-4">Menu</h2>
      <nav className="space-y-4 text-sm">
        <details open>
          <summary className="cursor-pointer font-semibold text-blue-300">
            Core
          </summary>
          <div className="ml-4 space-y-1">
            <SafeLink href="/admin">Dashboard</SafeLink>
            <SafeLink href="/admin/leads">Leads</SafeLink>
            <SafeLink href="/admin/campaigns">Campaigns</SafeLink>
            <SafeLink href="/admin/start-campaign">Start Campaign</SafeLink>
          </div>
        </details>
        <details>
          <summary className="cursor-pointer font-semibold text-green-300">
            Logs & Analytics
          </summary>
          <div className="ml-4 space-y-1">
            <SafeLink href="/admin/logs">Logs</SafeLink>
            <SafeLink href="/admin/logs/sessions">Session Logs</SafeLink>
            <SafeLink href="/admin/analytics">Analytics</SafeLink>
            <SafeLink href="/admin/heatmap">Heatmap</SafeLink>
          </div>
        </details>
        <details>
          <summary className="cursor-pointer font-semibold text-yellow-300">
            Templates
          </summary>
          <div className="ml-4 space-y-1">
            <SafeLink href="/admin/templates">All Templates</SafeLink>
            <SafeLink href="/admin/templates-new">+ New Template</SafeLink>
          </div>
        </details>
        <details>
          <summary className="cursor-pointer font-semibold text-purple-300">
            Dev Tools
          </summary>
          <div className="ml-4 space-y-1">
            <SafeLink href="/admin/docs">Docs</SafeLink>
            <SafeLink href="/admin/query-usecases">Params</SafeLink>
            <SafeLink href="/admin/branding/og-editor/xyz">OG Editor</SafeLink>
          </div>
        </details>
        <details>
          <summary className="cursor-pointer font-semibold text-red-300">
            Admin
          </summary>
          <div className="ml-4 space-y-1">
            <SafeLink href="/admin/users">Users</SafeLink>
            <SafeLink href="/admin/roles">Roles</SafeLink>
          </div>
        </details>
      </nav>
    </div>
  );
}
