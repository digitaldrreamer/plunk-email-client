"use client";

import React, { useState } from "react";
import {
  InboxIcon,
  SendIcon,
  FileTextIcon,
  ArchiveIcon,
  ShieldAlertIcon,
  Trash2Icon,
  PencilLineIcon,
  MoreHorizontalIcon,
  XIcon,
  PlusIcon,
  TagIcon,
  SettingsIcon,
  UsersIcon,
  LogOutIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEmailStore } from "@/store/email-store";
import { useAuthStore } from "@/store/auth-store";
import { apiUrl } from "@/lib/api";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { InstallButton } from "@/components/install-button";
import { SettingsModal } from "@/components/settings-modal";
import { AdminUsersModal } from "@/components/admin-users-modal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Folder } from "@/data/emails";

const TAG_COLORS = [
  { value: "blue", cls: "bg-blue-500" },
  { value: "green", cls: "bg-green-500" },
  { value: "red", cls: "bg-red-500" },
  { value: "orange", cls: "bg-orange-500" },
  { value: "purple", cls: "bg-purple-500" },
  { value: "pink", cls: "bg-pink-500" },
  { value: "cyan", cls: "bg-cyan-500" },
  { value: "yellow", cls: "bg-yellow-500" },
];

const PRIMARY_NAV: { id: Folder; icon: React.ElementType; label: string }[] = [
  { id: "inbox", icon: InboxIcon, label: "Inbox" },
  { id: "drafts", icon: FileTextIcon, label: "Drafts" },
  { id: "sent", icon: SendIcon, label: "Sent" },
];

const MORE_FOLDERS: { id: Folder; icon: React.ElementType; label: string }[] = [
  { id: "archive", icon: ArchiveIcon, label: "Archive" },
  { id: "spam", icon: ShieldAlertIcon, label: "Spam" },
  { id: "trash", icon: Trash2Icon, label: "Trash" },
];

