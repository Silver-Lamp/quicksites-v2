'use client';

import { usePathname } from 'next/navigation';
import { SafeLink } from '@/components/ui';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FileText,
  FileSignature,
  Settings,
  Users,
  Shield,
} from 'lucide-react';

export function AdminNavSections() {
  const pathname = usePathname();

  const NavLink = ({ href, label, icon: Icon }: { href: string; label: string; icon: any }) => (
    <SafeLink
      href={href}
      className={cn(
        'flex items-center gap-2 px-2 py-1 rounded hover:bg-zinc-800 transition-colors text-sm',
        pathname === href && 'bg-zinc-800 text-white font-semibold'
      )}
    >
      <Icon size={16} />
      {label}
    </SafeLink>
  );

  return (
    <nav className="space-y-4 text-sm">
      <div>
        <p className="font-semibold text-blue-300 mb-1">Core</p>
        <div className="flex flex-col gap-1">
          <NavLink href="/admin" label="Dashboard" icon={LayoutDashboard} />
          <NavLink href="/admin/leads" label="Leads" icon={FileText} />
          <NavLink href="/admin/campaigns" label="Campaigns" icon={FileText} />
          <NavLink href="/admin/start-campaign" label="Start Campaign" icon={FileSignature} />
        </div>
      </div>

      <div>
        <p className="font-semibold text-green-300 mb-1">Logs & Analytics</p>
        <div className="flex flex-col gap-1">
          <NavLink href="/admin/logs" label="Logs" icon={FileText} />
          <NavLink href="/admin/logs/sessions" label="Session Logs" icon={FileText} />
          <NavLink href="/admin/analytics" label="Analytics" icon={FileText} />
          <NavLink href="/admin/heatmap" label="Heatmap" icon={FileText} />
        </div>
      </div>

      <div>
        <p className="font-semibold text-yellow-300 mb-1">Templates</p>
        <div className="flex flex-col gap-1">
          <NavLink href="/admin/templates" label="All Templates" icon={FileText} />
          <NavLink href="/admin/templates-new" label="+ New Template" icon={FileSignature} />
        </div>
      </div>

      <div>
        <p className="font-semibold text-purple-300 mb-1">Dev Tools</p>
        <div className="flex flex-col gap-1">
          <NavLink href="/admin/docs" label="Docs" icon={FileText} />
          <NavLink href="/admin/query-usecases" label="Params" icon={Settings} />
          <NavLink href="/admin/branding/og-editor/xyz" label="OG Editor" icon={FileText} />
        </div>
      </div>

      <div>
        <p className="font-semibold text-red-300 mb-1">Admin</p>
        <div className="flex flex-col gap-1">
          <NavLink href="/admin/users" label="Users" icon={Users} />
          <NavLink href="/admin/roles" label="Roles" icon={Shield} />
        </div>
      </div>
    </nav>
  );
}
