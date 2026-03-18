'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

type OnboardingOverlayContextType = {
  hideTabBar: boolean;
  setHideTabBar: (v: boolean) => void;
};

export const OnboardingOverlayContext = createContext<OnboardingOverlayContextType | null>(null);

export function useOnboardingOverlay() {
  const ctx = useContext(OnboardingOverlayContext);
  if (!ctx) return { hideTabBar: false, setHideTabBar: () => {} };
  return ctx;
}
