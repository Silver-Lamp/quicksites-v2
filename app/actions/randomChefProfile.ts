// app/actions/randomChefProfile.ts
'use server';

import { generateRandomChefProfile } from '@/admin/lib/randomChefProfile';

export async function randomChefProfile() {
  return generateRandomChefProfile();
}
