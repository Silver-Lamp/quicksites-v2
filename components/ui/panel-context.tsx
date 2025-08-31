'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

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

/* ----------------------------- storage helpers ---------------------------- */

const PREFIX = 'panel-';

function hasWindow() {
  return typeof window !== 'undefined';
}

// read preferring localStorage, falling back to sessionStorage
function getKV(key: string): string | null {
  if (!hasWindow()) return null;
  try {
    const v = window.localStorage.getItem(key);
    if (v !== null) return v;
  } catch {}
  try {
    const v = window.sessionStorage.getItem(key);
    if (v !== null) return v;
  } catch {}
  return null;
}

// write to localStorage; on quota error, fall back to sessionStorage; else skip
function setKV(key: string, value: string): 'local' | 'session' | null {
  if (!hasWindow()) return null;
  try {
    window.localStorage.setItem(key, value);
    return 'local';
  } catch {
    try {
      window.sessionStorage.setItem(key, value);
      return 'session';
    } catch {
      // both failed (quota) – ignore rather than crashing the UI
      return null;
    }
  }
}

function removeKV(key: string) {
  if (!hasWindow()) return;
  try { window.localStorage.removeItem(key); } catch {}
  try { window.sessionStorage.removeItem(key); } catch {}
}

function loadPanelsFromStorage(): PanelState {
  if (!hasWindow()) return {};
  const out: PanelState = {};

  // localStorage
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k || !k.startsWith(PREFIX)) continue;
      const id = k.slice(PREFIX.length);
      const v = window.localStorage.getItem(k);
      if (v === 'true' || v === 'false') out[id] = v === 'true';
    }
  } catch {}

  // sessionStorage (lower priority; only use if not present in local)
  try {
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const k = window.sessionStorage.key(i);
      if (!k || !k.startsWith(PREFIX)) continue;
      const id = k.slice(PREFIX.length);
      if (id in out) continue;
      const v = window.sessionStorage.getItem(k);
      if (v === 'true' || v === 'false') out[id] = v === 'true';
    }
  } catch {}

  return out;
}

/* -------------------------------- provider -------------------------------- */

export function PanelProvider({ children }: { children: React.ReactNode }) {
  // hydrate once from storage (SSR-safe)
  const [panels, setPanels] = useState<PanelState>(() => loadPanelsFromStorage());

  // cross-tab sync (when another tab toggles)
  useEffect(() => {
    if (!hasWindow()) return;
    const onStorage = (e: StorageEvent) => {
      if (!e.key || !e.key.startsWith(PREFIX)) return;
      const id = e.key.slice(PREFIX.length);
      const val = e.newValue;
      if (val !== 'true' && val !== 'false') return;
      setPanels(prev => ({ ...prev, [id]: val === 'true' }));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setPanel = (id: string, open: boolean) => {
    setPanels((prev) => {
      const next = { ...prev, [id]: open };
      setKV(`${PREFIX}${id}`, open.toString());
      return next;
    });
  };

  const togglePanel = (id: string) => setPanel(id, !(panels[id] ?? false));

  const resetPanels = () => {
    if (hasWindow()) {
      try {
        // remove only our keys; ignore quota errors
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i);
          if (k && k.startsWith(PREFIX)) removeKV(k);
        }
        for (let i = 0; i < window.sessionStorage.length; i++) {
          const k = window.sessionStorage.key(i);
          if (k && k.startsWith(PREFIX)) removeKV(k);
        }
      } catch {}
    }
    setPanels({});
  };

  const openAll = () => {
    const updated: PanelState = {};
    for (const id of Object.keys(panels)) {
      updated[id] = true;
      setKV(`${PREFIX}${id}`, 'true');
    }
    setPanels(updated);
  };

  const closeAll = () => {
    const updated: PanelState = {};
    for (const id of Object.keys(panels)) {
      updated[id] = false;
      setKV(`${PREFIX}${id}`, 'false');
    }
    setPanels(updated);
  };

  const value = useMemo<PanelContextType>(() => ({
    panels, setPanel, togglePanel, resetPanels, openAll, closeAll,
  }), [panels]);

  return (
    <PanelContext.Provider value={value}>
      {children}
    </PanelContext.Provider>
  );
}

/* --------------------------------- hooks ---------------------------------- */

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
