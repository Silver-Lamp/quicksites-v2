'use client';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@/types/supabase';

const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';

export const supabase = createClientComponentClient<Database>({
  cookieOptions: {
    name: 'sb',
    path: '/',
    sameSite: 'Lax',
    domain: isLocalhost ? 'localhost' : '.yourdomain.com',
    secure: !isLocalhost,
  },
});

