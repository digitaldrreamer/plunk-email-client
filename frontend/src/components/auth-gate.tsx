"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/auth-store";
import { useEmailStore } from "@/store/email-store";
import { LoginForm } from "@/components/login-form";
import { apiFetch } from "@/lib/api";
import type { AuthUser } from "@/store/auth-store";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const sessionChecked = useAuthStore((s) => s._sessionChecked);
  const setUser = useAuthStore((s) => s.setUser);
  const markChecked = useAuthStore((s) => s._markSessionChecked);
  const setSignature = useEmailStore((s) => s.setSignature);

  useEffect(() => {
    apiFetch<AuthUser>("/api/auth/me")
      .then((u) => {
        setUser(u);
        if (u.signature != null) setSignature(u.signature);
        markChecked();
      })
      .catch(() => { setUser(null); markChecked(); });
  }, []);

  // If we have a cached user, show the app immediately while the check runs in background
  if (!sessionChecked && !user) return null;
  if (sessionChecked && !user) return <LoginForm />;
  return <>{children}</>;
}
