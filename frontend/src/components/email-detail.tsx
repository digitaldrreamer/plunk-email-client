"use client";

import React, { useState } from "react";
import { format } from "date-fns";
import {
  ArchiveIcon,
  Trash2Icon,
  ReplyIcon,
  ForwardIcon,
  StarIcon,
  MoreVerticalIcon,
  TagIcon,
  MailOpenIcon,
  MailIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XIcon,
  PaperclipIcon,
  FileTextIcon,
  FileSpreadsheetIcon,
  ImageIcon,
  FileArchiveIcon,
  FileIcon,
  ShieldCheckIcon,
  SendIcon,
  MoveRightIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { useEmailStore } from "@/store/email-store";
import { getTag } from "@/data/tags";

function getFileIcon(type: string) {
  if (type.includes("pdf") || type.includes("word") || type.includes("document") || type.includes("text")) return FileTextIcon;
  if (type.includes("excel") || type.includes("spreadsheet") || type.includes("csv")) return FileSpreadsheetIcon;
  if (type.includes("image") || type.includes("png") || type.includes("jpg") || type.includes("jpeg")) return ImageIcon;
  if (type.includes("zip") || type.includes("archive") || type.includes("tar")) return FileArchiveIcon;
  return FileIcon;
}

const FILE_COLORS: Record<string, string> = {
  pdf: "from-red-500 to-red-700",
  word: "from-blue-500 to-blue-700",
  excel: "from-green-500 to-green-700",
  image: "from-purple-500 to-purple-700",
  zip: "from-orange-500 to-orange-700",
  default: "from-zinc-400 to-zinc-600",
};

function fileGradient(type: string) {
  if (type.includes("pdf")) return FILE_COLORS.pdf;
  if (type.includes("word") || type.includes("document")) return FILE_COLORS.word;
  if (type.includes("excel") || type.includes("spreadsheet")) return FILE_COLORS.excel;
  if (type.includes("image") || type.includes("png") || type.includes("jpg")) return FILE_COLORS.image;
  if (type.includes("zip") || type.includes("archive")) return FILE_COLORS.zip;
  return FILE_COLORS.default;
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

export function EmailDetail() {
  const {
    emails,
    selectedEmailId,
    selectEmail,
    toggleStar,
    markRead,
    markUnread,
    moveToFolder,
    deleteEmail,
    addTag,
    removeTag,
    tags,
  } = useEmailStore();

  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");

  const email = emails.find((e) => e.id === selectedEmailId);
  const visibleIndex = emails.filter((e) => !selectedEmailId || true).findIndex((e) => e.id === selectedEmailId);
  const prev = visibleIndex > 0 ? emails[visibleIndex - 1] : null;
  const next = visibleIndex < emails.length - 1 ? emails[visibleIndex + 1] : null;

  if (!email) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-card text-center px-8">
        <div className="space-y-2">
          <MailIcon className="size-10 text-muted-foreground/30 mx-auto" />
          <p className="text-sm font-medium text-muted-foreground">Select an email to read</p>
          <p className="text-xs text-muted-foreground/60">Your messages will appear here</p>
        </div>
      </div>
    );
  }

  const initials = getInitials(email.from.name);
  const color = avatarColor(email.from.name);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-full flex-col bg-card">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-border px-4 h-14 shrink-0">
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" onClick={() => moveToFolder(email.id, "archive")}>
                  <ArchiveIcon className="size-4 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Archive</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" onClick={() => deleteEmail(email.id)}>
                  <Trash2Icon className="size-4 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => (email.read ? markUnread(email.id) : markRead(email.id))}
                >
                  {email.read ? (
                    <MailIcon className="size-4 text-muted-foreground" />
                  ) : (
                    <MailOpenIcon className="size-4 text-muted-foreground" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{email.read ? "Mark unread" : "Mark read"}</TooltipContent>
            </Tooltip>

            {/* Tag button */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm">
                  <TagIcon className="size-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44">
                {tags.map((tag) => {
                  const hasTag = email.tagIds.includes(tag.id);
                  return (
                    <DropdownMenuCheckboxItem
                      key={tag.id}
                      checked={hasTag}
                      onCheckedChange={(checked) =>
                        checked ? addTag(email.id, tag.id) : removeTag(email.id, tag.id)
                      }
                    >
                      <span className={cn("size-2 rounded-full mr-1", tag.dotClass)} />
                      {tag.name}
                    </DropdownMenuCheckboxItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm">
                  <MoreVerticalIcon className="size-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <MoveRightIcon className="size-4 mr-2" />
                    Move to
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {(["inbox", "archive", "spam", "trash"] as const).map((f) => (
                      <DropdownMenuItem key={f} onClick={() => moveToFolder(email.id, f)} className="capitalize">
                        {f}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => (email.read ? markUnread(email.id) : markRead(email.id))}>
                  {email.read ? <MailIcon className="size-4 mr-2" /> : <MailOpenIcon className="size-4 mr-2" />}
                  {email.read ? "Mark unread" : "Mark read"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:block">
              {visibleIndex + 1} / {emails.length}
            </span>
            <div className="flex items-center gap-0.5">
              <Button variant="ghost" size="icon-sm" onClick={() => prev && selectEmail(prev.id)} disabled={!prev}>
                <ChevronLeftIcon className={cn("size-4", !prev ? "text-muted-foreground/30" : "text-muted-foreground")} />
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={() => next && selectEmail(next.id)} disabled={!next}>
                <ChevronRightIcon className={cn("size-4", !next ? "text-muted-foreground/30" : "text-muted-foreground")} />
              </Button>
            </div>
            <Button variant="ghost" size="icon-sm" onClick={() => selectEmail(null)}>
              <XIcon className="size-4 text-muted-foreground" />
            </Button>
          </div>
        </div>

        {/* Email header */}
        <div className="border-b border-border px-5 py-4 shrink-0">
          <h1 className="text-base font-semibold text-foreground leading-tight mb-3">
            {email.subject}
          </h1>

          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <Avatar className={cn("size-9 shrink-0 text-white", color)}>
                <AvatarFallback className={cn("text-white text-xs font-medium", color)}>
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-medium text-foreground">{email.from.name}</span>
                  {email.from.verified && (
                    <ShieldCheckIcon className="size-3.5 text-blue-500 shrink-0" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">{email.from.email}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  To: {email.to.map((t) => t.name).join(", ")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted-foreground hidden md:block whitespace-nowrap">
                {format(new Date(email.date), "MMM d, yyyy 'at' h:mm a")}
              </span>
              <Button variant="ghost" size="icon-sm" onClick={() => toggleStar(email.id)}>
                <StarIcon
                  className={cn("size-4", email.starred ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground")}
                />
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={() => setReplyOpen(true)}>
                <ReplyIcon className="size-4 text-muted-foreground" />
              </Button>
              <Button variant="ghost" size="icon-sm">
                <ForwardIcon className="size-4 text-muted-foreground" />
              </Button>
            </div>
          </div>

          {/* Tags */}
          {email.tagIds.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap mt-3">
              {email.tagIds.map((tagId) => {
                const tag = getTag(tagId);
                if (!tag) return null;
                return (
                  <Badge
                    key={tagId}
                    variant="outline"
                    className={cn("gap-1 border-transparent", tag.bgClass, tag.textClass)}
                  >
                    <span className={cn("size-1.5 rounded-full", tag.dotClass)} />
                    {tag.name}
                  </Badge>
                );
              })}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
              {email.body}
            </div>
          </div>

          {/* Attachments */}
          {email.attachments && email.attachments.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center gap-1.5 mb-3">
                <PaperclipIcon className="size-3.5 text-muted-foreground" />
                <p className="text-xs font-semibold text-foreground">{email.attachments.length} attachment{email.attachments.length !== 1 ? "s" : ""}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {email.attachments.map((att) => {
                  const FileIconComp = getFileIcon(att.type);
                  const grad = fileGradient(att.type);
                  return (
                    <div
                      key={att.id}
                      className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/50 px-3 py-2 hover:bg-muted transition-colors cursor-pointer"
                    >
                      <div className={cn("size-7 flex items-center justify-center rounded-md bg-gradient-to-br shrink-0", grad)}>
                        <FileIconComp className="size-3.5 text-white" />
                      </div>
                      <div className="leading-tight">
                        <p className="text-xs font-medium text-foreground max-w-[150px] truncate">{att.name}</p>
                        <p className="text-[11px] text-muted-foreground">{att.size}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Reply area */}
        {replyOpen ? (
          <div className="shrink-0 border-t border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-foreground">
                Reply to {email.from.name}
              </p>
              <Button variant="ghost" size="icon-xs" onClick={() => { setReplyOpen(false); setReplyText(""); }}>
                <XIcon className="size-3.5" />
              </Button>
            </div>
            <Textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write your reply..."
              className="text-sm min-h-[100px]"
              autoFocus
            />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Button size="sm" className="h-7 gap-1.5 text-xs" disabled={!replyText.trim()}>
                  <SendIcon className="size-3" />
                  Send
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setReplyOpen(false); setReplyText(""); }}>
                  Discard
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="shrink-0 border-t border-border px-5 py-3 flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => setReplyOpen(true)}
            >
              <ReplyIcon className="size-3.5" />
              Reply
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
              <ForwardIcon className="size-3.5" />
              Forward
            </Button>
            <Separator orientation="vertical" className="h-4" />
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs text-muted-foreground"
              onClick={() => moveToFolder(email.id, "archive")}
            >
              <ArchiveIcon className="size-3.5" />
              Archive
            </Button>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
