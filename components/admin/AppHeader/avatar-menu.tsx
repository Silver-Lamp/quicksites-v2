// components/admin/AppHeader/AvatarMenu.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, UserCircle } from 'lucide-react';
import md5 from 'blueimp-md5';
import { RoleBadge } from './role-badge';

export function AvatarMenu({
  email,
  avatarUrl,
  role,
  source,
  onLogout,
}: {
  email?: string;
  avatarUrl?: string;
  role?: string;
  source?: string;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const avatar =
    avatarUrl ||
    `https://gravatar.com/avatar/${email ? md5(email.trim().toLowerCase()) : 'unknown'}?d=identicon`;
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
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

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="focus:outline-none"
        aria-label="Avatar menu"
      >
        <div className="w-6 h-6 sm:w-5 sm:h-5 rounded-full overflow-hidden border border-white">
          <img src={avatar} alt="avatar" className="w-full h-full object-cover" />
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -5 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-48 bg-zinc-900 border border-zinc-700 rounded shadow-xl text-xs z-50 p-2 space-y-2"
          >
            <div className="flex items-center gap-2 text-gray-300">
              <UserCircle size={14} />
              <span className="truncate">{email}</span>
            </div>
            <RoleBadge role={role} source={source} />
            <button
              onClick={onLogout}
              className="flex items-center gap-2 text-red-400 hover:underline text-left w-full"
            >
              <LogOut size={14} />
              Log Out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
