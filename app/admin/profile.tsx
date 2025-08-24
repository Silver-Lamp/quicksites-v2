'use client';
import ProfileForm from '@/components/profile-form';
import AppHeader from '@/components/admin/AppHeader/app-header';

export default function AdminProfilePage() {
  return (
    <div className="flex flex-col gap-4">
      <AppHeader />
        <div className="max-w-xl mx-auto py-12 px-4">
          <h1 className="text-2xl font-bold mb-6">Profile Settings</h1>
          <ProfileForm />
        </div>
    </div>
  );
}
