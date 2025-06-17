// ✅ FILE: lib/resolveAdminPath.ts

export function resolveAdminPath(path: string): string {
  if (
    path.startsWith('/') &&
    !path.startsWith('/admin') &&
    !path.startsWith('/login') &&
    !path.startsWith('/register') &&
    !path.startsWith('/sites')
  ) {
    return `/admin${path}`;
  }
  return path;
}
