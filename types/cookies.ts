// types/cookies.ts

/**
 * Shared CookieOptions type compatible with ResponseCookies.set()
 * Used in server actions or route handlers.
 */
export type CookieOptions = {
    path?: string;
    domain?: string;
    maxAge?: number;
    expires?: Date;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'lax' | 'strict' | 'none';
  };
  