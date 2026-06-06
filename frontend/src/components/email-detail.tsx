"use client";

import React, { useState, useEffect } from "react";
import { EmailBodyFrame } from "@/components/email-body-frame";
import { format } from "date-fns";
import { LoaderIcon } from "lucide-react";
import {
  ArchiveIcon,
  Trash2Icon,
  ReplyIcon,
  ForwardIcon,
  StarIcon,
  MoreVerticalIcon,
  TagIcon,
  MailIcon,
  XIcon,
  PaperclipIcon,
  FileTextIcon,
  FileSpreadsheetIcon,
  ImageIcon,
  FileArchiveIcon,
  FileIcon,
  ShieldCheckIcon,
  ShieldAlertIcon,
  AlertTriangleIcon,
  SendIcon,
  MoveRightIcon,
  ChevronDownIcon,
  LinkIcon,
} from "lucide-react";

const BACKEND = process.env.NEXT_PUBLIC_API_URL || "https://api.mail.reclear.io";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useRef, useMemo } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useEmailStore } from "@/store/email-store";
import { getTag } from "@/data/tags";
import type { Email } from "@/data/emails";
import { EmailEditor, type EmailEditorRef } from "@/components/email-editor";

// ── Email body renderer ───────────────────────────────────────────────────────

function isHtmlBody(body: string) {
  return /<[a-z][\s\S]*>/i.test(body);
}


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

// ── Delivery timeline ─────────────────────────────────────────────────────────

type DeliveryStep = { key: string; label: string; done: boolean; timestamp?: string; count?: number };