export function MobileBottomNav() {
  const {
    currentFolder,
    setFolder,
    setComposing,
    unreadCount,
    tags,
    activeTagFilter,
    setTagFilter,
    addUserTag,
  } = useEmailStore();

  const { user, clearAuth } = useAuthStore();

  const handleLogout = async () => {
    await fetch(apiUrl("/api/auth/logout"), { method: "POST", credentials: "include" }).catch(() => {});
    clearAuth();
  };

  const [moreOpen, setMoreOpen] = useState(false);
  const [addTagOpen, setAddTagOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("blue");

  const handleFolder = (folder: Folder) => {
    setFolder(folder);
    setMoreOpen(false);
  };

  const handleTagFilter = (tagId: string) => {
    setTagFilter(activeTagFilter === tagId ? null : tagId);
    setMoreOpen(false);
  };

  const handleAddTag = () => {
    if (!newTagName.trim()) return;
    addUserTag(newTagName.trim(), newTagColor);
    setNewTagName("");
    setNewTagColor("blue");
    setAddTagOpen(false);
  };

  const inMoreFolder = MORE_FOLDERS.some((f) => f.id === currentFolder);

  return (
    <>
      {/* Bottom nav bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden">
        {/* Subtle top border + blur */}
        <div className="border-t border-border bg-card/95 backdrop-blur-md">
          <div className="flex h-16 items-center justify-around px-2 pb-[env(safe-area-inset-bottom)]">

            {/* Left two: Inbox, Drafts */}
            {PRIMARY_NAV.slice(0, 2).map(({ id, icon: Icon, label }) => {
              const count = unreadCount(id);
              const isActive = currentFolder === id;
              return (
                <button
                  key={id}
                  onClick={() => setFolder(id)}
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-0.5 h-12 w-14 rounded-xl transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  <div className="relative">
                    <Icon className={cn("size-5", isActive && "stroke-[2.5]")} />
                    {count > 0 && (
                      <span className="absolute -top-1 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-0.5 text-[9px] font-bold text-primary-foreground">
                        {count > 99 ? "99+" : count}
                      </span>
                    )}
                  </div>
                  <span className={cn("text-[10px] leading-none", isActive ? "font-semibold" : "font-normal")}>
                    {label}
                  </span>
                  {isActive && (
                    <span className="absolute bottom-1 size-1 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}

            {/* Center: Compose FAB */}
            <button
              onClick={() => setComposing(true)}
              className="flex flex-col items-center justify-center gap-0.5 -mt-5 h-14 w-14 rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-95"
            >
              <PencilLineIcon className="size-5" />
              <span className="text-[10px] font-semibold leading-none">Write</span>
            </button>

            {/* Right: Sent */}
            {PRIMARY_NAV.slice(2).map(({ id, icon: Icon, label }) => {
              const isActive = currentFolder === id;
              return (
                <button
                  key={id}
                  onClick={() => setFolder(id)}
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-0.5 h-12 w-14 rounded-xl transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  <Icon className={cn("size-5", isActive && "stroke-[2.5]")} />
                  <span className={cn("text-[10px] leading-none", isActive ? "font-semibold" : "font-normal")}>
                    {label}
                  </span>
                  {isActive && (
                    <span className="absolute bottom-1 size-1 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}

            {/* More */}
            <button
              onClick={() => setMoreOpen(true)}
              className={cn(
                "relative flex flex-col items-center justify-center gap-0.5 h-12 w-14 rounded-xl transition-colors",
                (moreOpen || inMoreFolder) ? "text-primary" : "text-muted-foreground"
              )}
            >
              <MoreHorizontalIcon className={cn("size-5", (moreOpen || inMoreFolder) && "stroke-[2.5]")} />
              <span className={cn("text-[10px] leading-none", (moreOpen || inMoreFolder) ? "font-semibold" : "font-normal")}>
                More
              </span>
              {inMoreFolder && (
                <span className="absolute bottom-1 size-1 rounded-full bg-primary" />
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* More bottom sheet */}
      {moreOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMoreOpen(false)}
          />
          <div className="relative bg-card rounded-t-2xl shadow-2xl overflow-hidden max-h-[75vh] flex flex-col">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pb-3 shrink-0">
              <span className="text-sm font-semibold">More</span>
              <div className="flex items-center gap-1">
                <ThemeToggle />
                <Button variant="ghost" size="icon-xs" onClick={() => setMoreOpen(false)}>
                  <XIcon className="size-4" />
                </Button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 px-3 pb-6 space-y-5">
              {/* Extra folders */}
              <div>
                <p className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Folders
                </p>
                {MORE_FOLDERS.map(({ id, icon: Icon, label }) => {
                  const count = unreadCount(id);
                  const isActive = currentFolder === id;
                  return (
                    <button
                      key={id}
                      onClick={() => handleFolder(id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                        isActive
                          ? "bg-accent text-foreground font-medium"
                          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="flex-1 text-left">{label}</span>
                      {count > 0 && (
                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <Separator />

              {/* Tags */}
              <div>
                <div className="flex items-center justify-between px-2 mb-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Tags
                  </p>
                  <button
                    onClick={() => setAddTagOpen(true)}
                    className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    <PlusIcon className="size-3" />
                    New
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 px-2">
                  {tags.map((tag) => {
                    const isActive = activeTagFilter === tag.id;
                    return (
                      <button
                        key={tag.id}
                        onClick={() => handleTagFilter(tag.id)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors border",
                          isActive
                            ? `${tag.bgClass} ${tag.textClass} border-transparent`
                            : "border-border text-muted-foreground hover:bg-accent"
                        )}
                      >
                        <span className={cn("size-2 rounded-full", tag.dotClass)} />
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Install app */}
              <Separator />
              <div className="px-2 py-1">
                <InstallButton variant="row" />
              </div>

              {/* User info + actions */}
              <Separator />
              <div className="flex items-center gap-3 px-2 py-1">
                <div className="flex size-9 items-center justify-center rounded-full bg-muted text-xs font-semibold uppercase shrink-0">
                  {user?.name?.slice(0, 2) ?? "me"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{user?.name ?? "Me"}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email ?? "me@team.reclear.io"}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {user?.role === "admin" && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="text-muted-foreground"
                      onClick={() => { setMoreOpen(false); setAdminOpen(true); }}
                    >
                      <UsersIcon className="size-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="text-muted-foreground"
                    onClick={() => { setMoreOpen(false); setSettingsOpen(true); }}
                  >
                    <SettingsIcon className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="text-muted-foreground"
                    onClick={handleLogout}
                  >
                    <LogOutIcon className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <AdminUsersModal open={adminOpen} onClose={() => setAdminOpen(false)} />

      {/* Add tag dialog */}
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
                      "size-7 rounded-full transition-transform hover:scale-110",
                      c.cls,
                      newTagColor === c.value && "ring-2 ring-ring ring-offset-2"
                    )}
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
    </>
  );
}
