'use client';

import { NAV_SECTIONS } from '@/lib/nav/links';
import { useState } from 'react';

export default function NavSettingsPage() {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});

  return (
    <div className="max-w-3xl mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">🧭 Nav Settings</h1>
      {NAV_SECTIONS.map((section) => (
        <div key={section.label} className="mb-4">
          <h2 className="font-semibold text-lg mb-2">{section.label}</h2>
          <ul className="space-y-1 text-sm">
            {section.routes.map((r) => (
              <li key={r.href} className="flex justify-between items-center">
                <span>{r.label}</span>
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={enabled[r.href] ?? true}
                    onChange={() =>
                      setEnabled((prev) => ({
                        ...prev,
                        [r.href]: !prev[r.href],
                      }))
                    }
                  />
                  <span className="text-xs text-muted-foreground">Show</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
