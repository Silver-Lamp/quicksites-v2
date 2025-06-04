type PublishFormProps = {
  slug: string;
  setSlug: (v: string) => void;
  profileId: string;
  setProfileId: (v: string) => void;
  versionLabel: string;
  setVersionLabel: (v: string) => void;
  brandingProfiles: any[];
  saving: boolean;
  isUpdateMode: boolean;
};

export default function PublishForm(props: PublishFormProps) {
  const {
    slug,
    setSlug,
    profileId,
    setProfileId,
    versionLabel,
    setVersionLabel,
    brandingProfiles,
    saving,
    isUpdateMode,
  } = props;

  return (
    <>
      <label className="text-sm">Slug</label>
      <input
        type="text"
        placeholder="e.g. towing-basic"
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
        disabled={saving || isUpdateMode}
        className="w-full border rounded px-2 py-1 dark:bg-gray-800"
      />

      <label className="text-sm">Branding Profile</label>
      <select
        value={profileId}
        onChange={(e) => setProfileId(e.target.value)}
        className="w-full border rounded px-2 py-1 bg-white dark:bg-gray-800"
        disabled={saving}
      >
        <option value="">Select profile</option>
        {brandingProfiles.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      <label className="text-sm">Version Label (optional)</label>
      <input
        type="text"
        placeholder="e.g. After homepage tweak"
        value={versionLabel}
        onChange={(e) => setVersionLabel(e.target.value)}
        disabled={saving}
        className="w-full border rounded px-2 py-1 dark:bg-gray-800"
      />
    </>
  );
}
