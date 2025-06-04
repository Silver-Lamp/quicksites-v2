import { test, expect } from '@playwright/test';
import fetch from 'node-fetch';

test('branding snapshot end-to-end flow', async () => {
  const brandingProfile = {
    name: 'Test Blue Light',
    theme: 'light',
    brand: 'blue',
    accent_color: '#3b82f6',
    logo_url: ''
  };

  const brandingRes = await fetch('http://localhost:3000/api/admin/create-branding', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(brandingProfile)
  });

  const profile = await brandingRes.json();
  expect(profile?.id).toBeDefined();

  const snapshot = {
    template_name: 'Test Snapshot',
    data: {
      pages: [{ content_blocks: [{ type: 'hero', content: 'Hello OG World' }] }]
    },
    editor_email: 'dev@quicksites.ai',
    branding_profile_id: profile.id
  };

  const snapRes = await fetch('http://localhost:3000/api/share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(snapshot)
  });

  const snap = await snapRes.json();
  expect(snap?.url).toContain('/shared/');

  const ogRes = await fetch(`http://localhost:3000/api/og/snapshot?snapshotId=${snap.url.split('/').pop()}`);
  expect(ogRes.status).toBe(200);
});
