// lib/dev/supabaseCookie.ts
export function tryDecodeSupabaseCookie(value: string) {
    // sb-<project>-auth-token is "base64-<b64(json)>"
    if (!value?.startsWith('base64-')) return null;
    try {
      const json = atob(value.slice('base64-'.length));
      return JSON.parse(json); // { access_token, refresh_token, expires_at, user, ... }
    } catch {
      return null;
    }
  }
  