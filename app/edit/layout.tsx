// app/admin/edit/layout.tsx

export default function MinimalEditorLayout({ children }: { children: React.ReactNode }) {
  return (
    // <div className=" bg-zinc-950 text-white p-6">
    <div className="w-full h-full bg-background text-white p-6">
      {children}
    </div>
  );
}
