// app/admin/layout.tsx
import '@/styles/globals.css';
import AppHeader from '@/components/admin/AppHeader/app-header';
import { AdminNavSections } from '@/components/admin/AppHeader/AdminNavSections';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-zinc-950 text-white">
      <aside className="w-64 bg-zinc-900 text-white p-4 border-r border-zinc-800 flex-shrink-0 h-screen sticky top-0 overflow-y-auto">
        <AdminNavSections />
      </aside>

      <div className="flex flex-col flex-1 min-h-screen">
        <AppHeader />
        <main className="flex-1 p-6 overflow-x-auto">{children}</main>
      </div>
    </div>
  );
}
