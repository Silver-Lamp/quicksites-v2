// app/login/login-client.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';

export default function LoginClient() {
  const recaptchaRef = useRef<ReCAPTCHA | null>(null);

  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // ✅ Autofill in dev mode
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      setEmail('sandon@quicksites.ai');
    }
  }, []);

  const handleLogin = async () => {
    setLoading(true);
    const token = await recaptchaRef.current?.executeAsync();
    recaptchaRef.current?.reset();

    if (!token) {
      setMessage('❌ reCAPTCHA failed. Please try again.');
      setLoading(false);
      return;
    }

    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, recaptchaToken: token }),
    });

    const data = await res.json();
    setMessage(
      res.ok
        ? '✅ Check your email for the magic link.'
        : `❌ ${data.error || 'Login failed.'}`
    );
    setLoading(false);
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-background text-foreground px-4">
      <div className="w-full max-w-md bg-zinc-900 p-8 rounded-xl shadow-lg space-y-6">
        <h1 className="text-2xl font-extrabold text-center">Login</h1>

        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleLogin();
            }
          }}
          placeholder="you@example.com"
          className="w-full px-4 py-2 rounded-md bg-zinc-800 text-white border border-zinc-700 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-md font-medium transition disabled:opacity-50"
        >
          {loading ? 'Sending...' : 'Send Magic Link'}
        </button>

        {message && (
          <p
            className={`text-sm text-center ${
              message.startsWith('✅') ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {message}
          </p>
        )}

        <ReCAPTCHA
          sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY!}
          size="invisible"
          ref={recaptchaRef}
        />
      </div>
    </main>
  );
}
