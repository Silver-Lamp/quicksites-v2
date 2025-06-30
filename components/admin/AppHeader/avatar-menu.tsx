'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, Loader2, UserCircle, Settings, User } from 'lucide-react';
import md5 from 'blueimp-md5';

import { RoleBadge } from './role-badge';
import { useSafeAuth } from '@/hooks/useSafeAuth';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export function AvatarMenu() {
  const { user, role, isLoggedIn } = useSafeAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const avatarUrl =
    user?.avatar_url ||
    `https://gravatar.com/avatar/${md5(user?.email?.trim().toLowerCase() ?? '')}?d=identicon`;

  const isAdmin = ['admin', 'owner', 'reseller'].includes(role);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      const supabase = createClientComponentClient();
      await supabase.auth.signOut();
      router.push('/login?logout=1');
      setTimeout(() => window.location.reload(), 300);
    } finally {
      setLoggingOut(false);
    }
  };

  if (!isLoggedIn || !user) return null;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="focus:outline-none"
        aria-label="Avatar menu"
      >
        <div className="w-6 h-6 sm:w-5 sm:h-5 rounded-full overflow-hidden border border-white">
          <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -5 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-56 bg-zinc-900 border border-zinc-700 rounded shadow-xl text-xs z-50 p-3 space-y-3"
          >
            <div className="flex items-center gap-2 text-gray-300">
              <UserCircle size={14} />
              <span className="truncate">{user.email}</span>
            </div>

            <RoleBadge role={role} />

            <div className="border-t border-zinc-700 pt-2 space-y-2">
              <button
                onClick={() => router.push('/profile')}
                className="flex items-center gap-2 hover:underline text-left text-gray-300 w-full"
              >
                <User size={14} />
                My Profile
              </button>

              {isAdmin && (
                <button
                  onClick={() => router.push('/admin/settings')}
                  className="flex items-center gap-2 hover:underline text-left text-gray-300 w-full"
                >
                  <Settings size={14} />
                  Admin Settings
                </button>
              )}
            </div>

            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className={`flex items-center gap-2 text-red-400 hover:underline text-left w-full ${
                loggingOut ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {loggingOut ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Logging out...
                </>
              ) : (
                <>
                  <LogOut size={14} />
                  Log Out
                </>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
