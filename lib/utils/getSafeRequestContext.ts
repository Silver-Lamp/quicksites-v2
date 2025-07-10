import { useSafeCookies, type SafeCookiesResult } from './useSafeCookies';
import { useSafeHeaders, type SafeHeadersResult } from './useSafeHeaders';

export interface SafeRequestContext {
  cookies: SafeCookiesResult['cookies'];
  cookieMode: SafeCookiesResult['cookieMode'];
  headers: SafeHeadersResult['headers'];
  headerMode: SafeHeadersResult['headerMode'];
}

/**
 * Returns a unified interface to safe cookies and headers
 * across Server Components and Route Handlers.
 */
export function getSafeRequestContext(): SafeRequestContext {
  const { cookies, cookieMode } = useSafeCookies();
  const { headers, headerMode } = useSafeHeaders();

  return {
    cookies,
    cookieMode,
    headers,
    headerMode,
  };
}
