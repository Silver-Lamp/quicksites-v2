// lib/supabase/useSupabase.ts
'use client';

import { useMemo } from 'react';
import { supabase } from './client';
import type { SupabaseClient } from '@supabase/supabase-js';

export function useSupabase(): SupabaseClient {
  return useMemo(() => supabase, []);
}
