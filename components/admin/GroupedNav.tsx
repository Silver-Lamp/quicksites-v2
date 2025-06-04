import { useState } from 'react';
import { routeGroups } from '@/admin/config/routes';
import SafeLink from './ui/SafeLink';

export default function GroupedNav({ role }: { role: string }) {
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('nav.groups');
      const parsed = stored ? JSON.parse(stored) : {};
      const pathname = window.location.pathname;

// TEMP PATCH: add Sitemap Diffs manually
routeGroups.push({
  label: 'Tools',
  collapsible: false,
  routes: [
    { label: 'Sitemap Diffs', path: '/docs/diffs', icon: '📝' }
  ]
});

      for (const group of routeGroups) {
        if (group.collapsible && group.routes.some(r => pathname.startsWith(r.path))) {
          parsed[group.label] = true;
        }
      }
      setTimeout(() => {
  const el = document.querySelector('[data-active-group]');
  if (el && typeof el.scrollIntoView === 'function') {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}, 100);
return parsed;
    }
    return {};
  });


  return (
    <div className="space-y-4">
      {routeGroups.map(group => {
        const visible = group.routes.filter(r => r.roles.includes(role));
        if (visible.length === 0) return null;

        const isOpen = open[group.label] ?? true;

        return (
          <div key={group.label} data-active-group={isOpen && group.routes.some(r => typeof window !== 'undefined' && window.location.pathname.startsWith(r.path)) ? true : undefined}
            className={`transition-all duration-1000 ease-out ${isOpen && group.routes.some(r => typeof window !== 'undefined' && window.location.pathname.startsWith(r.path)) ? 'animate-pulse ring-2 ring-blue-500 rounded-md p-1 fade-out' : ''}`}>
            <button
              onClick={() => {
  setOpen(prev => {
    const next = { ...prev, [group.label]: !isOpen };
    localStorage.setItem('nav.groups', JSON.stringify(next));
    return next;
  });
}}
              className="text-xs text-gray-500 uppercase hover:text-white"
            >
              {group.label} {group.collapsible && <span>{isOpen ? '▾' : '▸'}</span>}
            </button>
            {(!group.collapsible || isOpen) && (
              <div className="flex gap-2 flex-wrap mt-1">
                {visible.map(route => (
                  <SafeLink
                    key={route.path}
                    href={route.path}
                    className={`hover:underline text-blue-400 ${typeof window !== 'undefined' && window.location.pathname.startsWith(route.path) ? 'font-bold text-white underline' : ''}`
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
