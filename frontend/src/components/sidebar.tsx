"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  InboxIcon,
  SendIcon,
  FileTextIcon,
  ArchiveIcon,
  ShieldAlertIcon,
  Trash2Icon,
  PlusIcon,
  TagIcon,
  PencilLineIcon,
  SettingsIcon,
  UsersIcon,
  LogOutIcon,
  BookUserIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useEmailStore } from "@/store/email-store";
import { useAuthStore } from "@/store/auth-store";
import { apiUrl } from "@/lib/api";
import type { Folder } from "@/data/emails";
import { ThemeToggle } from "@/components/theme-toggle";
import { InstallButton } from "@/components/install-button";
import { AdminUsersModal } from "@/components/admin-users-modal";

const TAG_COLORS = [
  { value: "blue", label: "Blue", cls: "bg-blue-500" },
  { value: "green", label: "Green", cls: "bg-green-500" },
  { value: "red", label: "Red", cls: "bg-red-500" },
  { value: "orange", label: "Orange", cls: "bg-orange-500" },
  { value: "purple", label: "Purple", cls: "bg-purple-500" },
  { value: "pink", label: "Pink", cls: "bg-pink-500" },
  { value: "cyan", label: "Cyan", cls: "bg-cyan-500" },
  { value: "yellow", label: "Yellow", cls: "bg-yellow-500" },
];

export function Sidebar({ onOpenSettings, onOpenContacts }: { onOpenSettings?: (tab?: string) => void; onOpenContacts?: () => void }) {
  const {
    currentFolder,
    setFolder,
    setComposing,
    unreadCount,
    activeTagFilter,
    setTagFilter,
    tags,
    addUserTag,
  } = useEmailStore();

  const { user, clearAuth } = useAuthStore();

  const handleLogout = async () => {
    await fetch(apiUrl("/api/auth/logout"), { method: "POST", credentials: "include" }).catch(() => {});
    clearAuth();
  };
  const [addTagOpen, setAddTagOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("blue");

  const folders: { id: Folder; label: string; icon: React.ElementType; countFolder?: Folder }[] = [
    { id: "inbox", label: "Inbox", icon: InboxIcon },
    { id: "sent", label: "Sent", icon: SendIcon },
    { id: "drafts", label: "Drafts", icon: FileTextIcon },
    { id: "archive", label: "Archive", icon: ArchiveIcon },
    { id: "spam", label: "Spam", icon: ShieldAlertIcon },
    { id: "trash", label: "Trash", icon: Trash2Icon },
  ];

  const handleFolderClick = (folder: Folder) => {
    setFolder(folder);
  };

  const handleAddTag = () => {
    if (!newTagName.trim()) return;
    addUserTag(newTagName.trim(), newTagColor);
    setNewTagName("");
    setNewTagColor("blue");
    setAddTagOpen(false);
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-full flex-col bg-sidebar border-r border-sidebar-border">
        {/* Logo */}
        <div className="flex h-14 items-center gap-2.5 px-4 border-b border-sidebar-border shrink-0">
          <Image src="/logo_transparent.png" alt="reclear" width={96} height={28} className="h-7 w-auto" />
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-3 space-y-5">
            {/* Compose */}
            <Button
              onClick={() => setComposing(true)}
              size="sm"
              className="w-full h-8 gap-2 justify-start font-medium"
            >
              <PencilLineIcon className="size-3.5" />
              Compose
            </Button>

            {/* Folders */}
            <div>
              <p className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Folders
              </p>
              <div className="space-y-0.5">
                {folders.map(({ id, label, icon: Icon }) => {
                  const count = unreadCount(id);
                  const isActive = currentFolder === id;
                  return (
                    <button
                      key={id}
                      onClick={() => handleFolderClick(id)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                        isActive
                          ? "bg-sidebar-accent text-foreground font-medium"
                          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="flex-1 text-left">{label}</span>
                      {count > 0 && (
                        <span
                          className={cn(
                            "rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none",
                            isActive
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Contacts */}
            <button
              onClick={() => onOpenContacts?.()}
              className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
            >
              <BookUserIcon className="size-4 shrink-0" />
              Contacts
            </button>

            <Separator />

            {/* Tags */}
            <div>
              <div className="flex items-center justify-between px-2 mb-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Tags
                </p>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setAddTagOpen(true)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <PlusIcon className="size-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">New tag</TooltipContent>
                </Tooltip>
              </div>
              <div className="space-y-0.5">
                {tags.map((tag) => {
                  const isActive = activeTagFilter === tag.id;
                  return (
                    <button
                      key={tag.id}
                      onClick={() => setTagFilter(isActive ? null : tag.id)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                        isActive
                          ? "bg-sidebar-accent text-foreground font-medium"
                          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
                      )}
                    >
                      <span className={cn("size-2 rounded-full shrink-0", tag.dotClass)} />
                      <span className="flex-1 text-left">{tag.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="shrink-0 border-t border-sidebar-border p-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-semibold uppercase shrink-0">
              {user?.name?.slice(0, 2) ?? "me"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{user?.name ?? "Me"}</p>
              <p className="text-[11px] text-muted-foreground truncate">{user?.email ?? "me@team.reclear.io"}</p>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <InstallButton iconOnly />
              {user?.role === "admin" && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon-xs" className="text-muted-foreground hover:text-foreground" onClick={() => setAdminOpen(true)}>
                      <UsersIcon className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Manage users</TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon-xs" className="text-muted-foreground hover:text-foreground" onClick={() => onOpenSettings?.()}>
                    <SettingsIcon className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Settings</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon-xs" className="text-muted-foreground hover:text-foreground" onClick={handleLogout}>
                    <LogOutIcon className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Sign out</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      </div>

      <AdminUsersModal open={adminOpen} onClose={() => setAdminOpen(false)} />

      {/* Add Tag Dialog */}
      <Dialog open={addTagOpen} onOpenChange={setAddTagOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TagIcon className="size-4" /> New tag
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <Input
              placeholder="Tag name"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
              autoFocus
            />
            <div>
              <p className="text-xs text-muted-foreground mb-2">Color</p>
              <div className="flex gap-2 flex-wrap">
                {TAG_COLORS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setNewTagColor(c.value)}
                    className={cn(
                      "size-6 rounded-full transition-transform hover:scale-110",
                      c.cls,
                      newTagColor === c.value && "ring-2 ring-ring ring-offset-2"
                    )}
                    title={c.label}
                  />
                ))}
              </div>
            </div>
            <Button onClick={handleAddTag} className="w-full" disabled={!newTagName.trim()}>
              Create tag
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
