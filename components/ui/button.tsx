import { tokens } from '@/styles/tokens';

export function PrimaryButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        backgroundColor: tokens.colors.brand,
        color: '#fff',
        padding: `${tokens.spacing.xs} ${tokens.spacing.sm}`,
        borderRadius: tokens.radius.sm,
        border: 'none',
      }}
    >
      {children}
    </button>
  );
}
