"use client";

import { useEffect, useState } from "react";
import { ShieldIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth-store";
import { apiFetch } from "@/lib/api";

const STORAGE_KEY = "reclear-2fa-skip-until";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

interface Props {
  onSetupNow: () => void;
}

export function TwoFANudge({ onSetupNow }: Props) {
  const { token } = useAuthStore();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!token) return;

    // Check if dismissed within the last 7 days
    const skipUntil = localStorage.getItem(STORAGE_KEY);
    if (skipUntil && Date.now() < Number(skipUntil)) return;

    // Fetch 2FA status
    apiFetch<{ twoFactorEnabled: boolean }>("/api/auth/me", { token })
      .then((me) => { if (!me.twoFactorEnabled) setShow(true); })
      .catch(() => {});
  }, [token]);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, String(Date.now() + SEVEN_DAYS_MS));
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="flex items-center gap-3 border-b border-amber-300/40 bg-amber-50 dark:bg-amber-900/20 px-4 py-2.5 shrink-0">
      <ShieldIcon className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
      <p className="flex-1 text-xs text-amber-800 dark:text-amber-300">
        Protect your account with two-factor authentication.
      </p>
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs border-amber-400/60 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-800/30 shrink-0"
        onClick={() => { setShow(false); onSetupNow(); }}
      >
        Set up 2FA
      </Button>
      <button
        onClick={dismiss}
        className="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 shrink-0"
        aria-label="Dismiss for 7 days"
      >
        <XIcon className="size-4" />
      </button>
    </div>
  );
}
