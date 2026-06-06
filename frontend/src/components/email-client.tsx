"use client";

import React from "react";
import { ChevronLeftIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { AppShell } from "@/components/app-shell";
import { EmailList } from "@/components/email-list";
import { EmailDetail } from "@/components/email-detail";
import { Button } from "@/components/ui/button";
import { useEmailStore } from "@/store/email-store";
import { useDocumentTitle } from "@/hooks/use-document-title";

export function EmailClient() {
  const { selectedThreadId, selectThread } = useEmailStore();
  useDocumentTitle();

  return (
    <AppShell>
      <div className="flex h-full w-full overflow-hidden">
        {/* Email list panel */}
        <div
          className={cn(
            "flex shrink-0 flex-col min-h-0",
            "w-full md:w-80 lg:w-[340px] xl:w-96",
            selectedThreadId ? "hidden md:flex" : "flex"
          )}
        >
          {/* Mobile top bar */}
          <div className="flex items-center justify-between border-b border-border px-4 h-14 md:hidden bg-sidebar shrink-0">
            <img src="/logo_transparent.png" alt="reclear" className="h-6 w-auto" />
          </div>
          <div className="flex-1 min-h-0 overflow-hidden pb-16 md:pb-0">
            <EmailList />
          </div>
        </div>

        {/* Email detail panel */}
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
      </div>
    </AppShell>
  );
}
