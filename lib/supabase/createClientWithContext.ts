import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { getReadableCookieStore } from "../utils/getReadableCookieStore";
import { Database } from "../../types/supabase";

export async function createClientWithContext() {
    const cookieStore = await getReadableCookieStore();
  
    return createServerComponentClient<Database>({
      cookies: () => cookieStore as any, // <-- temporary workaround
    });
  }
  