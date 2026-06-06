"use client";

import { useEffect, useState } from "react";
import { MailWarningIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth-store";
import { apiFetch } from "@/lib/api";

const STORAGE_KEY = "reclear-recovery-email-skip-until";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

interface Props {
  onSetupNow: () => void;
}

export function RecoveryEmailNudge({ onSetupNow }: Props) {
  const { token } = useAuthStore();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!token) return;

    const skipUntil = localStorage.getItem(STORAGE_KEY);
    if (skipUntil && Date.now() < Number(skipUntil)) return;

    apiFetch<{ recoveryEmail?: string | null }>("/api/auth/me", { token })
      .then((me) => { if (!me.recoveryEmail) setShow(true); })
      .catch(() => {});
  }, [token]);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, String(Date.now() + SEVEN_DAYS_MS));
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="flex items-center gap-3 border-b border-orange-300/40 bg-orange-50 dark:bg-orange-900/20 px-4 py-2.5 shrink-0">
      <MailWarningIcon className="size-4 text-orange-600 dark:text-orange-400 shrink-0" />
      <p className="flex-1 text-xs text-orange-800 dark:text-orange-300">
        Add a recovery email so you can regain access if you ever get locked out.
      </p>
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs border-orange-400/60 text-orange-800 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-800/30 shrink-0"
        onClick={() => { setShow(false); onSetupNow(); }}
      >
        Add recovery email
      </Button>
      <button
        onClick={dismiss}
        className="text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-200 shrink-0"
        aria-label="Dismiss for 7 days"
      >
        <XIcon className="size-4" />
      </button>
    </div>
  );
}
