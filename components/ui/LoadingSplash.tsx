// components/ui/LoadingSplash.tsx
export default function LoadingSplash() {
    return (
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/55 backdrop-blur-md"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="flex flex-col items-center gap-4">
          {/* Replace with your logo if you want */}
          <div className="h-14 w-14 rounded-2xl bg-white/10 animate-pulse" />
          <div className="text-sm text-white/90">Loading…</div>
        </div>
      </div>
    );
  }
  