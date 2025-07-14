'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type PanelState = Record<string, boolean>;

type PanelContextType = {
  panels: PanelState;
  setPanel: (id: string, open: boolean) => void;
  togglePanel: (id: string) => void;
  resetPanels: () => void;
  openAll: () => void;
  closeAll: () => void;
};

const PanelContext = createContext<PanelContextType | undefined>(undefined);

export function PanelProvider({ children }: { children: React.ReactNode }) {
  const [panels, setPanels] = useState<PanelState>(() => {
    if (typeof window === 'undefined') return {};
    const entries = Object.entries(localStorage)
      .filter(([key]) => key.startsWith('panel-'))
      .map(([key, val]) => [key.replace('panel-', ''), val === 'true']);
    return Object.fromEntries(entries);
  });

  const setPanel = (id: string, open: boolean) => {
    setPanels((prev) => {
      const next = { ...prev, [id]: open };
      localStorage.setItem(`panel-${id}`, open.toString());
      return next;
    });
  };

  const togglePanel = (id: string) => {
    setPanel(id, !panels[id]);
  };

  const resetPanels = () => {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('panel-'))
      .forEach((k) => localStorage.removeItem(k));
    setPanels({});
  };

  const openAll = () => {
    const updated: PanelState = {};
    for (const id of Object.keys(panels)) {
      updated[id] = true;
      localStorage.setItem(`panel-${id}`, 'true');
    }
    setPanels(updated);
  };

  const closeAll = () => {
    const updated: PanelState = {};
    for (const id of Object.keys(panels)) {
      updated[id] = false;
      localStorage.setItem(`panel-${id}`, 'false');
    }
    setPanels(updated);
  };

  return (
    <PanelContext.Provider value={{ panels, setPanel, togglePanel, resetPanels, openAll, closeAll }}>
      {children}
    </PanelContext.Provider>
  );
}

export function usePanel(id: string, defaultOpen = false): [boolean, () => void] {
  const context = useContext(PanelContext);
  if (!context) throw new Error('usePanel must be used within a PanelProvider');

  const open = context.panels[id] ?? defaultOpen;
  const toggle = () => context.togglePanel(id);

  return [open, toggle];
}

export function usePanelControls() {
  const context = useContext(PanelContext);
  if (!context) throw new Error('usePanelControls must be used within a PanelProvider');
  return context;
}
