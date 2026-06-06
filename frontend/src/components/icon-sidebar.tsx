"use client";

import React from "react";
import Image from "next/image";
import {
  InboxIcon,
  SendIcon,
  FileTextIcon,
  ArchiveIcon,
  ShieldAlertIcon,
  Trash2Icon,
  PencilLineIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { useEmailStore } from "@/store/email-store";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Folder } from "@/data/emails";

const FOLDERS: { id: Folder; label: string; icon: React.ElementType }[] = [
  { id: "inbox", label: "Inbox", icon: InboxIcon },
  { id: "sent", label: "Sent", icon: SendIcon },
  { id: "drafts", label: "Drafts", icon: FileTextIcon },
  { id: "archive", label: "Archive", icon: ArchiveIcon },
  { id: "spam", label: "Spam", icon: ShieldAlertIcon },
  { id: "trash", label: "Trash", icon: Trash2Icon },
];

export function IconSidebar() {
  const { currentFolder, setFolder, setComposing, unreadCount, tags, activeTagFilter, setTagFilter } =
    useEmailStore();

  return (
    <TooltipProvider delayDuration={100}>
      <div className="flex h-full w-[52px] shrink-0 flex-col items-center border-r border-sidebar-border bg-sidebar py-3 gap-1">
        {/* Logo */}
        <div className="flex size-8 items-center justify-center rounded-lg overflow-hidden mb-1">
          <Image src="/favicon-32x32.png" alt="reclear" width={32} height={32} className="size-8" />
        </div>

        {/* Compose */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setComposing(true)}
              className="size-8 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
            >
              <PencilLineIcon className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Compose</TooltipContent>
        </Tooltip>

        <Separator className="w-6 my-1" />

        {/* Folders */}
        {FOLDERS.map(({ id, label, icon: Icon }) => {
          const count = unreadCount(id);
          const isActive = currentFolder === id;
          return (
            <Tooltip key={id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setFolder(id)}
                  className={cn(
                    "relative flex size-8 items-center justify-center rounded-md transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
                  )}
                >
                  <Icon className="size-4" />
                  {count > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground leading-none">
                      {count > 9 ? "9+" : count}
                    </span>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{label}{count > 0 ? ` (${count})` : ""}</TooltipContent>
            </Tooltip>
          );
        })}

        <Separator className="w-6 my-1" />

        {/* Tags as color swatches */}
        {tags.map((tag) => {
          const isActive = activeTagFilter === tag.id;
          return (
            <Tooltip key={tag.id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setTagFilter(isActive ? null : tag.id)}
                  className={cn(
                    "flex size-8 items-center justify-center rounded-md transition-colors",
                    isActive ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/60"
                  )}
                >
                  <span className={cn("size-2.5 rounded-full", tag.dotClass, isActive && "ring-2 ring-ring ring-offset-1")} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{tag.name}</TooltipContent>
            </Tooltip>
          );
        })}

        <div className="flex-1" />

        {/* Theme + avatar */}
        <ThemeToggle />
        <div className="flex size-7 items-center justify-center rounded-full bg-muted text-[10px] font-semibold uppercase text-muted-foreground">
          me
        </div>
      </div>
    </TooltipProvider>
  );
}
