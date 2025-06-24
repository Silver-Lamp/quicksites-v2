import { renderHook } from '@testing-library/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Role } from '@/admin/utils/roles';
import { describe, expect, it, vi } from 'vitest';

// Mock the supabase session hook
vi.mock('@supabase/auth-helpers-react', () => ({
  useSession: () => ({
    user: {
      email: 'admin@example.com',
      user_profiles: {
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

    expect(result.current.user?.email).toBe('admin@example.com');
    expect(result.current.role).toBe(Role.Admin);
    expect(result.current.roleSource).toBe('user_profiles');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.ready).toBe(true);
    expect(result.current.hasRole([Role.Admin])).toBe(true);
    expect(result.current.hasRole([Role.Owner, Role.Editor])).toBe(false);
    expect(result.current.user?.role).toBe(Role.Admin);
    // expect(result.current.user?.permissions).toContain('view_logs');
    // expect(result.current.user?.team).toBe('alpha');
    // expect(result.current.user?.org).toBe('quicksites');
  });
});
