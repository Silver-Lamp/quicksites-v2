// types/user-context-types.ts
import type { Session, User } from '@supabase/supabase-js';
import type { ReactNode } from 'react';

export type Role = 'admin' | 'owner' | 'editor' | 'viewer';

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
