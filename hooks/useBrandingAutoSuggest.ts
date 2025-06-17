import { useEffect } from 'react';
import toast from 'react-hot-toast';

export function useBrandingAutoSuggest({
  template,
  brandingProfiles,
  selectedProfileId,
  setSelectedProfileId,
}: {
  template: any;
  brandingProfiles: any[];
  selectedProfileId: string | null;
  setSelectedProfileId: (id: string) => void;
}) {
  useEffect(() => {
    if (!template || !brandingProfiles?.length || selectedProfileId) return;

    const match = brandingProfiles.find(
      (p) =>
        (template?.industry &&
          p.name.toLowerCase().includes(template?.industry.toLowerCase())) ||
        (template.layout &&
          p.name.toLowerCase().includes(template.layout.toLowerCase()))
    );

    if (match) {
      setSelectedProfileId(match.id);
      toast.success(`Auto-selected branding profile: ${match.name}`);
    }
  }, [
    template?.industry,
    template?.layout,
    brandingProfiles,
    selectedProfileId,
  ]);
}
