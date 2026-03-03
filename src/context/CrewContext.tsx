'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuthContext } from '@/src/context/AuthContext';
import { getMyCrew, type CrewWithMembers } from '@/src/lib/crew';

type CrewContextType = {
  crew: CrewWithMembers | null;
  myRole: 'captain' | 'officer' | 'member' | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const CrewContext = createContext<CrewContextType | null>(null);

export function CrewProvider({ children }: { children: ReactNode }) {
  const { user, isSignedIn } = useAuthContext();
  const [crew, setCrew] = useState<CrewWithMembers | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!isSignedIn || !user?.id) {
      setCrew(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const c = await getMyCrew(user.id);
    setCrew(c);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, [isSignedIn, user?.id ?? null]);

  const myRole = crew?.crew_members?.find((m: any) => m.user_id === user?.id)?.role ?? null;

  return (
    <CrewContext.Provider value={{ crew, myRole, loading, refresh }}>
      {children}
    </CrewContext.Provider>
  );
}

export function useCrewContext() {
  const ctx = useContext(CrewContext);
  if (!ctx) throw new Error('useCrewContext must be used within CrewProvider');
  return ctx;
}
