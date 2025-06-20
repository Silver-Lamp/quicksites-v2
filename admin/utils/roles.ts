export enum Role {
  Admin = 'admin',
  Owner = 'owner',
  Editor = 'editor',
  Viewer = 'viewer',
}

export function isOrgAdmin(role: Role | null): boolean {
  return role === Role.Admin || role === Role.Owner;
}

export function isViewerOnly(role: Role | null, permissions: string[]): boolean {
  return role === Role.Viewer || permissions.length === 0;
}

export function hasRole(current: Role | null, target: Role | Role[]): boolean {
  if (!current) return false;
  return Array.isArray(target) ? target.includes(current) : current === target;
}

export function getRoleLabel(role: Role | null): string {
  switch (role) {
    case Role.Admin:
      return 'Administrator';
    case Role.Owner:
      return 'Owner';
    case Role.Editor:
      return 'Editor';
    case Role.Viewer:
      return 'Viewer';
    default:
      return 'Unknown';
  }
}
