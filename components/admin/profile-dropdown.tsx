'use client';

import { Menu } from '@headlessui/react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/admin/lib/supabaseClient';
import Link from 'next/link';

export default function ProfileDropdown() {
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <Menu as="div" className="relative inline-block text-left">
      <Menu.Button className="rounded-full bg-zinc-700 text-white px-3 py-1 text-sm hover:bg-zinc-600">
        👤 Profile
      </Menu.Button>
      <Menu.Items className="absolute right-0 mt-2 w-36 origin-top-right rounded-md bg-zinc-800 shadow-lg ring-1 ring-zinc-900 focus:outline-none z-50">
        <div className="py-1">
          <Menu.Item>
            {({ active }) => (
              <Link
                href="/admin/profile"
                className={`block px-4 py-2 text-sm ${
                  active ? 'bg-zinc-700 text-white' : 'text-zinc-300'
                }`}
              >
                My Profile
              </Link>
            )}
          </Menu.Item>
          <Menu.Item>
            {({ active }) => (
              <button
                onClick={handleLogout}
                className={`w-full text-left px-4 py-2 text-sm ${
                  active ? 'bg-red-700 text-white' : 'text-red-400'
                }`}
              >
                Log Out
              </button>
            )}
          </Menu.Item>
        </div>
      </Menu.Items>
    </Menu>
  );
}
