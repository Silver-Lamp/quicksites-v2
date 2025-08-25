import { test, expect } from '@playwright/test';
import fetch from 'node-fetch';

type BrandingProfile = {
  id: string;
  name: string;
  theme: string;
  brand: string;
  accent_color: string;
  logo_url?: string;
};

type SnapshotResponse = {
  url: string;
  id?: string; // assume this is included in API response
};

test('branding snapshot end-to-end flow (with cleanup)', async () => {
  const brandingProfileInput = {
    name: 'Test Blue Light',
    theme: 'light',
    brand: 'blue',
    accent_color: '#3b82f6',
    logo_url: '',
  };

  let brandingProfileId: string | undefined;
  let snapshotId: string | undefined;

  try {
    // Create branding profile
    const brandingRes = await fetch('http://localhost:3000/api/admin/create-branding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(brandingProfileInput),
    });

    expect(brandingRes.status).toBe(200);
    const profile: BrandingProfile = (await brandingRes.json()) as BrandingProfile;
    expect(profile?.id).toBeDefined();
    brandingProfileId = profile.id;

    // Create snapshot
    const snapshotInput = {
      template_name: 'Test Snapshot',
      data: {
        pages: [{ content_blocks: [{ type: 'hero', content: 'Hello OG World' }] }],
      },
      editor_email: 'support@quicksites.ai',
      branding_profile_id: profile.id,
    };

    const snapRes = await fetch('http://localhost:3000/api/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshotInput),
    });

    expect(snapRes.status).toBe(200);
    const snap: SnapshotResponse = (await snapRes.json()) as SnapshotResponse;
    expect(snap?.url).toContain('/shared/');
    snapshotId = snap.url.split('/').pop();

    // Verify OG image route
    const ogRes = await fetch(`http://localhost:3000/api/og/snapshot?snapshotId=${snapshotId}`);
    expect(ogRes.status).toBe(200);
  } finally {
    // Cleanup: delete snapshot + branding profile if created
    if (snapshotId) {
      await fetch(`http://localhost:3000/api/admin/delete-snapshot?snapshotId=${snapshotId}`, {
        method: 'DELETE',
      });
    }

    if (brandingProfileId) {
      await fetch(`http://localhost:3000/api/admin/delete-branding?id=${brandingProfileId}`, {
        method: 'DELETE',
      });
    }
  }
});
