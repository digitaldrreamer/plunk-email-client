"use client";

import React, { useRef, useState, useMemo, useCallback, useEffect, KeyboardEvent } from "react";
import { XIcon, SendIcon, PaperclipIcon, MinimizeIcon, SaveIcon, LoaderIcon, ShieldAlertIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEmailStore } from "@/store/email-store";
import { useAuthStore } from "@/store/auth-store";
import { EmailEditor, type EmailEditorRef } from "@/components/email-editor";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// ── Recipient chip input ──────────────────────────────────────────────────────

interface ContactSuggestion { id: string; email: string; name: string }

function RecipientInput({
  recipients,
  onChange,
}: {
  recipients: string[];
  onChange: (r: string[]) => void;
}) {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<ContactSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const token = useAuthStore((s) => s.token);

  // Debounced contact search
  useEffect(() => {
    if (input.length < 2) { setSuggestions([]); setShowSuggestions(false); return; }
    const timer = setTimeout(async () => {
      if (!token) return;
      try {
        const res = await fetch(`${BACKEND}/api/contacts?q=${encodeURIComponent(input)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const json = await res.json() as { success: boolean; data: ContactSuggestion[] };
        const filtered = (json.data ?? []).filter((c) => !recipients.includes(c.email));
        setSuggestions(filtered);
        setShowSuggestions(filtered.length > 0);
        setActiveSuggestion(-1);
      } catch { /* ignore */ }
    }, 300);
    return () => clearTimeout(timer);
  }, [input, token, recipients]);

  const add = useCallback(
    (raw: string) => {
      const values = raw
        .split(/[,;\s]+/)
        .map((v) => v.trim())
        .filter((v) => v.length > 0);
      if (!values.length) return;
      const next = [...recipients];
      for (const v of values) {
        if (!next.includes(v)) next.push(v);
      }
      onChange(next);
      setInput("");
      setSuggestions([]);
      setShowSuggestions(false);
    },
    [recipients, onChange]
  );

  const addContact = useCallback(
    (c: ContactSuggestion) => {
      if (!recipients.includes(c.email)) onChange([...recipients, c.email]);
      setInput("");
      setSuggestions([]);
      setShowSuggestions(false);
      setActiveSuggestion(-1);
      inputRef.current?.focus();
    },
    [recipients, onChange]
  );

  const remove = useCallback(
    (r: string) => onChange(recipients.filter((x) => x !== r)),
    [recipients, onChange]
  );

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setActiveSuggestion((i) => Math.min(i + 1, suggestions.length - 1)); return; }
      if (e.key === "ArrowUp")   { e.preventDefault(); setActiveSuggestion((i) => Math.max(i - 1, -1)); return; }
      if (e.key === "Enter" && activeSuggestion >= 0) { e.preventDefault(); addContact(suggestions[activeSuggestion]); return; }
      if (e.key === "Escape") { setShowSuggestions(false); return; }
    }
    if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
      e.preventDefault();
      add(input);
    } else if (e.key === "Backspace" && input === "" && recipients.length > 0) {
      remove(recipients[recipients.length - 1]);
    }
  };

  const handleBlur = () => {
    // Delay so click on suggestion registers first
    setTimeout(() => {
      if (input.trim()) add(input);
      setShowSuggestions(false);
    }, 150);
  };

  return (
    <div className="relative">
      <div
        className="flex flex-wrap items-center gap-1.5 px-4 py-2 border-b border-border min-h-[38px] cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        <span className="text-xs text-muted-foreground w-6 shrink-0">To</span>
        {recipients.map((r) => (
          <span
            key={r}
            className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground"
          >
            {r}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); remove(r); }}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <XIcon className="size-2.5" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          onBlur={handleBlur}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          placeholder={recipients.length === 0 ? "Add recipients…" : ""}
          className="flex-1 min-w-[120px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 rounded-b-lg border border-t-0 border-border bg-card shadow-md overflow-hidden">
          {suggestions.map((c, i) => (
            <button
              key={c.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); addContact(c); }}
              className={cn(
                "w-full flex items-center gap-2.5 px-4 py-2 text-left transition-colors",
                i === activeSuggestion ? "bg-accent" : "hover:bg-muted/50"
              )}
            >
              <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-[10px] font-semibold text-primary">
                {c.name ? c.name[0].toUpperCase() : c.email[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                {c.name && <p className="text-xs font-medium text-foreground truncate">{c.name}</p>}
                <p className="text-[11px] text-muted-foreground truncate">{c.email}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Compose modal ─────────────────────────────────────────────────────────────

export function ComposeModal() {
  const { composing, setComposing, signature } = useEmailStore();
  const [minimized, setMinimized] = useState(false);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [threatWarning, setThreatWarning] = useState<{ threats: { url: string; threatTypes: string[] }[] } | null>(null);
  const editorRef = useRef<EmailEditorRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initialHtml = useMemo(
    () => `<p><br></p><p><br></p>${signature}`,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  if (!composing) return null;

  const handleClose = () => {
    setComposing(false);
    setMinimized(false);
    setRecipients([]);
    setSubject("");
    setAttachments([]);
    setError("");
  };

  const doSend = async (override = false) => {
    const html = editorRef.current?.getHtml() ?? "";
    if (!recipients.length || !html.trim()) return;
    setSending(true);
    setError("");
    try {
      const form = new FormData();
      recipients.forEach((r) => form.append("to[]", r));
      form.append("subject", subject || "(no subject)");
      form.append("body", html);
      attachments.forEach((f) => form.append("files", f));
      if (override) form.append("override", "true");

      const res = await fetch(`${BACKEND}/api/emails/send`, {
        method: "POST",
        body: form,
      });
      const json = await res.json();

      if (!json.success && json.threatBlocked) {
        setThreatWarning({ threats: json.threats ?? [] });
        return;
      }
      if (!json.success) throw new Error(json.error ?? "Send failed");
      setThreatWarning(null);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  };

  const handleSend = () => doSend(false);
  const handleSendAnyway = () => { setThreatWarning(null); doSend(true); };

  const handleSaveDraft = () => {
    // TODO: persist draft via backend
    handleClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setAttachments((prev) => [...prev, ...files]);
    e.target.value = "";
  };

  const removeAttachment = (idx: number) =>
    setAttachments((prev) => prev.filter((_, i) => i !== idx));

  return (
    <>
    {/* Outgoing threat warning */}
    <Dialog open={!!threatWarning} onOpenChange={(open) => !open && setThreatWarning(null)}>
      <DialogContent className="sm:max-w-md border-red-200 dark:border-red-900">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="flex size-9 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/50 shrink-0">
              <ShieldAlertIcon className="size-5 text-red-600 dark:text-red-400" />
            </div>
            <DialogTitle className="text-red-700 dark:text-red-400">Dangerous URLs Detected</DialogTitle>
          </div>
          <DialogDescription>
            Your email contains URLs flagged as dangerous by Google Safe Browsing. The recipient may be at risk.
          </DialogDescription>
        </DialogHeader>
        {(threatWarning?.threats.length ?? 0) > 0 && (
          <div className="rounded-md border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 p-3 space-y-2">
            {threatWarning!.threats.map((t) => (
              <div key={t.url} className="space-y-0.5">
                <p className="text-xs font-mono text-red-700 dark:text-red-400 break-all">{t.url}</p>
                <p className="text-[11px] text-red-500/80">{t.threatTypes.join(", ")}</p>
              </div>
            ))}
          </div>
        )}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={() => setThreatWarning(null)}>
            Edit email
          </Button>
          <Button size="sm" variant="destructive" onClick={handleSendAnyway} disabled={sending}>
            {sending ? <LoaderIcon className="size-3 animate-spin mr-1" /> : null}
            Send anyway
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <div
      className={cn(
        "fixed bottom-0 right-4 z-50 w-[540px] max-w-[calc(100vw-2rem)] rounded-t-xl border border-border bg-card shadow-2xl transition-all duration-200",
        minimized && "h-12 overflow-hidden"
      )}
    >
      {/* Header */}
      <div
        className="flex h-12 items-center justify-between gap-2 rounded-t-xl bg-primary px-4 cursor-pointer select-none"
        onClick={() => setMinimized((v) => !v)}
      >
        <span className="text-sm font-medium text-primary-foreground truncate">
          {subject || "New message"}
        </span>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost" size="icon-xs"
            className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/10"
            onClick={() => setMinimized((v) => !v)}
          >
            <MinimizeIcon className="size-3.5" />
          </Button>
          <Button
            variant="ghost" size="icon-xs"
            className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/10"
            onClick={handleClose}
          >
            <XIcon className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col">
        {/* Recipients */}
        <RecipientInput recipients={recipients} onChange={setRecipients} />

        {/* Subject */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
          <span className="text-xs text-muted-foreground w-6 shrink-0">Re</span>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="h-7 border-0 shadow-none px-0 text-sm focus-visible:ring-0"
          />
        </div>

        {/* Rich text editor */}
        <EmailEditor
          ref={editorRef}
          placeholder="Write your message…"
          initialHtml={initialHtml}
          minHeight="200px"
          autoFocus
          className="rounded-none border-0 border-b border-border shadow-none"
        />

        {/* Attachment chips */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-4 pt-2 pb-1 border-t border-border">
            {attachments.map((f, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground"
              >
                <PaperclipIcon className="size-2.5 text-muted-foreground" />
                {f.name}
                <button
                  type="button"
                  onClick={() => removeAttachment(i)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <XIcon className="size-2.5" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="px-4 py-1 text-xs text-destructive">{error}</p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3">
          {/* Left: attach */}
          <div className="flex items-center gap-1">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground"
              onClick={() => fileInputRef.current?.click()}
            >
              <PaperclipIcon className="size-4" />
            </Button>
          </div>

          {/* Right: Save draft + Send */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={handleSaveDraft}
              disabled={sending}
            >
              <SaveIcon className="size-3" />
              Save draft
            </Button>
            <Button
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={handleSend}
              disabled={recipients.length === 0 || sending}
            >
              {sending ? (
                <LoaderIcon className="size-3 animate-spin" />
              ) : (
                <SendIcon className="size-3" />
              )}
              {sending ? "Sending…" : "Send"}
            </Button>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
