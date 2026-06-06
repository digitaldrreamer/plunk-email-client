"use client";

import React, { useState, useEffect, useRef } from "react";
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
  MessageSquareIcon,
  ShieldAlertIcon,
  AlignJustifyIcon,
  ArchiveIcon,
  Trash2Icon,
  MailOpenIcon,
  MailIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useEmailStore, type Thread } from "@/store/email-store";
import { usePreferencesStore } from "@/store/preferences-store";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

// ── Delivery status ───────────────────────────────────────────────────────────

const DELIVERY_CONFIG: Record<string, { label: string; dot: string; text: string; bg: string }> = {
  pending:    { label: "Pending",   dot: "bg-zinc-400",   text: "text-zinc-500 dark:text-zinc-400",         bg: "bg-zinc-100 dark:bg-zinc-800/60" },
  sent:       { label: "Sent",      dot: "bg-blue-500",   text: "text-blue-600 dark:text-blue-400",          bg: "bg-blue-50 dark:bg-blue-950/30" },
  delivered:  { label: "Delivered", dot: "bg-teal-500",   text: "text-teal-600 dark:text-teal-400",          bg: "bg-teal-50 dark:bg-teal-950/30" },
  opened:     { label: "Opened",    dot: "bg-green-500",  text: "text-green-600 dark:text-green-400",        bg: "bg-green-50 dark:bg-green-950/30" },
  clicked:    { label: "Clicked",   dot: "bg-green-500",  text: "text-green-600 dark:text-green-400",        bg: "bg-green-50 dark:bg-green-950/30" },
  bounced:    { label: "Bounced",   dot: "bg-red-500",    text: "text-red-600 dark:text-red-400",            bg: "bg-red-50 dark:bg-red-950/30" },
  complained: { label: "Flagged",   dot: "bg-orange-500", text: "text-orange-600 dark:text-orange-400",      bg: "bg-orange-50 dark:bg-orange-950/30" },
};

function DeliveryBadge({ status, openCount, clickCount }: { status: string; openCount?: number; clickCount?: number }) {
  const cfg = DELIVERY_CONFIG[status];
  if (!cfg) return null;
  let label = cfg.label;
  if (status === "opened" && openCount && openCount > 1) label += ` ×${openCount}`;
  if (status === "clicked" && clickCount && clickCount > 1) label += ` ×${clickCount}`;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none shrink-0", cfg.bg, cfg.text)}>
      <span className={cn("size-1.5 rounded-full shrink-0", cfg.dot)} />
      {label}
    </span>
  );
}

const CATEGORIES: { id: Category; label: string; icon: React.ElementType; danger?: boolean }[] = [
  { id: "primary", label: "Primary", icon: UserIcon },
  { id: "internal", label: "Internal", icon: UsersIcon },
  { id: "notifications", label: "Notifs", icon: BellIcon },
  { id: "newsletter", label: "Newsletter", icon: NewspaperIcon },
  { id: "dangerous", label: "Dangerous", icon: ShieldAlertIcon, danger: true },
];

const FOLDER_LABELS: Record<string, string> = {
  inbox: "Inbox",
  sent: "Sent",
  drafts: "Drafts",
  archive: "Archive",
  spam: "Spam",
  trash: "Trash",
};

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  if (isToday(date)) return format(date, "h:mm a");
  if (isYesterday(date)) return "Yesterday";
  if (isThisYear(date)) return format(date, "MMM d");
  return format(date, "MMM d, yyyy");
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

function getInitials(name: string) {
  const parts = name.split(" ");
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function ParticipantAvatars({ thread }: { thread: Thread }) {
  const others = thread.participants.filter((p) => p.email !== "me@team.reclear.io");
  const display = others.length > 0 ? others : thread.participants;
  const show = display.slice(0, 2);

  if (show.length === 1) {
    const p = show[0];
    const color = thread.category === "dangerous" ? "bg-red-600" : avatarColor(p.name);
    return (
      <Avatar className={cn("mt-0.5 size-8 shrink-0", color)}>
        <AvatarFallback className={cn("text-white text-xs font-medium", color)}>
          {getInitials(p.name)}
        </AvatarFallback>
      </Avatar>
    );
  }

  return (
    <div className="relative mt-0.5 size-8 shrink-0">
      {show.slice().reverse().map((p, i) => {
        const color = thread.category === "dangerous" ? "bg-red-600" : avatarColor(p.name);
        return (
          <Avatar
            key={p.email}
            className={cn(
              "absolute border-2 border-card",
              i === 0 ? "bottom-0 right-0 size-6" : "top-0 left-0 size-6",
              color
            )}
          >
            <AvatarFallback className={cn("text-white text-[9px] font-semibold", color)}>
              {getInitials(p.name)}
            </AvatarFallback>
          </Avatar>
        );
      })}
    </div>
  );
}

// ── Skeleton row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="flex gap-3 px-4 py-3 border-b border-border animate-pulse">
      <div className="size-8 rounded-full bg-muted shrink-0 mt-0.5" />
      <div className="flex-1 space-y-2 min-w-0">
        <div className="flex justify-between gap-4">
          <div className="h-3 w-24 rounded bg-muted" />
          <div className="h-3 w-10 rounded bg-muted" />
        </div>
        <div className="h-3 w-3/4 rounded bg-muted" />
        <div className="h-3 w-1/2 rounded bg-muted" />
      </div>
    </div>
  );
}

