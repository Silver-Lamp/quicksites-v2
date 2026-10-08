'use client';

// components/starter-kit/print-button.tsx — the only JavaScript on the starter-kit page.
export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 shadow hover:bg-emerald-400 print:hidden"
    >
      Print the kit
    </button>
  );
}
