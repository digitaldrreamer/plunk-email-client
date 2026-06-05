"use client";

import React, { useState } from "react";
import { XIcon, SendIcon, PaperclipIcon, ChevronDownIcon, MinimizeIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useEmailStore } from "@/store/email-store";

export function ComposeModal() {
  const { composing, setComposing } = useEmailStore();
  const [minimized, setMinimized] = useState(false);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  if (!composing) return null;

  const handleClose = () => {
    setComposing(false);
    setMinimized(false);
    setTo("");
    setSubject("");
    setBody("");
  };

  const handleSend = () => {
    // In a real app, send via API
    handleClose();
  };

  return (
    <div
      className={cn(
        "fixed bottom-0 right-4 z-50 w-[480px] max-w-[calc(100vw-2rem)] rounded-t-xl border border-border bg-card shadow-2xl transition-all duration-200",
        minimized && "h-12"
      )}
    >
      {/* Compose header */}
      <div
        className="flex h-12 items-center justify-between gap-2 rounded-t-xl bg-primary px-4 cursor-pointer"
        onClick={() => setMinimized((v) => !v)}
      >
        <span className="text-sm font-medium text-primary-foreground">
          {subject || "New message"}
        </span>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon-xs"
            className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/10"
            onClick={() => setMinimized((v) => !v)}
          >
            <MinimizeIcon className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/10"
            onClick={handleClose}
          >
            <XIcon className="size-3.5" />
          </Button>
        </div>
      </div>

      {!minimized && (
        <div className="flex flex-col">
          {/* To */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
            <span className="text-xs text-muted-foreground w-10 shrink-0">To</span>
            <Input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="Recipients"
              className="h-7 border-0 shadow-none px-0 text-sm focus-visible:ring-0"
            />
          </div>

          {/* Subject */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
            <span className="text-xs text-muted-foreground w-10 shrink-0">Subject</span>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="h-7 border-0 shadow-none px-0 text-sm focus-visible:ring-0"
            />
          </div>

          {/* Body */}
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your message..."
            className="min-h-[220px] rounded-none border-0 shadow-none px-4 py-3 text-sm focus-visible:ring-0 resize-none"
          />

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <div className="flex items-center gap-1.5">
              <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={handleSend} disabled={!to.trim() || !body.trim()}>
                <SendIcon className="size-3" />
                Send
              </Button>
              <Button variant="ghost" size="icon-sm" className="text-muted-foreground">
                <PaperclipIcon className="size-4" />
              </Button>
            </div>
            <Button variant="ghost" size="icon-sm" className="text-muted-foreground" onClick={handleClose}>
              <XIcon className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
