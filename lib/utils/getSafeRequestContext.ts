import { SafeRequestContext } from "@/lib/context/getClientContext";
import { useSafeCookies } from "./useSafeCookies";
import { useSafeHeaders } from "./useSafeHeaders";

export function useSafeRequestContext(): SafeRequestContext {
  const { cookies, cookieMode } = useSafeCookies();
  const { headers, headerMode } = useSafeHeaders();

  return {
    cookies,
    cookieMode,
    headers,
    headerMode,
  };
}
