import { useEffect, useState } from 'react';

const DRAFT_KEY = 'campaign-draft';

type DraftData = {
  city?: string;
  state?: string;
  industry?: string;
  selectedLeadIds?: string[];
  silentMode?: boolean;
  alt1?: string;
  alt2?: string;
};

export function useSavedCampaignDraft(): [
  DraftData,
  (draft: Partial<DraftData>) => void,
  () => void
] {
  const [draft, setDraft] = useState<DraftData>({});

  // Load on mount
  useEffect(() => {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) {
      try {
        setDraft(JSON.parse(raw));
      } catch {
        localStorage.removeItem(DRAFT_KEY);
      }
    }
  }, []);

  // Save subset
  const updateDraft = (partial: Partial<DraftData>) => {
    const next = { ...draft, ...partial };
    setDraft(next);
    localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
  };

  const clearDraft = () => {
    setDraft({});
    localStorage.removeItem(DRAFT_KEY);
  };

  return [draft, updateDraft, clearDraft];
}
