import { getServerSupabaseClient } from '@/lib/supabase/serverClient';import { getReadableCookieStore } from "../utils/getReadableCookieStore";

export async function createClientWithContext() {
    const cookieStore = await getReadableCookieStore();
  
    return getServerSupabaseClient();
  }
  