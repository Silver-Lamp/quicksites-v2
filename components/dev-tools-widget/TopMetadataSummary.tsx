// components/dev-tools-widget/TopMetadataSummary.tsx
export function TopMetadataSummary({
    abVariant,
    sessionId,
    hasMockUser,
  }: {
    abVariant?: string;
    sessionId?: string;
    hasMockUser: boolean;
  }) {
    return (
      <div className="space-y-1 mb-2">
        {hasMockUser && (
          <div className="text-yellow-400 text-xs text-center">
            ⚠️ Mock user override is set. App state may not reflect real Supabase session.
          </div>
        )}
        {abVariant && (
          <div className="text-emerald-300 text-xs">AB Variant: {abVariant}</div>
        )}
        {sessionId && (
          <div className="text-blue-300 text-xs">Session ID: {sessionId.slice(0, 8)}…</div>
        )}
      </div>
    );
  }
  