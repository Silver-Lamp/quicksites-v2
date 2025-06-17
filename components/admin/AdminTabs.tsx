'use client';

import Link from 'next/link';
import { useRouter } from 'next/router';
import { FiGrid, FiFileText, FiGlobe, FiUsers, FiMenu } from 'react-icons/fi';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient.js';

const allTabs = [
  { label: 'Dashboard', href: '/admin/sites/dashboard', icon: FiGrid },
  {
    label: 'Logs',
    href: '/admin/logs/dashboard',
    icon: FiFileText,
    roles: ['admin'],
  },
  { label: 'Sites', href: '/admin/sites', icon: FiGlobe },
  { label: 'Users', href: '/admin/users', icon: FiUsers, roles: ['admin'] },
];

export default function AdminTabs() {
  const { pathname } = useRouter();
  const [role, setRole] = useState<string>('user');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const userRole = data.user?.user_metadata?.role || 'user';
      setRole(userRole);
    });
  }, []);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/');

  const tabs = allTabs.filter((tab) => !tab.roles || tab.roles.includes(role));

  return (
    <div className="border-b border-gray-300 mb-4 px-4">
      <div className="flex justify-between items-center py-2">
        <span className="text-sm font-semibold text-gray-600">Admin Panel</span>
        <button onClick={() => setOpen(!open)} className="md:hidden">
          <FiMenu className="w-5 h-5" />
        </button>
      </div>
      <nav
        className={`flex flex-col md:flex-row gap-3 md:gap-4 text-sm transition-all ${
          open ? 'block' : 'hidden md:flex'
        }`}
      >
        {tabs.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-1 pb-1 border-b-2 ${
              isActive(href)
                ? 'text-blue-600 border-blue-600 font-medium'
                : 'text-gray-600 border-transparent hover:text-blue-500'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
