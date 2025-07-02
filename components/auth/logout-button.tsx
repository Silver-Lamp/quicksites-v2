'use client';

import { supabase } from '@/lib/supabase/client';

export default function LogoutButton() {
  const handleLogout = async () => {
    try {
      // 🚪 Global logout: invalidates server-side refresh token
      await supabase.auth.signOut({ scope: 'global' });

      // 🧹 Clear local auth cookies (incl. PKCE code-verifier)
      const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.split('https://')[1]?.split('.')[0];

      const cookiesToClear = [
        `sb-${projectRef}-auth-token`,
        `sb-${projectRef}-auth-token-code-verifier`,
      ];

      cookiesToClear.forEach((cookieName) => {
        document.cookie = `${cookieName}=; Max-Age=0; path=/;`;
        console.log(`[🧼 Cleared cookie: ${cookieName}]`);
      });

      // Optional: clear dev-only login error
      localStorage.removeItem('lastLoginError');
    } catch (err) {
      console.error('[❌ Logout Failed]', err);
    }

    // 🔁 Redirect to login or homepage
    window.location.href = '/login';
  };

  return (
    <button onClick={handleLogout} className="text-sm text-red-400 underline mt-4">
      Log out
    </button>
  );
}
