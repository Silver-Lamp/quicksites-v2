export function useSelectedLeadsWrapper(
    selectedLeads: string[],
    toggleLead: (id: string) => void
  ): {
    setSelectedLeadIds: (ids: string[]) => void;
  } {
    return {
      setSelectedLeadIds: (ids: string[]) => {
        const current = new Set(selectedLeads);
        const next = new Set(ids);
  
        // Deselect leads not in new list
        for (const id of current) {
          if (!next.has(id)) toggleLead(id);
        }
  
        // Select new leads not already selected
        for (const id of next) {
          if (!current.has(id)) toggleLead(id);
        }
      },
    };
  }
  