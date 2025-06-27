'use server';

import { getSessionContext } from './getSessionContext';
import { getSlugContext } from './getSlugContext';

type RoleMap = Partial<Record<string, string>>;

type Options = {
  roleRoutes?: RoleMap;
  fallbackRoute?: string;
  replacements?: Record<string, string>;
};

type RedirectTargetResult = {
  path: string;
  role: string;
  slug: string;
  user: {
    id: string;
    email: string | null;
  } | null;
  slugContext: {
    source: 'header' | 'cookie' | 'host' | 'lookup' | 'default';
    host: string;
    domain?: string;
    tenantId?: string | null;
  };
};

/**
 * Resolves the redirect path a user should be routed to based on their role and slug context.
 * Supports route templates like /viewer/:slug and dynamic slug resolution via host, cookie, or lookup.
 */
export async function getRoleRedirectTarget({
  roleRoutes = {
    admin: '/admin/dashboard',
    owner: '/admin/dashboard',
    reseller: '/admin/dashboard',
    viewer: '/viewer/:slug',
  },
  fallbackRoute = '/unauthorized',
  replacements = {},
}: Options = {}): Promise<RedirectTargetResult> {
  const { user, role } = await getSessionContext();
  const slugContext = await getSlugContext({
    subdomainSlugMode: true,
    resolveTenantId: true,
  });

  const { slug } = slugContext;

  const template = user
    ? roleRoutes[role] || fallbackRoute
    : '/login';

  const tokenMap: Record<string, string> = {
    slug,
    role,
    ...(replacements || {}),
  };

  const resolvedPath = template.replace(/:([a-zA-Z0-9_]+)/g, (_, key) =>
    tokenMap[key] ?? `:${key}`
  );

  return {
    path: resolvedPath,
    role,
    slug,
    user: user
      ? { id: user.id, email: user.email }
      : null,
    slugContext,
  };
}
