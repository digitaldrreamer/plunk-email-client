"use client";

import React from "react";
import { format, isToday, isYesterday, isThisYear } from "date-fns";
import {
  StarIcon,
  SearchIcon,
  InboxIcon,
  UserIcon,
  BellIcon,
  NewspaperIcon,
  UsersIcon,
  FilterIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useEmailStore } from "@/store/email-store";
import { getTag } from "@/data/tags";
import type { Category } from "@/data/emails";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const CATEGORIES: { id: Category; label: string; icon: React.ElementType }[] = [
  { id: "primary", label: "Primary", icon: UserIcon },
  { id: "internal", label: "Internal", icon: UsersIcon },
  { id: "notifications", label: "Notifs", icon: BellIcon },
  { id: "newsletter", label: "Newsletter", icon: NewspaperIcon },
];

const FOLDER_LABELS: Record<string, string> = {
  inbox: "Inbox",
  sent: "Sent",
  drafts: "Drafts",
  archive: "Archive",
  spam: "Spam",
  trash: "Trash",
};

function formatEmailDate(dateStr: string) {
  const date = new Date(dateStr);
  if (isToday(date)) return format(date, "h:mm a");
  if (isYesterday(date)) return "Yesterday";
  if (isThisYear(date)) return format(date, "MMM d");
  return format(date, "MMM d, yyyy");
}

function getInitials(name: string) {
  const parts = name.split(" ");
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
  "bg-blue-500", "bg-green-500", "bg-purple-500", "bg-orange-500",
  "bg-pink-500", "bg-cyan-500", "bg-red-500", "bg-yellow-500",
];

function avatarColor(name: string) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function EmailList() {
  const {
    currentFolder,
    currentCategory,
    setCategory,
    selectedEmailId,
    selectEmail,
    toggleStar,
    filter,
    setFilter,
    activeTagFilter,
    visibleEmails,
    unreadCount,
  } = useEmailStore();

  const emails = visibleEmails();
  const isInbox = currentFolder === "inbox";

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-full flex-col bg-card border-r border-border">
        {/* Header */}
        <div className="shrink-0 border-b border-border">
          <div className="flex items-center justify-between px-4 h-14 gap-2">
            <div className="flex items-center gap-2">
              <InboxIcon className="size-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">{FOLDER_LABELS[currentFolder]}</h2>
              {unreadCount(currentFolder) > 0 && (
                <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground leading-none">
                  {unreadCount(currentFolder)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {activeTagFilter && (
                <span className="text-xs text-muted-foreground px-1.5 py-0.5 rounded-md bg-muted">
                  Filtered
                </span>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm">
                    <FilterIcon className={cn("size-3.5", filter !== "all" ? "text-primary" : "text-muted-foreground")} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36">
                  <DropdownMenuRadioGroup value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
                    <DropdownMenuRadioItem value="all">All</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="unread">Unread</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="starred">Starred</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Search */}
          <div className="px-4 pb-3">
            <div className="relative">
              <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Search emails..."
                className="w-full h-8 rounded-md border border-input bg-background pl-8 pr-3 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>

          {/* Category tabs — inbox only */}
          {isInbox && (
            <div className="flex border-t border-border">
              {CATEGORIES.map(({ id, label, icon: Icon }) => {
                const count = unreadCount("inbox", id);
                const isActive = currentCategory === id;
                return (
                  <button
                    key={id}
                    onClick={() => setCategory(id)}
                    className={cn(
                      "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors border-b-2",
                      isActive
                        ? "border-primary text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    )}
                  >
                    <div className="relative">
                      <Icon className="size-3.5" />
                      {count > 0 && (
                        <span className="absolute -top-1 -right-2 size-3.5 flex items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground">
                          {count > 9 ? "9+" : count}
                        </span>
                      )}
                    </div>
                    <span className="hidden sm:block">{label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Email list */}
        <div className="flex-1 overflow-y-auto">
          {emails.length === 0 ? (
            <div className="flex h-full items-center justify-center text-center px-6">
              <div className="space-y-1">
                <InboxIcon className="size-8 text-muted-foreground/40 mx-auto" />
                <p className="text-sm text-muted-foreground">No emails here</p>
              </div>
            </div>
          ) : (
            emails.map((email) => {
              const isSelected = selectedEmailId === email.id;
              const isUnread = !email.read;
              const initials = getInitials(email.folder === "sent" || email.folder === "drafts" ? email.to[0]?.name ?? "?" : email.from.name);
              const color = avatarColor(email.from.name);

              return (
                <button
                  key={email.id}
                  onClick={() => selectEmail(email.id)}
                  className={cn(
                    "group relative flex w-full gap-3 border-b border-border p-3.5 text-left transition-colors",
                    isSelected ? "bg-accent" : "hover:bg-muted/50",
                    isUnread && !isSelected && "bg-muted/20"
                  )}
                >
                  {/* Unread indicator */}
                  {isUnread && (
                    <span className="absolute left-1.5 top-1/2 -translate-y-1/2 size-1.5 rounded-full bg-primary shrink-0" />
                  )}

                  {/* Avatar */}
                  <Avatar className={cn("mt-0.5 size-8 shrink-0 text-white text-xs", !email.from.avatar && color)}>
                    <AvatarFallback className={cn("text-white text-xs font-medium", color)}>
                      {initials}
                    </AvatarFallback>
                  </Avatar>

                  {/* Content */}
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className={cn("text-[13px] truncate", isUnread ? "font-semibold text-foreground" : "text-foreground")}>
                        {email.folder === "sent" || email.folder === "drafts" ? `To: ${email.to[0]?.name}` : email.from.name}
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground whitespace-nowrap">
                        {formatEmailDate(email.date)}
                      </span>
                    </div>

                    <p className={cn("text-[12px] truncate", isUnread ? "text-foreground" : "text-muted-foreground")}>
                      {email.folder === "drafts" && <span className="text-amber-500 font-medium mr-1">[Draft]</span>}
                      {email.subject}
                    </p>

                    <p className="text-[11px] text-muted-foreground line-clamp-1 leading-relaxed">
                      {email.preview}
                    </p>

                    {/* Tags row */}
                    {email.tagIds.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap pt-0.5">
                        {email.tagIds.slice(0, 3).map((tagId) => {
                          const tag = getTag(tagId);
                          if (!tag) return null;
                          return (
                            <Tooltip key={tagId}>
                              <TooltipTrigger asChild>
                                <span
                                  className={cn(
                                    "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none",
                                    tag.bgClass,
                                    tag.textClass
                                  )}
                                >
                                  {tag.name}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>{tag.name}</TooltipContent>
                            </Tooltip>
                          );
                        })}
                        {email.tagIds.length > 3 && (
                          <span className="text-[10px] text-muted-foreground">+{email.tagIds.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Star */}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleStar(email.id); }}
                    className={cn(
                      "shrink-0 self-start mt-0.5 p-0.5 rounded transition-colors",
                      email.starred ? "text-yellow-500" : "text-muted-foreground/0 group-hover:text-muted-foreground/50 hover:!text-yellow-400"
                    )}
                  >
                    <StarIcon className={cn("size-3.5", email.starred && "fill-current")} />
                  </button>
                </button>
              );
            })
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
