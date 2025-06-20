export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full px-3 py-2 rounded-md bg-zinc-800 text-white border border-zinc-700 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-accent"
    />
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-text mb-1">{children}</label>;
}
