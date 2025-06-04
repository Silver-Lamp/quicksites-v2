import { SmartLinkContext } from './SmartLinkContext';
import { useSmartLinkPersisted } from './useSmartLinkPersisted';
import { ReactNode } from 'react';

export function SmartLinkProvider({ children }: { children: ReactNode }) {
  const { theme: defaultTheme, query: defaultQuery } = useSmartLinkPersisted();

  return (
    <SmartLinkContext.Provider value={{ defaultTheme, defaultQuery }}>
      {children}
    </SmartLinkContext.Provider>
  );
}
