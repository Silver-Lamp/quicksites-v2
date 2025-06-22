// admin/pages/reset.tsx

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/admin/lib/supabaseClient';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  const router = useRouter();

  useEffect(() => {
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setStatus('Ready to reset password.');
      }
    });
  }, []);

  const updatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setStatus(`Error: ${error.message}`);
    } else {
      setStatus('Password updated! Redirecting...');
      setTimeout(() => router.push('/login'), 2000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <form onSubmit={updatePassword} className="bg-white p-6 rounded shadow-md w-full max-w-sm">
        <h2 className="text-xl font-bold mb-4">Reset Password</h2>
        <p className="text-sm mb-4 text-gray-600">{status}</p>
        <input
          type="password"
          placeholder="New password"
          className="w-full border px-3 py-2 mb-4 rounded"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded">
          Update Password
        </button>
      </form>
    </div>
  );
}