export function EmailList() {
  const {
    currentFolder,
    currentCategory,
    setCategory,
    selectedThreadId,
    selectThread,
    toggleStarThread,
    markThreadRead,
    markThreadUnread,
    moveThread,
    filter,
    setFilter,
    activeTagFilter,
    visibleThreads,
    unreadCount,
  } = useEmailStore();
  const { density, setDensity } = usePreferencesStore();

  const [warnedIds, setWarnedIds] = useState<Set<string>>(new Set());
  const [pendingDangerThread, setPendingDangerThread] = useState<Thread | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const searchRef = useRef<HTMLInputElement>(null);

  // Brief skeleton on mount to simulate initial data load
  useEffect(() => { const t = setTimeout(() => setLoading(false), 400); return () => clearTimeout(t); }, []);

  // Reset search when folder changes
  useEffect(() => { setSearchQuery(""); }, [currentFolder]);

  const allThreads = visibleThreads();
  const threads = searchQuery.trim()
    ? allThreads.filter((t) => {
        const q = searchQuery.toLowerCase();
        return (
          t.subject.toLowerCase().includes(q) ||
          t.participants.some((p) => p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)) ||
          t.latestEmail.preview.toLowerCase().includes(q)
        );
      })
    : allThreads;
  const isInbox = currentFolder === "inbox";

  const handleStar = (e: React.MouseEvent, thread: Thread) => {
    e.stopPropagation();
    toggleStarThread(thread.id);
    toast(thread.isStarred ? "Removed from starred" : "Added to starred", { duration: 2000 });
  };

  const handleMarkRead = (e: React.MouseEvent, thread: Thread) => {
    e.stopPropagation();
    if (thread.unreadCount > 0) {
      markThreadRead(thread.id);
      toast("Marked as read", { duration: 2000 });
    } else {
      markThreadUnread(thread.id);
      toast("Marked as unread", { duration: 2000 });
    }
  };

  const handleArchive = (e: React.MouseEvent, thread: Thread) => {
    e.stopPropagation();
    moveThread(thread.id, "archive");
    toast("Archived", { duration: 2000 });
  };

  const handleTrash = (e: React.MouseEvent, thread: Thread) => {
    e.stopPropagation();
    moveThread(thread.id, "trash");
    toast("Moved to trash", { duration: 2000 });
  };

  const handleThreadClick = (thread: Thread) => {
    if (thread.category === "dangerous" && !warnedIds.has(thread.id)) {
      setPendingDangerThread(thread);
    } else {
      selectThread(thread.id);
    }
  };

  const confirmDangerOpen = () => {
    if (!pendingDangerThread) return;
    setWarnedIds((prev) => new Set([...prev, pendingDangerThread.id]));
    selectThread(pendingDangerThread.id);
    setPendingDangerThread(null);
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-full flex-col bg-card border-r border-border">

        {/* ── Header ── */}
        <div className="shrink-0 border-b border-border">
          <div className="flex items-center justify-between px-4 h-14 gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground">{FOLDER_LABELS[currentFolder]}</h2>
              {unreadCount(currentFolder) > 0 && (
                <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground leading-none">
                  {unreadCount(currentFolder)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {activeTagFilter && (
                <span className="text-[11px] text-muted-foreground px-1.5 py-0.5 rounded-md bg-muted">
                  Filtered
                </span>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setDensity(density === "comfortable" ? "compact" : "comfortable")}
                title={density === "comfortable" ? "Switch to compact" : "Switch to comfortable"}
              >
                <AlignJustifyIcon className={cn("size-3.5", density === "compact" ? "text-primary" : "text-muted-foreground")} />
              </Button>
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
                ref={searchRef}
                type="text"
                placeholder="Search…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-8 rounded-md border border-input bg-background pl-8 pr-3 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>

          {/* Category tabs — inbox only */}
          {isInbox && (
            <div className="flex border-t border-border overflow-x-auto">
              {CATEGORIES.map(({ id, label, icon: Icon, danger }) => {
                const count = unreadCount("inbox", id);
                const isActive = currentCategory === id;
                return (
                  <button
                    key={id}
                    onClick={() => setCategory(id)}
                    className={cn(
                      "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors border-b-2 min-w-[60px]",
                      danger
                        ? isActive
                          ? "border-red-500 text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-red-950/20"
                          : "border-transparent text-red-500/60 hover:text-red-500 hover:bg-red-50/40 dark:hover:bg-red-950/20"
                        : isActive
                        ? "border-primary text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    )}
                  >
                    <div className="relative">
                      <Icon className={cn("size-3.5", danger && "text-current")} />
                      {count > 0 && (
                        <span className={cn(
                          "absolute -top-1 -right-2 size-3.5 flex items-center justify-center rounded-full text-[8px] font-bold text-white",
                          danger ? "bg-red-500" : "bg-primary"
                        )}>
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

        {/* ── Thread list ── */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
          ) : searchQuery && threads.length === 0 ? (
            <div className="flex h-full items-center justify-center text-center px-6">
              <div className="space-y-1">
                <SearchIcon className="size-8 text-muted-foreground/30 mx-auto" />
                <p className="text-sm text-muted-foreground">No results for &ldquo;{searchQuery}&rdquo;</p>
              </div>
            </div>
          ) : threads.length === 0 ? (
            <div className="flex h-full items-center justify-center text-center px-6">
              <div className="space-y-1">
                {currentCategory === "dangerous" ? (
                  <>
                    <ShieldAlertIcon className="size-8 text-red-300 mx-auto" />
                    <p className="text-sm text-muted-foreground">No dangerous emails</p>
                    <p className="text-xs text-muted-foreground/60">Emails with unsafe URLs will appear here</p>
                  </>
                ) : (
                  <>
                    <InboxIcon className="size-8 text-muted-foreground/30 mx-auto" />
                    <p className="text-sm text-muted-foreground">No emails here</p>
                  </>
                )}
              </div>
            </div>
          ) : (
            threads.map((thread) => {
              const isSelected = selectedThreadId === thread.id;
              const hasUnread = thread.unreadCount > 0;
              const isDangerous = thread.category === "dangerous";
              const isCompact = density === "compact";
              const latest = thread.latestEmail;

              const others = thread.participants.filter((p) => p.email !== "me@team.reclear.io");
              const senderLabel =
                currentFolder === "sent" || currentFolder === "drafts"
                  ? `To: ${latest.to[0]?.name ?? "?"}`
                  : others.length > 0
                  ? others.map((p) => p.name.split(" ")[0]).join(", ")
                  : "Me";

              return (
                <div
                  key={thread.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleThreadClick(thread)}
                  onKeyDown={(e) => e.key === "Enter" && handleThreadClick(thread)}
                  className={cn(
                    "group relative flex w-full gap-3 border-b text-left transition-colors cursor-pointer",
                    isDangerous
                      ? "border-red-200 dark:border-red-900/50 border-l-2 border-l-red-500 pl-3"
                      : "border-border px-4",
                    isDangerous
                      ? isSelected
                        ? "bg-red-50 dark:bg-red-950/30"
                        : "hover:bg-red-50/60 dark:hover:bg-red-950/20"
                      : isSelected
                      ? "bg-accent"
                      : "hover:bg-muted/40",
                    isDangerous ? (isCompact ? "py-2 pr-4" : "py-3 pr-4") : (isCompact ? "py-2" : "py-3"),
                    hasUnread && !isSelected && !isDangerous && "bg-muted/20"
                  )}
                >
                  {/* Unread dot */}
                  {hasUnread && (
                    <span className={cn(
                      "absolute left-1.5 top-1/2 -translate-y-1/2 size-1.5 rounded-full",
                      isDangerous ? "bg-red-500" : "bg-primary"
                    )} />
                  )}

                  {/* Stacked avatars */}
                  <ParticipantAvatars thread={thread} />

                  {/* Content */}
                  <div className="flex-1 min-w-0 space-y-0.5">
                    {/* Row 1: sender + date + danger badge */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={cn(
                          "text-[13px] truncate",
                          isDangerous
                            ? "font-semibold text-red-700 dark:text-red-400"
                            : hasUnread
                            ? "font-semibold text-foreground"
                            : "text-foreground"
                        )}>
                          {senderLabel}
                        </span>
                        {isDangerous && (
                          <ShieldAlertIcon className="size-3 text-red-500 shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {currentFolder === "sent" && thread.deliveryStatus && (
                          <DeliveryBadge
                            status={thread.deliveryStatus}
                            openCount={thread.openCount}
                            clickCount={thread.clickCount}
                          />
                        )}
                        <span className={cn(
                          "text-[11px] whitespace-nowrap",
                          isDangerous ? "text-red-400 dark:text-red-500" : "text-muted-foreground"
                        )}>
                          {formatDate(latest.date)}
                        </span>
                      </div>
                    </div>

                    {/* Row 2: subject */}
                    <div className="flex items-center gap-1.5">
                      <p className={cn(
                        "text-[12px] truncate flex-1",
                        isDangerous
                          ? "text-red-600/80 dark:text-red-400/80 font-medium"
                          : hasUnread
                          ? "text-foreground"
                          : "text-muted-foreground"
                      )}>
                        {thread.subject}
                      </p>
                      {thread.emails.length > 1 && (
                        <span className="shrink-0 flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                          <MessageSquareIcon className="size-2.5" />
                          {thread.emails.length}
                        </span>
                      )}
                    </div>

                    {/* Row 3: preview (hidden in compact mode) */}
                    {!isCompact && (
                      <p className={cn(
                        "text-[11px] line-clamp-1 leading-relaxed",
                        isDangerous ? "text-red-500/60 dark:text-red-400/50" : "text-muted-foreground"
                      )}>
                        {latest.preview}
                      </p>
                    )}

                    {/* Row 4: threat URLs summary */}
                    {isDangerous && thread.threatUrls.length > 0 && (
                      <p className="text-[10px] text-red-500 font-medium">
                        {thread.threatUrls.length} dangerous URL{thread.threatUrls.length !== 1 ? "s" : ""} detected
                      </p>
                    )}

                    {/* Row 5: tags */}
                    {thread.tagIds.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap pt-0.5">
                        {thread.tagIds.slice(0, 3).map((tagId) => {
                          const tag = getTag(tagId);
                          if (!tag) return null;
                          return (
                            <Tooltip key={tagId}>
                              <TooltipTrigger asChild>
                                <span className={cn(
                                  "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none",
                                  tag.bgClass,
                                  tag.textClass
                                )}>
                                  {tag.name}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>{tag.name}</TooltipContent>
                            </Tooltip>
                          );
                        })}
                        {thread.tagIds.length > 3 && (
                          <span className="text-[10px] text-muted-foreground">+{thread.tagIds.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Hover actions + star */}
                  <div className="flex items-center gap-0.5 shrink-0 self-start mt-0.5">
                    <div className="flex items-center gap-0 max-w-0 overflow-hidden opacity-0 group-hover:max-w-[60px] group-hover:opacity-100 transition-all duration-150">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={(e) => handleMarkRead(e, thread)}
                            className="p-0.5 rounded text-muted-foreground/50 hover:text-foreground transition-colors"
                          >
                            {thread.unreadCount > 0
                              ? <MailOpenIcon className="size-3.5" />
                              : <MailIcon className="size-3.5" />
                            }
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          {thread.unreadCount > 0 ? "Mark as read" : "Mark as unread"}
                        </TooltipContent>
                      </Tooltip>
                      {currentFolder !== "archive" && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={(e) => handleArchive(e, thread)}
                              className="p-0.5 rounded text-muted-foreground/50 hover:text-foreground transition-colors"
                            >
                              <ArchiveIcon className="size-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top">Archive</TooltipContent>
                        </Tooltip>
                      )}
                      {currentFolder !== "trash" && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={(e) => handleTrash(e, thread)}
                              className="p-0.5 rounded text-muted-foreground/50 hover:text-red-500 transition-colors"
                            >
                              <Trash2Icon className="size-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top">Move to trash</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    <button
                      onClick={(e) => handleStar(e, thread)}
                      className={cn(
                        "p-0.5 rounded transition-colors",
                        thread.isStarred
                          ? "text-yellow-500"
                          : "text-transparent group-hover:text-muted-foreground/50 hover:!text-yellow-400"
                      )}
                    >
                      <StarIcon className={cn("size-3.5", thread.isStarred && "fill-current")} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Dangerous email warning dialog ── */}
      <Dialog open={!!pendingDangerThread} onOpenChange={(open) => !open && setPendingDangerThread(null)}>
        <DialogContent className="sm:max-w-md border-red-200 dark:border-red-900">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <div className="flex size-9 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/50 shrink-0">
                <ShieldAlertIcon className="size-5 text-red-600 dark:text-red-400" />
              </div>
              <DialogTitle className="text-red-700 dark:text-red-400">Dangerous Email Detected</DialogTitle>
            </div>
            <DialogDescription className="text-sm text-muted-foreground">
              This email contains URLs flagged as potentially dangerous by Google Safe Browsing. Links will be
              disabled and threats highlighted when you open it.
            </DialogDescription>
          </DialogHeader>

          {pendingDangerThread && pendingDangerThread.threatUrls.length > 0 && (
            <div className="rounded-md border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 p-3 space-y-1.5">
              <p className="text-xs font-semibold text-red-700 dark:text-red-400">Flagged URLs:</p>
              {pendingDangerThread.threatUrls.map((url) => (
                <p key={url} className="text-xs text-red-600 dark:text-red-400 font-mono break-all">
                  {url}
                </p>
              ))}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPendingDangerThread(null)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={confirmDangerOpen}
            >
              Open anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
