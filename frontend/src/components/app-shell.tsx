"use client";

import React, { useEffect } from "react";
import { Sidebar } from "@/components/sidebar";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { ComposeModal } from "@/components/compose-modal";
import { CommandPalette } from "@/components/command-palette";
import { TwoFANudge } from "@/components/two-fa-nudge";
import { RecoveryEmailNudge } from "@/components/recovery-email-nudge";
import { useEmailStore } from "@/store/email-store";
import { useEmailStream } from "@/hooks/use-email-stream";
import { useRouter } from "next/navigation";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { loadEmails, loadTags } = useEmailStore();
  const router = useRouter();
  useEmailStream();

  useEffect(() => {
    loadTags();
    loadEmails();
  }, []);

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-background flex-col" suppressHydrationWarning>
      <TwoFANudge onSetupNow={() => router.push("/settings?tab=security")} />
      <RecoveryEmailNudge onSetupNow={() => router.push("/settings?tab=profile")} />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Sidebar — md and up */}
        <div className="hidden md:flex w-60 shrink-0 flex-col">
          <Sidebar />
        </div>

        {/* Main content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {children}
        </div>
      </div>

      <MobileBottomNav />
      <ComposeModal />
      <CommandPalette />
    </div>
  );
}
