// ✅ FILE: components/admin/GroupedNav.tsx (now using SidebarNavContext)

import { useSidebarNav } from '@/components/admin/context/sidebar-nav-context';
import { SafeLink } from '@/components/ui';

export default function GroupedNav() {
  const { role, groups, open, toggle } = useSidebarNav();

  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const visible = group.routes.filter((r) => (r.roles || []).includes(role));
        if (visible.length === 0) return null;

        const isOpen = open[group.label] ?? true;

        return (
          <div
            key={group.label}
            data-active-group={
              isOpen &&
              group.routes.some(
                (r) => typeof window !== 'undefined' && window.location.pathname.startsWith(r.path)
              )
                ? true
                : undefined
            }
            className={`transition-all duration-1000 ease-out ${
              isOpen &&
              group.routes.some(
                (r) => typeof window !== 'undefined' && window.location.pathname.startsWith(r.path)
              )
                ? 'animate-pulse ring-2 ring-blue-500 rounded-md p-1 fade-out'
                : ''
            }`}
          >
            <button
              onClick={() => toggle(group.label)}
              className="text-xs text-gray-500 uppercase hover:text-white"
            >
              {group.label} {group.collapsible && <span>{isOpen ? '▾' : '▸'}</span>}
            </button>
            {(!group.collapsible || isOpen) && (
              <div className="flex gap-2 flex-wrap mt-1">
                {visible.map((route) => (
                  <SafeLink
                    key={route.path}
                    href={route.path}
                    className={`hover:underline text-blue-400 ${
                      typeof window !== 'undefined' &&
                      window.location.pathname.startsWith(route.path)
                        ? 'font-bold text-white underline'
                        : ''
                    }`}
                  >
                    {route.label}
                  </SafeLink>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
