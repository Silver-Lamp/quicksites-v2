'use client';

import { usePathname } from 'next/navigation';
import { useSmartNav } from '../../../hooks/useSmartNav';
import SafeLink from '../../ui/safe-link';
import { NavBadge } from '../../ui/nav-badge';
import { useLiveAdminStats } from '../../../hooks/useLiveAdminStats';

export function NavSections() {
  const pathname = usePathname();
  const { nav, loading } = useSmartNav();
  const { unclaimed, errors } = useLiveAdminStats();

  const matches = (prefix: string) => pathname?.startsWith(prefix);

  if (loading) return null;

  return (
    <nav className="flex flex-col gap-6 text-sm">
      {/* 🖥 Desktop */}
      <div className="hidden md:flex flex-wrap gap-4 items-center">
        {nav.map((section) => (
          <details
            key={section.label}
            className="group"
            open={section.routes.some((r) => matches(r.href))}
          >
            <summary className={`cursor-pointer font-semibold ${section.color} group-open:underline`}>
              {section.label}
            </summary>
            <div className="ml-2 flex flex-wrap gap-2 mt-1">
              {section.routes.map((r) => {
                const isDynamic = r.href.includes('[slug]') || r.href.includes(':');
                const labelWithCount =
                  r.href === '/admin/leads' && unclaimed && unclaimed > 0
                    ? `${r.label} (${unclaimed})`
                    : r.href === '/admin/drafts' && unclaimed && unclaimed > 0
                      ? `${r.label} (${unclaimed})`
                      : r.label;

                return (
                  <SafeLink
                    key={r.href}
                    href={r.href}
                    target={r.external ? '_blank' : undefined}
                    title={r.title}
                    onClick={() => {
                      fetch('/api/log-event', {
                        method: 'POST',
                        body: JSON.stringify({ href: r.href, type: 'nav_click' }),
                      });
                    }}
                  >
                    {labelWithCount}
                    <NavBadge flag={r.flags?.[0]} />
                  </SafeLink>
                );
              })}
            </div>
          </details>
        ))}
      </div>

      {/* 📱 Mobile */}
      <div className="md:hidden">
        <label htmlFor="mobile-nav" className="block mb-1 font-medium text-muted-foreground">
          Navigate:
        </label>
        <select
          id="mobile-nav"
          className="w-full p-2 border rounded text-sm"
          onChange={(e) => {
            if (e.target.value) {
              fetch('/api/log-event', {
                method: 'POST',
                body: JSON.stringify({ href: e.target.value, type: 'nav_click' }),
              });
              window.location.href = e.target.value;
            }
          }}
        >
          <option value="">Select a page</option>
          {nav.flatMap((section) => [
            <optgroup key={section.label} label={section.label}>
              {section.routes.map((r) => (
                <option key={r.href} value={r.href}>
                  {r.label.replace(/^[^\w\s]+ /, '')}
                </option>
              ))}
            </optgroup>,
          ])}
        </select>
      </div>
    </nav>
  );
}
