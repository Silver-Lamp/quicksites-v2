import { getServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function MyTax() {
  const supa = await getServerSupabase();
  const { data: u } = await supa.auth.getUser();
  if (!u?.user) return <div className="p-8">Please sign in.</div>;

  const { data: profile } = await supa
    .from('affiliate_tax_profiles')
    .select('*').eq('user_id', u.user.id).maybeSingle();

  async function save(fd: FormData) {
    'use server';
    const svc = await getServerSupabase(); // normal session; RLS owner will apply
    const payload = {
      user_id: u?.user?.id,
      form_type: String(fd.get('form_type') || 'w9'),
      entity_type: String(fd.get('entity_type') || 'individual'),
      legal_name: String(fd.get('legal_name') || ''),
      business_name: String(fd.get('business_name') || ''),
      tin_type: String(fd.get('tin_type') || ''),
      tin_last4: String(fd.get('tin_last4') || ''),
      address1: String(fd.get('address1') || ''),
      address2: String(fd.get('address2') || ''),
      city: String(fd.get('city') || ''),
      region: String(fd.get('region') || ''),
      postal_code: String(fd.get('postal_code') || ''),
      country: String(fd.get('country') || 'US'),
      backup_withholding: String(fd.get('backup_withholding') || 'off') === 'on',
      signed_at: new Date().toISOString(),
    };
    await svc.from('affiliate_tax_profiles').upsert(payload, { onConflict: 'user_id' });
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Tax Profile</h1>
      <form action={save} className="mt-6 grid grid-cols-1 gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-neutral-400">Form</label>
            <select name="form_type" defaultValue={profile?.form_type || 'w9'}
              className="mt-1 w-full rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800">
              <option value="w9">W-9 (U.S.)</option>
              <option value="w8ben">W-8BEN (non-U.S.)</option>
              <option value="w8bene">W-8BEN-E (non-U.S.)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-neutral-400">Entity</label>
            <select name="entity_type" defaultValue={profile?.entity_type || 'individual'}
              className="mt-1 w-full rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800">
              <option value="individual">individual</option>
              <option value="sole_prop">sole_prop</option>
              <option value="c_corp">c_corp</option>
              <option value="s_corp">s_corp</option>
              <option value="llc">llc</option>
              <option value="partnership">partnership</option>
              <option value="nonprofit">nonprofit</option>
              <option value="attorney">attorney</option>
              <option value="other">other</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-neutral-400">Legal name</label>
            <input name="legal_name" defaultValue={profile?.legal_name || ''} className="mt-1 w-full rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800"/>
          </div>
          <div>
            <label className="block text-xs text-neutral-400">Business name</label>
            <input name="business_name" defaultValue={profile?.business_name || ''} className="mt-1 w-full rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800"/>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-neutral-400">TIN type</label>
            <select name="tin_type" defaultValue={profile?.tin_type || ''} className="mt-1 w-full rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800">
              <option value="">—</option>
              <option value="ssn">SSN</option>
              <option value="ein">EIN</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-neutral-400">TIN last 4</label>
            <input name="tin_last4" defaultValue={profile?.tin_last4 || ''} maxLength={4}
              className="mt-1 w-full rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800"/>
          </div>
          <div className="flex items-end">
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" name="backup_withholding" defaultChecked={!!profile?.backup_withholding} />
              Backup withholding (24%)
            </label>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-xs text-neutral-400">Address 1</label><input name="address1" defaultValue={profile?.address1||''} className="mt-1 w-full rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800"/></div>
          <div><label className="block text-xs text-neutral-400">Address 2</label><input name="address2" defaultValue={profile?.address2||''} className="mt-1 w-full rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800"/></div>
          <div><label className="block text-xs text-neutral-400">City</label><input name="city" defaultValue={profile?.city||''} className="mt-1 w-full rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800"/></div>
          <div><label className="block text-xs text-neutral-400">State/Region</label><input name="region" defaultValue={profile?.region||''} className="mt-1 w-full rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800"/></div>
          <div><label className="block text-xs text-neutral-400">Postal</label><input name="postal_code" defaultValue={profile?.postal_code||''} className="mt-1 w-full rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800"/></div>
          <div><label className="block text-xs text-neutral-400">Country</label><input name="country" defaultValue={profile?.country||'US'} className="mt-1 w-full rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800"/></div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium">Save</button>
        </div>
      </form>
    </div>
  );
}
