"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  recoveryEmail?: string | null;
}

interface AuthStore {
  user: AuthUser | null;
  // True once we've verified the session with the server (resets on every page load)
  _sessionChecked: boolean;
  setUser: (user: AuthUser | null) => void;
  updateUser: (patch: Partial<AuthUser>) => void;
  clearAuth: () => void;
  _markSessionChecked: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      _sessionChecked: false,
      setUser: (user) => set({ user }),
      updateUser: (patch) => set((s) => ({ user: s.user ? { ...s.user, ...patch } : null })),
      clearAuth: () => set({ user: null }),
      _markSessionChecked: () => set({ _sessionChecked: true }),
    }),
    {
      name: "reclear-auth",
      // Only persist the user object — no tokens, no session state
      partialize: (s) => ({ user: s.user }),
    }
  )
);
