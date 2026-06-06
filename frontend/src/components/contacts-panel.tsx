"use client";

import { useEffect, useState, useCallback } from "react";
import { SearchIcon, LoaderIcon, MailIcon, XCircleIcon, CheckCircleIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

interface Contact {
  id: string;
  email: string;
  name: string;
  subscribed: boolean;
  bounced: boolean;
  complained: boolean;
  lastSeenAt?: string;
  createdAt: string;
}

const AVATAR_COLORS = [
  "bg-blue-500", "bg-green-500", "bg-purple-500", "bg-orange-500",
  "bg-pink-500", "bg-cyan-500", "bg-red-500", "bg-yellow-500",
];
function avatarColor(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}
function initials(name: string, email: string) {
  const parts = (name || email).trim().split(" ");
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (name || email).slice(0, 2).toUpperCase();
}
function relativeTime(iso?: string) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export function ContactsPanel({ onBack }: { onBack?: () => void }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState<Set<string>>(new Set());

  const load = useCallback(async (query: string, pg: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      else params.set("page", String(pg));
      const res = await apiFetch<{ data: Contact[]; total: number }>(`/api/contacts?${params}`);
      setContacts(pg === 1 || query ? res.data : (prev) => [...prev, ...res.data]);
      setTotal(res.total);
    } catch {
      toast.error("Failed to load contacts");
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); load(q, 1); }, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [q, load]);

  const toggleSubscribe = async (contact: Contact) => {
    setToggling((s) => new Set(s).add(contact.email));
    try {
      await apiFetch(`/api/contacts/${encodeURIComponent(contact.email)}/subscribe`, {
        method: "PATCH",
        body: JSON.stringify({ subscribed: !contact.subscribed }),
      });
      setContacts((cs) =>
        cs.map((c) => c.email === contact.email ? { ...c, subscribed: !c.subscribed } : c)
      );
      toast.success(contact.subscribed ? "Unsubscribed" : "Resubscribed");
    } catch {
      toast.error("Failed to update contact");
    } finally {
      setToggling((s) => { const n = new Set(s); n.delete(contact.email); return n; });
    }
  };

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    load(q, next);
  };

  const hasMore = !q && contacts.length < total;

  return (
    <div className="flex flex-col h-full bg-card border-r border-border">
      {/* Header */}
      <div className="shrink-0 border-b border-border px-4 h-14 flex items-center gap-2">
        {onBack && (
          <button onClick={onBack} className="text-muted-foreground hover:text-foreground mr-1 text-sm">←</button>
        )}
        <h2 className="text-sm font-semibold text-foreground">Contacts</h2>
        {total > 0 && (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground leading-none">
            {total}
          </span>
        )}
      </div>

      {/* Search */}
      <div className="shrink-0 px-4 py-3 border-b border-border">
        <div className="relative">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search contacts…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full h-8 rounded-md border border-input bg-background pl-8 pr-3 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading && contacts.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <LoaderIcon className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-center px-6">
            <MailIcon className="size-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">{q ? "No contacts found" : "No contacts yet"}</p>
            <p className="text-xs text-muted-foreground/60">
              {q ? "Try a different search" : "Contacts appear here when you send emails"}
            </p>
          </div>
        ) : (
          <>
            {contacts.map((contact) => {
              const color = avatarColor(contact.email);
              const isToggling = toggling.has(contact.email);
              return (
                <div
                  key={contact.id}
                  className="flex items-center gap-3 px-4 py-3 border-b border-border hover:bg-muted/30 transition-colors"
                >
                  <Avatar className={cn("size-8 shrink-0", color)}>
                    <AvatarFallback className={cn("text-white text-xs font-medium", color)}>
                      {initials(contact.name, contact.email)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[13px] font-medium text-foreground truncate">
                        {contact.name || contact.email}
                      </span>
                      {contact.bounced && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1 text-red-600 border-red-300/40">bounced</Badge>
                      )}
                      {contact.complained && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1 text-orange-600 border-orange-300/40">complained</Badge>
                      )}
                    </div>
                    {contact.name && (
                      <p className="text-xs text-muted-foreground truncate">{contact.email}</p>
                    )}
                    {contact.lastSeenAt && (
                      <p className="text-[11px] text-muted-foreground/50">{relativeTime(contact.lastSeenAt)}</p>
                    )}
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "shrink-0 h-7 gap-1.5 text-xs",
                      contact.subscribed
                        ? "text-green-600 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                        : "text-muted-foreground hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30"
                    )}
                    onClick={() => toggleSubscribe(contact)}
                    disabled={isToggling || contact.bounced || contact.complained}
                  >
                    {isToggling ? (
                      <LoaderIcon className="size-3.5 animate-spin" />
                    ) : contact.subscribed ? (
                      <><CheckCircleIcon className="size-3.5" /><span>Subscribed</span></>
                    ) : (
                      <><XCircleIcon className="size-3.5" /><span>Unsubscribed</span></>
                    )}
                  </Button>
                </div>
              );
            })}

            {hasMore && (
              <div className="p-4 flex justify-center">
                <Button variant="outline" size="sm" onClick={loadMore} disabled={loading} className="gap-1.5">
                  {loading && <LoaderIcon className="size-3.5 animate-spin" />}
                  Load more
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
