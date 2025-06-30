import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { getCookieStore } from "../safeCookies";
import { Database } from "../../types/supabase";

export async function createClientWithContext() {
    const cookieStore = await getCookieStore();
  
    return createServerComponentClient<Database>({
      cookies: () => cookieStore as any, // <-- temporary workaround
    });
  }
  