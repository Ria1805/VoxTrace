import React, { createContext, useContext, useState, useEffect } from 'react';
import type { FXLevel, UserRole } from '../types';

interface FXContextType {
  fxLevel: FXLevel;
  setFxLevel: (level: FXLevel) => void;
  role: UserRole;
  setRole: (role: UserRole) => void;
  currentPage: string;
  setCurrentPage: (page: string) => void;
  selectedCaseId: number | null;
  setSelectedCaseId: (id: number | null) => void;
  tamperedState: boolean;
  setTamperedState: (tampered: boolean) => void;
  refreshTrigger: number;
  triggerRefresh: () => void;
}

const FXContext = createContext<FXContextType | undefined>(undefined);

export const FXProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [fxLevel, setFxLevelState] = useState<FXLevel>(() => {
    const saved = localStorage.getItem('voxtrace_fx_level');
    return (saved as FXLevel) || 'max';
  });

  const [role, setRoleState] = useState<UserRole>(() => {
    const saved = localStorage.getItem('voxtrace_user_role');
    return (saved as UserRole) || 'Analyst';
  });

  const [currentPage, setCurrentPage] = useState<string>('landing');
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(1);
  const [tamperedState, setTamperedState] = useState<boolean>(false);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  const setFxLevel = (level: FXLevel) => {
    setFxLevelState(level);
    localStorage.setItem('voxtrace_fx_level', level);
  };

  const setRole = (newRole: UserRole) => {
    setRoleState(newRole);
    localStorage.setItem('voxtrace_user_role', newRole);
  };

  const triggerRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  // Listen to prefers-reduced-motion
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches && fxLevel === 'max') {
      setFxLevel('off');
    }
  }, []);

  return (
    <FXContext.Provider
      value={{
        fxLevel,
        setFxLevel,
        role,
        setRole,
        currentPage,
        setCurrentPage,
        selectedCaseId,
        setSelectedCaseId,
        tamperedState,
        setTamperedState,
        refreshTrigger,
        triggerRefresh,
      }}
    >
      {children}
    </FXContext.Provider>
  );
};

export const useFX = () => {
  const context = useContext(FXContext);
  if (!context) {
    throw new Error('useFX must be used within an FXProvider');
  }
  return context;
};
