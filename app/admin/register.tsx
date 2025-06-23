import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/admin/lib/supabaseClient';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [referrerId, setReferrerId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref) {
      localStorage.setItem('referrer_id', ref);
      setReferrerId(ref);
    }
  }, []);

  const register = async (e: any) => {
    e.preventDefault();

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role: 'reseller',
          referrer_id: localStorage.getItem('referrer_id') || null,
        },
      },
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage('Registration successful! Check your email.');
      setEmail('');
      setPassword('');
    }
  };

  return (
    <div className="p-6 max-w-md mx-auto text-white">
      <h1 className="text-2xl font-bold mb-4">Register</h1>
      <form onSubmit={register} className="space-y-4">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600"
          required
        />
        {referrerId && (
          <p className="text-xs text-gray-400">Signing up via referral: {referrerId}</p>
        )}
        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded text-white"
        >
          Create Account
        </button>
        {message && <p className="text-sm text-green-400 mt-2">{message}</p>}
      </form>
    </div>
  );
}
