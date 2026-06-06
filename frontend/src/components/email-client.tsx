"use client";

import React from "react";
import { ChevronLeftIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sidebar } from "@/components/sidebar";
import { IconSidebar } from "@/components/icon-sidebar";
import { EmailList } from "@/components/email-list";
import { EmailDetail } from "@/components/email-detail";
import { ComposeModal } from "@/components/compose-modal";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { Button } from "@/components/ui/button";
import { useEmailStore } from "@/store/email-store";
import { useDocumentTitle } from "@/hooks/use-document-title";

export function EmailClient() {
  const { selectedThreadId, selectThread } = useEmailStore();
  useDocumentTitle();

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-background" suppressHydrationWarning>

      {/* ── Tablet: icon-only sidebar (md, hidden on mobile + lg) ── */}
      <div className="hidden md:flex lg:hidden shrink-0">
        <IconSidebar />
      </div>

      {/* ── Desktop: full sidebar (lg+) ── */}
      <div className="hidden lg:flex w-60 shrink-0 flex-col">
        <Sidebar />
      </div>

      {/* ── Email list panel ── */}
      <div
        className={cn(
          "flex shrink-0 flex-col min-h-0",
          // Mobile: full-width, hidden when reading a thread
          "w-full md:w-80 lg:w-[340px] xl:w-96",
          selectedThreadId ? "hidden md:flex" : "flex"
        )}
      >
        {/* Mobile top bar (no sidebar on mobile) */}
        <div className="flex items-center justify-between border-b border-border px-4 h-14 md:hidden bg-sidebar shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex size-6 items-center justify-center rounded-md bg-primary">
              <span className="text-[10px] font-bold text-primary-foreground">R</span>
            </div>
            <span className="text-sm font-semibold tracking-tight">reclear</span>
          </div>
        </div>

        {/* List — takes remaining height, mobile: subtract bottom nav */}
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
        {/* Mobile back bar */}
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

        {/* Detail — mobile: subtract bottom nav */}
        <div className="flex-1 min-h-0 overflow-hidden pb-16 md:pb-0">
          <EmailDetail />
        </div>
      </div>

      {/* ── Mobile sticky bottom nav ── */}
      <MobileBottomNav />

      {/* ── Compose floating window ── */}
      <ComposeModal />
    </div>
  );
}
