// app/admin/hear-this-page/page.tsx
//
// Super-admin config for the platform "Hear this page" launcher (Phase 2): per public
// surface, enable it + pick which registers it offers. Summary is the always-on baseline.
// The master ON switch (and billing gate) is the NEXT_PUBLIC_HEAR_THIS_PAGE_ENABLED env
// flag; this page controls what shows once that's on.

import { getAdminUser } from '@/lib/auth/getAdminUser';
import HearThisPageSettingsClient from '@/components/admin/hear-this-page-settings';

export const dynamic = 'force-dynamic';

export default async function HearThisPageAdminPage() {
  const admin = await getAdminUser();
  if (!admin) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-sm text-red-500">Forbidden — platform admin only.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold">🎙️ Hear this page</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        The platform-wide narrated-audio launcher. Choose, per public surface, whether it
        appears and which versions it offers — the short version is the always-on default.
      </p>
      <div className="mt-6">
        <HearThisPageSettingsClient />
      </div>
    </div>
  );
}
