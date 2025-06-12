// components/admin/AppHeader/RoleBadge.tsx
export function RoleBadge({ role, source }: { role?: string; source?: string }) {
    if (!role) return null;
    const color =
      role === 'admin'
        ? 'bg-red-500'
        : role === 'owner'
        ? 'bg-yellow-400'
        : role === 'reseller'
        ? 'bg-purple-500'
        : 'bg-gray-500';
  
    return (
      <span
        className={`text-white text-xs px-2 py-0.5 rounded ${color}`}
        title={`role: ${role} (from: ${source})\\ncolors: red=admin, yellow=owner, purple=reseller`}
      >
        {role.toUpperCase()}
      </span>
    );
  }
  