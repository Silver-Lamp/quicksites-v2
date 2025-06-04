import { useSession } from '@supabase/auth-helpers-react';
import { Role, isOrgAdmin, isViewerOnly, hasRole as hasRoleUtil, getRoleLabel } from '@/admin/utils/roles';
import RoleBadge from '@/components/admin/RoleBadge';
import type { ReactNode } from 'react';
import type { CurrentUserContext } from '@/admin/types/UserContextTypes';

export function useCurrentUser(): CurrentUserContext {
  const session = useSession();
  const user = session?.user ?? null;
  const email = user?.email || null;
  const role = user?.user_metadata?.role as Role || null;
  const org = user?.user_metadata?.org || null;
  const team = user?.user_metadata?.team || null;
  const permissions = user?.user_metadata?.permissions || [];

  function hasPermission(code: string) {
    return permissions.includes(code);
  }

  function isInTeam(name: string) {
    return team === name;
  }

  return {
    session,
    user,
    email,
    role,
    org,
    team,
    permissions,
    hasPermission,
    isInTeam,
    isOrgAdmin: isOrgAdmin(role),
    isViewerOnly: isViewerOnly(role, permissions),
    hasRole: (target) => hasRoleUtil(role, target),
    roleLabel: getRoleLabel(role),
    roleIcon: role === Role.Admin ? '🛡️' :
              role === Role.Owner ? '⭐' :
              role === Role.Editor ? '✏️' :
              role === Role.Viewer ? '👁️' : '❓',
    roleColor: role === Role.Admin ? 'red' :
               role === Role.Owner ? 'yellow' :
               role === Role.Editor ? 'blue' :
               role === Role.Viewer ? 'gray' : 'zinc',
    roleBadge: (): ReactNode => (<RoleBadge role={role} />)
  };
}