function DeliveryTimeline({ email }: { email: Email }) {
  const status = email.deliveryStatus;
  if (!status || status === "pending") return null;

  const ORDER = ["sent", "delivered", "opened", "clicked"];
  const statusIdx = ORDER.indexOf(status);

  const steps: DeliveryStep[] = [
    { key: "sent",      label: "Sent",      done: statusIdx >= 0 },
    { key: "delivered", label: "Delivered", done: statusIdx >= 1, timestamp: email.deliveredAt },
    {
      key: "opened", label: "Opened", done: statusIdx >= 2,
      timestamp: email.firstOpenedAt,
      count: (email.openCount ?? 0) > 1 ? email.openCount : undefined,
    },
    {
      key: "clicked", label: "Clicked", done: statusIdx >= 3,
      timestamp: email.firstClickedAt,
      count: (email.clickCount ?? 0) > 1 ? email.clickCount : undefined,
    },
  ];

  const isBounced = status === "bounced";
  const isComplained = status === "complained";

  return (
    <div className="mt-4 pt-3 border-t border-border">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60 mb-2">Delivery</p>
      {isBounced ? (
        <div className="flex items-center gap-1.5 text-[11px] text-red-600 dark:text-red-400">
          <span className="size-2 rounded-full bg-red-500 shrink-0" />
          Bounced{email.bouncedAt ? ` · ${format(new Date(email.bouncedAt), "MMM d 'at' h:mm a")}` : ""}
          <span className="text-red-400/70 dark:text-red-500/70"> — address doesn't exist or was deactivated</span>
        </div>
      ) : isComplained ? (
        <div className="flex items-center gap-1.5 text-[11px] text-orange-600 dark:text-orange-400">
          <span className="size-2 rounded-full bg-orange-500 shrink-0" />
          Marked as spam by recipient
        </div>
      ) : (
        <div className="flex items-center gap-1 overflow-x-auto">
          {steps.map((step, i) => (
            <React.Fragment key={step.key}>
              <div className="flex flex-col items-center gap-0.5 min-w-[52px]">
                <span className={cn(
                  "size-2 rounded-full shrink-0",
                  step.done ? "bg-green-500" : "bg-muted-foreground/20"
                )} />
                <span className={cn(
                  "text-[10px] font-medium whitespace-nowrap",
                  step.done ? "text-green-600 dark:text-green-400" : "text-muted-foreground/40"
                )}>
                  {step.label}{step.count ? ` ×${step.count}` : ""}
                </span>
                {step.timestamp && step.done && (
                  <span className="text-[9px] text-muted-foreground/50 whitespace-nowrap">
                    {format(new Date(step.timestamp), "MMM d h:mm a")}
                  </span>
                )}
              </div>
              {i < steps.length - 1 && (
                <div className={cn("flex-1 h-px min-w-[12px] mb-3", step.done && steps[i + 1].done ? "bg-green-500/40" : "bg-muted-foreground/15")} />
              )}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
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

function EmailCard({
  email,
  isExpanded,
  onToggle,
  isDangerous,
  threatUrls,
}: {
  email: Email;
  isExpanded: boolean;
  onToggle: () => void;
  isDangerous?: boolean;
  threatUrls?: string[];
}) {
  const isFromMe = email.from.email === "me@reclear.io";
  const color = avatarColor(email.from.name);
  const initials = getInitials(email.from.name);

  return (
    <div className={cn("rounded-lg border border-border bg-background overflow-hidden")}>
      {/* Card header */}
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => e.key === "Enter" && onToggle()}
        className={cn(
          "flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors select-none",
          isExpanded ? "border-b border-border" : "hover:bg-muted/30"
        )}
      >
        <Avatar className={cn("size-7 shrink-0", color)}>
          <AvatarFallback className={cn("text-white text-xs font-medium", color)}>
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs font-medium text-foreground truncate">
                {isFromMe ? "Me" : email.from.name}
              </span>
              {email.from.verified && (
                <ShieldCheckIcon className="size-3 text-blue-500 shrink-0" />
              )}
            </div>
            <span className="text-[11px] text-muted-foreground shrink-0 whitespace-nowrap">
              {format(new Date(email.date), "MMM d 'at' h:mm a")}
            </span>
          </div>
          {!isExpanded && (
            <p className="text-[11px] text-muted-foreground truncate">{email.preview}</p>
          )}
        </div>
        <ChevronDownIcon
          className={cn(
            "size-3.5 text-muted-foreground shrink-0 transition-transform duration-150",
            isExpanded && "rotate-180"
          )}
        />
      </div>

      {/* Card body */}
      {isExpanded && (
        <div className="px-4 py-4">
          <p className="text-[11px] text-muted-foreground mb-4">
            To: {email.to.map((t) => t.name).join(", ")}
          </p>
          {isDangerous && (threatUrls?.length ?? 0) > 0 && (
            <div className="mb-4 flex items-start gap-2 rounded-md bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 px-3 py-2">
              <AlertTriangleIcon className="size-3.5 text-red-500 mt-0.5 shrink-0" />
              <div className="text-xs text-red-600 dark:text-red-400 space-y-0.5">
                <p className="font-semibold">Dangerous URLs detected — all links disabled</p>
                {threatUrls!.map((url) => (
                  <p key={url} className="font-mono break-all opacity-80">{url}</p>
                ))}
              </div>
            </div>
          )}
          {isDangerous && (
            <div className="mb-3 flex items-center gap-1.5 text-xs text-orange-600 dark:text-orange-400">
              <LinkIcon className="size-3" />
              All links have been disabled in this email
            </div>
          )}
          {isHtmlBody(email.body) ? (
            <EmailBodyFrame
              html={email.body}
              isDangerous={!!isDangerous}
              threatUrls={threatUrls}
            />
          ) : (
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
              {email.body}
            </div>
          )}

          {email.attachments && email.attachments.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center gap-1.5 mb-3">
                <PaperclipIcon className="size-3.5 text-muted-foreground" />
                <p className="text-xs font-semibold text-foreground">
                  {email.attachments.length} attachment{email.attachments.length !== 1 ? "s" : ""}
                </p>
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

          {/* Delivery timeline — sent emails only */}
          {email.folder === "sent" && <DeliveryTimeline email={email} />}
        </div>
      )}
    </div>
  );
}

export function EmailDetail() {
  const {
    selectedThreadId,
    selectThread,
    toggleStarThread,
    markThreadUnread,
    moveThread,
    deleteThread,
    addTagToThread,
    removeTagFromThread,
    replyToThread,
    getThread,
    tags,
    signature,
  } = useEmailStore();

  const [replyOpen, setReplyOpen] = useState(false);
  const [replySending, setReplySending] = useState(false);
  const [replyError, setReplyError] = useState("");
  const [replyThreatWarning, setReplyThreatWarning] = useState<{ threats: { url: string; threatTypes: string[] }[] } | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const replyEditorRef = useRef<EmailEditorRef>(null);
  const replyInitialHtml = useMemo(
    () => `<p><br></p><p><br></p>${signature}`,
    // Recompute when replyOpen flips to true so the editor is fresh
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [replyOpen]
  );

  const thread = selectedThreadId ? getThread(selectedThreadId) : undefined;

  useEffect(() => {
    if (thread) {
      setExpandedIds(new Set([thread.latestEmail.id]));
      setReplyOpen(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedThreadId]);

  if (!thread) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-card text-center px-8">
        <div className="space-y-2">
          <MailIcon className="size-10 text-muted-foreground/30 mx-auto" />
          <p className="text-sm font-medium text-muted-foreground">Select a conversation</p>
          <p className="text-xs text-muted-foreground/60">Your messages will appear here</p>
        </div>
      </div>
    );
  }

  const toggleCard = (emailId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(emailId)) next.delete(emailId);
      else next.add(emailId);
      return next;
    });
  };

  const others = thread.participants.filter((p) => p.email !== "me@reclear.io");
  const replyTarget = others[0]?.name ?? "sender";

  const doSendReply = async (override = false) => {
    const html = replyEditorRef.current?.getHtml() ?? "";
    const plain = replyEditorRef.current?.getPlainText() ?? "";
    if (!plain.trim()) return;

    const toAddress = others[0]?.email;
    if (!toAddress) return;

    setReplySending(true);
    setReplyError("");
    try {
      const form = new FormData();
      form.append("to[]", toAddress);
      form.append("subject", thread.subject.startsWith("Re:") ? thread.subject : `Re: ${thread.subject}`);
      form.append("body", html || plain);
      if (override) form.append("override", "true");

      const res = await fetch(`${BACKEND}/api/emails/send`, { method: "POST", body: form });
      const json = await res.json();

      if (!json.success && json.threatBlocked) {
        setReplyThreatWarning({ threats: json.threats ?? [] });
        return;
      }
      if (!json.success) throw new Error(json.error ?? "Send failed");

      setReplyThreatWarning(null);
      replyToThread(thread.id, html || plain);
      setReplyOpen(false);
    } catch (err) {
      setReplyError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setReplySending(false);
    }
  };

  const handleSendReply = () => doSendReply(false);
  const handleSendReplyAnyway = () => { setReplyThreatWarning(null); doSendReply(true); };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-full flex-col bg-card">

        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-border px-4 h-14 shrink-0">
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" onClick={() => moveThread(thread.id, "archive")}>
                  <ArchiveIcon className="size-4 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Archive</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" onClick={() => deleteThread(thread.id)}>
                  <Trash2Icon className="size-4 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" onClick={() => markThreadUnread(thread.id)}>
                  <MailIcon className="size-4 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Mark unread</TooltipContent>
            </Tooltip>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm">
                  <TagIcon className="size-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44">
                {tags.map((tag) => {
                  const hasTag = thread.tagIds.includes(tag.id);
                  return (
                    <DropdownMenuCheckboxItem
                      key={tag.id}
                      checked={hasTag}
                      onCheckedChange={(checked) =>
                        checked
                          ? addTagToThread(thread.id, tag.id)
                          : removeTagFromThread(thread.id, tag.id)
                      }
                    >
                      <span className={cn("size-2 rounded-full mr-1.5 shrink-0", tag.dotClass)} />
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
                      <DropdownMenuItem key={f} onClick={() => moveThread(thread.id, f)} className="capitalize">
                        {f}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => markThreadUnread(thread.id)}>
                  <MailIcon className="size-4 mr-2" />
                  Mark unread
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" onClick={() => toggleStarThread(thread.id)}>
                  <StarIcon
                    className={cn(
                      "size-4",
                      thread.isStarred ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground"
                    )}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{thread.isStarred ? "Unstar" : "Star"}</TooltipContent>
            </Tooltip>
            <Button variant="ghost" size="icon-sm" onClick={() => selectThread(null)}>
              <XIcon className="size-4 text-muted-foreground" />
            </Button>
          </div>
        </div>

        {/* Danger banner */}
        {thread.category === "dangerous" && (
          <div className="shrink-0 flex items-start gap-3 border-b border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-5 py-3">
            <ShieldAlertIcon className="size-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-red-700 dark:text-red-400">
                Dangerous email — Google Safe Browsing detected {thread.threatUrls.length} malicious URL{thread.threatUrls.length !== 1 ? "s" : ""}
              </p>
              <p className="text-[11px] text-red-500/80 dark:text-red-400/70 mt-0.5">
                All links are disabled. Do not click any URLs or download attachments from this sender.
              </p>
              {thread.threatUrls.length > 0 && (
                <div className="mt-1.5 space-y-0.5">
                  {thread.threatUrls.map((url) => (
                    <p key={url} className="text-[10px] font-mono text-red-600/70 dark:text-red-400/60 break-all">{url}</p>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Thread header */}
        <div className={cn(
          "shrink-0 border-b px-5 py-3",
          thread.category === "dangerous" ? "border-red-200 dark:border-red-900/50" : "border-border"
        )}>
          <h1 className={cn(
            "text-sm font-semibold leading-tight mb-1.5",
            thread.category === "dangerous" ? "text-red-700 dark:text-red-400" : "text-foreground"
          )}>
            {thread.subject}
          </h1>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">
              {others.map((p) => p.name).join(", ") || "Me"}
            </span>
            {thread.emails.length > 1 && (
              <span className="text-[11px] text-muted-foreground/60">
                · {thread.emails.length} messages
              </span>
            )}
            {thread.tagIds.length > 0 && (
              <>
                <span className="text-muted-foreground/30">·</span>
                {thread.tagIds.map((tagId) => {
                  const tag = getTag(tagId);
                  if (!tag) return null;
                  return (
                    <Badge
                      key={tagId}
                      variant="outline"
                      className={cn("gap-1 border-transparent text-[10px] h-4 px-1.5 py-0", tag.bgClass, tag.textClass)}
                    >
                      <span className={cn("size-1.5 rounded-full shrink-0", tag.dotClass)} />
                      {tag.name}
                    </Badge>
                  );
                })}
              </>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {thread.emails.map((email) => (
            <EmailCard
              key={email.id}
              email={email}
              isExpanded={expandedIds.has(email.id)}
              onToggle={() => toggleCard(email.id)}
              isDangerous={thread.category === "dangerous"}
              threatUrls={thread.threatUrls}
            />
          ))}
        </div>

        {/* Reply / footer */}
        {replyOpen ? (
          <div className="shrink-0 border-t border-border">
            <div className="flex items-center justify-between px-4 pt-3 pb-1">
              <p className="text-xs font-medium text-foreground">Reply to {replyTarget}</p>
              <Button variant="ghost" size="icon-xs" onClick={() => setReplyOpen(false)}>
                <XIcon className="size-3.5" />
              </Button>
            </div>
            <EmailEditor
              ref={replyEditorRef}
              placeholder="Write your reply…"
              initialHtml={replyInitialHtml}
              minHeight="120px"
              autoFocus
              className="rounded-none border-0 border-b border-border shadow-none"
            />
            {replyError && (
              <p className="px-4 pb-1 text-xs text-destructive">{replyError}</p>
            )}
            <div className="flex items-center gap-1.5 px-4 py-2">
              <Button size="sm" className="h-7 gap-1.5 text-xs" onClick={handleSendReply} disabled={replySending}>
                {replySending ? (
                  <LoaderIcon className="size-3 animate-spin" />
                ) : (
                  <SendIcon className="size-3" />
                )}
                {replySending ? "Sending…" : "Send"}
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setReplyOpen(false)} disabled={replySending}>
                Discard
              </Button>
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
              onClick={() => moveThread(thread.id, "archive")}
            >
              <ArchiveIcon className="size-3.5" />
              Archive
            </Button>
          </div>
        )}
      </div>

      {/* Reply threat warning dialog */}
      <Dialog open={!!replyThreatWarning} onOpenChange={(open) => !open && setReplyThreatWarning(null)}>
        <DialogContent className="sm:max-w-md border-red-200 dark:border-red-900">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <div className="flex size-9 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/50 shrink-0">
                <ShieldAlertIcon className="size-5 text-red-600 dark:text-red-400" />
              </div>
              <DialogTitle className="text-red-700 dark:text-red-400">Dangerous URLs in Reply</DialogTitle>
            </div>
            <DialogDescription>
              Your reply contains URLs flagged as dangerous by Google Safe Browsing.
            </DialogDescription>
          </DialogHeader>
          {(replyThreatWarning?.threats.length ?? 0) > 0 && (
            <div className="rounded-md border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 p-3 space-y-2">
              {replyThreatWarning!.threats.map((t) => (
                <div key={t.url} className="space-y-0.5">
                  <p className="text-xs font-mono text-red-700 dark:text-red-400 break-all">{t.url}</p>
                  <p className="text-[11px] text-red-500/80">{t.threatTypes.join(", ")}</p>
                </div>
              ))}
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setReplyThreatWarning(null)}>
              Edit reply
            </Button>
            <Button size="sm" variant="destructive" onClick={handleSendReplyAnyway} disabled={replySending}>
              {replySending ? <LoaderIcon className="size-3 animate-spin mr-1" /> : null}
              Send anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
