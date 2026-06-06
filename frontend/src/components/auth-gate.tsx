"use client";

import { useAuthStore } from "@/store/auth-store";
import { LoginForm } from "@/components/login-form";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <LoginForm />;
  return <>{children}</>;
}
