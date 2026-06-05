"use client";

import React, { useState } from "react";
import { MenuIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sidebar } from "@/components/sidebar";
import { EmailList } from "@/components/email-list";
import { EmailDetail } from "@/components/email-detail";
import { ComposeModal } from "@/components/compose-modal";
import { Button } from "@/components/ui/button";
import { useEmailStore } from "@/store/email-store";

export function EmailClient() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { selectedEmailId, selectEmail } = useEmailStore();

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <div className="hidden md:flex w-60 shrink-0 flex-col">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative z-10 w-72 shrink-0 flex flex-col shadow-xl">
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Email list — hidden on mobile when email is open */}
      <div
        className={cn(
          "flex shrink-0 flex-col",
          "w-full md:w-80 lg:w-96",
          selectedEmailId ? "hidden md:flex" : "flex"
        )}
      >
        {/* Mobile top bar */}
        <div className="flex items-center gap-2 border-b border-border px-3 py-2 md:hidden bg-background">
          <Button variant="ghost" size="icon-sm" onClick={() => setSidebarOpen(true)}>
            <MenuIcon className="size-5" />
          </Button>
          <span className="text-sm font-semibold text-foreground">reclear</span>
        </div>
        <div className="flex-1 min-h-0">
          <EmailList />
        </div>
      </div>

      {/* Email detail — full screen on mobile when email is open */}
      <div
        className={cn(
          "flex flex-col flex-1 min-w-0",
          selectedEmailId ? "flex" : "hidden md:flex"
        )}
      >
        {/* Mobile back button */}
        {selectedEmailId && (
          <div className="flex items-center gap-2 border-b border-border px-3 py-2 md:hidden bg-background shrink-0">
            <Button variant="ghost" size="icon-sm" onClick={() => selectEmail(null)}>
              <XIcon className="size-4" />
            </Button>
            <span className="text-xs text-muted-foreground">Back to list</span>
          </div>
        )}
        <div className="flex-1 min-h-0">
          <EmailDetail />
        </div>
      </div>

      {/* Compose floating window */}
      <ComposeModal />
    </div>
  );
}
