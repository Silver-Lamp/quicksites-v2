import { useState, FormEvent } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';
import { useRedirectAfterLogin } from '@/admin/hooks/useRedirectAfterLogin';

export default function LoginPage() {
  useRedirectAfterLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [useMagicLink, setUseMagicLink] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    if (!email) return setError('Please enter your email.');

    if (useMagicLink) {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false }
      });
      if (error) setError(error.message);
      else setError('Check your email for a magic login link.');
    } else {
      if (!password) return setError('Please enter your password.');
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else router.push('/dashboard');
    }
  };

  const handleForgotPassword = async () => {
    if (!email) return setError('Enter your email to reset your password.');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'http://localhost:3000/reset'
    });
    if (error) setError(error.message);
    else setError('Password reset link sent. Check your inbox.');
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900 px-4">
      <form
        onSubmit={handleLogin}
        className="bg-gray-800 text-white shadow-md rounded px-8 pt-6 pb-8 w-full max-w-md"
      >
        <h2 className="text-2xl font-bold mb-6 text-center">Admin Login</h2>

        {error && (
          <div className="mb-4 text-sm text-red-400 bg-red-900/30 p-2 rounded">
            {error}
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-semibold mb-1">Email</label>
          <input
            type="email"
            className="w-full bg-gray-700 border border-gray-600 px-3 py-2 rounded text-white"
            placeholder="admin@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        {!useMagicLink && (
          <div className="mb-4">
            <label className="block text-sm font-semibold mb-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                className="w-full bg-gray-700 border border-gray-600 px-3 py-2 rounded text-white"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="absolute right-2 top-2 text-xs text-blue-400"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between text-sm mb-4">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={useMagicLink}
              onChange={() => setUseMagicLink(!useMagicLink)}
            />
            <span>Use magic link instead</span>
          </label>

          <button
            type="button"
            className="text-blue-400 hover:underline"
            onClick={handleForgotPassword}
          >
            Forgot password?
          </button>
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded"
        >
          {useMagicLink ? 'Send Magic Link' : 'Log In'}
        </button>
      </form>
    </div>
  );
}
