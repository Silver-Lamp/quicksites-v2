// app/profile/page.tsx
'use client';

import ProfileForm from '../../components/profile-form';

export default function ProfilePage() {
  return (
    <div className="max-w-xl mx-auto py-12 px-4">
      <h1 className="text-2xl font-bold mb-6">Your Profile</h1>
      <ProfileForm />
    </div>
  );
}
