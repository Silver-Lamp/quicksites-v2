'use client';
import { NextSeo } from 'next-seo';
const seo = usePageSeo({
  description: 'Contact page.',
});

import { usePageSeo } from '@/lib/usePageSeo';
import { useState } from 'react';

export default function ContactPage() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [sent, setSent] = useState(false);

  const submit = async () => {
    await fetch('/api/contact', {
      method: 'POST',
      body: JSON.stringify({ email, message: msg }),
    });
    setSent(true);
  };

  return (
    <>
      <NextSeo {...seo} />
      <div className="text-white p-6 max-w-lg mx-auto text-center">
        <h1 className="text-2xl font-bold mb-4">📞 Contact Us</h1>
        {!sent ? (
          <>
            <input
              type="email"
              placeholder="your@email.com"
              className="w-full p-2 mb-3 bg-zinc-800 rounded"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <textarea
              placeholder="Your message..."
              className="w-full p-2 h-28 mb-3 bg-zinc-800 rounded"
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
            />
            <button onClick={submit} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded">
              Send Message
            </button>
          </>
        ) : (
          <p className="text-green-400 font-medium mt-6">✅ Message sent. Thank you!</p>
        )}
      </div>
    </>
  );
}
