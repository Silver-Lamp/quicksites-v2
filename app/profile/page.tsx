// app/profile/page.tsx
'use client';

import AppHeader from '@/components/admin/AppHeader/app-header';
import ProfileForm from '@/components/profile-form';
import AdminNav from '@/components/admin/admin-sidebar';

export default function ProfilePage() {
  return (
    <div className="flex flex-col gap-4">
      <AppHeader />
      <AdminNav />
      <div className="max-w-xl mx-auto py-12 px-4">
        <ProfileForm />
      </div>
    </div>
  );
}
