import React, { createContext, useContext, useState, ReactNode } from 'react';

interface LastRefreshContextType {
  lastRefresh: Date | null;
  setLastRefresh: (date: Date) => void;
}

const LastRefreshContext = createContext<LastRefreshContextType | undefined>(undefined);

export const LastRefreshProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  return (
    <LastRefreshContext.Provider value={{ lastRefresh, setLastRefresh }}>
      {children}
    </LastRefreshContext.Provider>
  );
};

export const useLastRefresh = () => {
  const context = useContext(LastRefreshContext);
  if (!context) {
    throw new Error('useLastRefresh must be used within LastRefreshProvider');
  }
  return context;
};

