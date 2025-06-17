import type { Role } from '@/admin/utils/roles';
import { getRoleLabel } from '@/admin/utils/roles';

export default function RoleBadge({ role }: { role: Role | null }) {
  const label = getRoleLabel(role);
  const icon =
    role === 'admin'
      ? '🛡️'
      : role === 'owner'
        ? '⭐'
        : role === 'editor'
          ? '✏️'
          : role === 'viewer'
            ? '👁️'
            : '❓';
  const color =
    role === 'admin'
      ? 'red'
      : role === 'owner'
        ? 'yellow'
        : role === 'editor'
          ? 'blue'
          : role === 'viewer'
            ? 'gray'
            : 'zinc';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-${color}-900 text-${color}-300 border border-${color}-700`}
    >
      <span>{icon}</span>
      {label}
    </span>
  );
}
