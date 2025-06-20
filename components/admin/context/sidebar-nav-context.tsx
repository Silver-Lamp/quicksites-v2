// ✅ FILE: components/admin/context/SidebarNavContext.tsx

'use client';

import { createContext, useContext, useEffect, useState } from 'react';

export type NavGroup = {
  label: string;
  collapsible?: boolean;
  routes: {
    label: string;
    path: string;
    icon?: string;
    roles?: string[];
  }[];
};

type SidebarNavContextType = {
  role: string;
  groups: NavGroup[];
  open: Record<string, boolean>;
  toggle: (label: string) => void;
};

const SidebarNavContext = createContext<SidebarNavContextType | undefined>(undefined);

export function SidebarNavProvider({
  role,
  groups,
  children,
}: {
  role: string;
  groups: NavGroup[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('nav.groups');
      return stored ? JSON.parse(stored) : {};
    }
    return {};
  });

  const toggle = (label: string) => {
    setOpen((prev) => {
      const next = { ...prev, [label]: !prev[label] };
      localStorage.setItem('nav.groups', JSON.stringify(next));
      return next;
    });
  };

  useEffect(() => {
    // Scroll to active group on mount
    setTimeout(() => {
      const el = document.querySelector('[data-active-group]');
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  }, []);

  return (
    <SidebarNavContext.Provider value={{ role, groups, open, toggle }}>
      {children}
    </SidebarNavContext.Provider>
  );
}

export function useSidebarNav() {
  const ctx = useContext(SidebarNavContext);
  if (!ctx) throw new Error('useSidebarNav must be used within SidebarNavProvider');
  return ctx;
}
