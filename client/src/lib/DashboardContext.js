import { createContext, useContext } from 'react';

export const DashboardContext = createContext(null);

export function useDashboardContext() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboardContext must be used within DashboardContext.Provider');
  return ctx;
}
