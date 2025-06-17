import { tokens } from '../../styles/tokens.js';

export default function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        backgroundColor: tokens.colors.surface,
        color: tokens.colors.text,
        padding: tokens.spacing.md,
        borderRadius: tokens.radius.md,
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.15)',
      }}
    >
      {children}
    </div>
  );
}
