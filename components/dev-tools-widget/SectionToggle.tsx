// components/dev-tools-widget/SectionToggle.tsx
'use client';

import { useState } from 'react';

export function SectionToggle({
  title,
  children,
  collapsedByDefault = false,
}: {
  title: string;
  children: React.ReactNode;
  collapsedByDefault?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(collapsedByDefault);

  return (
    <div className="border-t border-zinc-700 pt-3 mt-3">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="text-left text-xs text-white font-semibold w-full hover:text-indigo-300"
      >
        {collapsed ? '▶' : '▼'} {title}
      </button>
      {!collapsed && <div className="mt-2 space-y-2">{children}</div>}
    </div>
  );
}
