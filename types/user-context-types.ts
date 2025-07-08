// types/user-context-types.ts
import type { Role } from '@/admin/utils/roles';
import type { Session, User } from '@supabase/auth-helpers-react';
import type { ReactNode } from 'react';

export interface CurrentUserContext {
  session: Session | null;
  user: User | null;
  email: string | null;
  role: Role | null;
  org: string | null;
  team: string | null;
  permissions: string[];
  hasPermission: (code: string) => boolean;
  isInTeam: (name: string) => boolean;
  isOrgAdmin: boolean;
  isViewerOnly: boolean;
  hasRole: (target: Role | Role[]) => boolean;
  roleLabel: string;
  roleIcon: string;
  roleColor: string;
  roleBadge: () => ReactNode;
}
