'use client';
import ProfileForm from '@/components/profile-form';

export default function AdminProfilePage() {
  return (
    <div className="max-w-xl mx-auto py-12 px-4">
      <h1 className="text-2xl font-bold mb-6">Profile Settings</h1>
      <ProfileForm />
    </div>
  );
}
