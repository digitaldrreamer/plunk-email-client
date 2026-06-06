"use client";

import React, { useState, useEffect } from "react";
import { ChevronLeftIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sidebar } from "@/components/sidebar";
import { IconSidebar } from "@/components/icon-sidebar";
import { EmailList } from "@/components/email-list";
import { EmailDetail } from "@/components/email-detail";
import { ComposeModal } from "@/components/compose-modal";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { SettingsModal } from "@/components/settings-modal";
import { TwoFANudge } from "@/components/two-fa-nudge";
import { RecoveryEmailNudge } from "@/components/recovery-email-nudge";
import { CommandPalette } from "@/components/command-palette";
import { ContactsPanel } from "@/components/contacts-panel";
import { Button } from "@/components/ui/button";
import { useEmailStore } from "@/store/email-store";
import { useDocumentTitle } from "@/hooks/use-document-title";

type AppView = "email" | "contacts";

export function EmailClient() {
  const { selectedThreadId, selectThread, loadEmails, loadTags } = useEmailStore();
  useDocumentTitle();

  useEffect(() => {
    loadTags();
    loadEmails();
  }, []);

  const [appView, setAppView] = useState<AppView>("email");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState("signature");

  const openSettings = (tab = "signature") => {
    setSettingsTab(tab);
    setSettingsOpen(true);
  };

  const openContacts = () => setAppView("contacts");

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-background flex-col" suppressHydrationWarning>

      {/* ── Nudge banners ── */}
      <TwoFANudge onSetupNow={() => openSettings("security")} />
      <RecoveryEmailNudge onSetupNow={() => openSettings("profile")} />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ── Tablet: icon-only sidebar (md, hidden on mobile + lg) ── */}
        <div className="hidden md:flex lg:hidden shrink-0">
          <IconSidebar />
        </div>

        {/* ── Desktop: full sidebar (lg+) ── */}
        <div className="hidden lg:flex w-60 shrink-0 flex-col">
          <Sidebar onOpenSettings={openSettings} onOpenContacts={openContacts} />
        </div>

        {/* ── Contacts view ── */}
        {appView === "contacts" ? (
          <div className="flex flex-1 min-w-0 min-h-0">
            <div className="flex-1 min-w-0 min-h-0">
              <ContactsPanel onBack={() => setAppView("email")} />
            </div>
          </div>
        ) : (
          <>
            {/* ── Email list panel ── */}
            <div
              className={cn(
                "flex shrink-0 flex-col min-h-0",
                "w-full md:w-80 lg:w-[340px] xl:w-96",
                selectedThreadId ? "hidden md:flex" : "flex"
              )}
            >
              {/* Mobile top bar */}
              <div className="flex items-center justify-between border-b border-border px-4 h-14 md:hidden bg-sidebar shrink-0">
                <div className="flex items-center gap-2">
                  <img src="/logo_transparent.png" alt="reclear" className="h-6 w-auto" />
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-hidden pb-16 md:pb-0">
                <EmailList />
              </div>
            </div>

            {/* ── Email detail panel ── */}
            <div
              className={cn(
                "flex flex-col flex-1 min-w-0 min-h-0",
                selectedThreadId ? "flex" : "hidden md:flex"
              )}
            >
              {selectedThreadId && (
                <div className="flex items-center gap-1 border-b border-border px-2 h-14 md:hidden bg-sidebar shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-muted-foreground hover:text-foreground px-2"
                    onClick={() => selectThread(null)}
                  >
                    <ChevronLeftIcon className="size-4" />
                    <span className="text-sm">Back</span>
                  </Button>
                </div>
              )}

              <div className="flex-1 min-h-0 overflow-hidden pb-16 md:pb-0">
                <EmailDetail />
              </div>
            </div>
          </>
        )}

        {/* ── Mobile sticky bottom nav ── */}
        <MobileBottomNav />
      </div>

      {/* ── Compose floating window ── */}
      <ComposeModal />

      {/* ── Settings modal ── */}
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        defaultTab={settingsTab}
      />

      {/* ── Command palette (⌘K) ── */}
      <CommandPalette onOpenSettings={openSettings} onOpenContacts={openContacts} />
    </div>
  );
}
