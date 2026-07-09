// app/profile/page.tsx
'use client';

import ProfileForm from '@/components/profile-form';

export default function ProfilePage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-10">
      <ProfileForm />
    </div>
  );
}
