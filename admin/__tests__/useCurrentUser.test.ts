import { renderHook } from '@testing-library/react';
import { useCurrentUser } from '@/admin/hooks/useCurrentUser';
import { Role } from '@/admin/utils/roles';
import { describe, expect, it, vi } from 'vitest';
import { jest } from '@jest/globals';

// Mock the supabase session hook
vi.mock('@supabase/auth-helpers-react', () => ({
  useSession: () => ({
    user: {
      email: 'admin@example.com',
      user_metadata: {
        role: 'admin',
        permissions: ['view_logs', 'export_data'],
        team: 'alpha',
        org: 'quicksites',
      },
    },
  }),
}));

describe('useCurrentUser', () => {
  it('returns expected user info and role utilities', () => {
    const { result } = renderHook(() => useCurrentUser());

    expect(result.current.email).toBe('admin@example.com');
    expect(result.current.role).toBe(Role.Admin);
    expect(result.current.hasRole(Role.Admin)).toBe(true);
    expect(result.current.hasRole([Role.Owner, Role.Editor])).toBe(false);
    expect(result.current.isOrgAdmin).toBe(true);
    expect(result.current.isViewerOnly).toBe(false);
    expect(result.current.hasPermission('view_logs')).toBe(true);
    expect(result.current.isInTeam('alpha')).toBe(true);
    expect(result.current.isInTeam('beta')).toBe(false);
  });
});
