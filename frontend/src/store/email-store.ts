"use client";

import { create } from "zustand";
import { EMAILS, ME, type Email, type Contact, type Folder, type Category } from "@/data/emails";
import { TAGS, type Tag } from "@/data/tags";

// ── Thread type (derived, never stored) ─────────────────────────────────────

export interface Thread {
  id: string;
  subject: string;
  emails: Email[]; // sorted ASC by date
  latestEmail: Email;
  participants: Contact[]; // unique senders, in first-appearance order
  unreadCount: number;
  isStarred: boolean;
  folder: Folder;
  category: Category;
  tagIds: string[];
  threatUrls: string[];
  // Delivery tracking — from the last sent email in the thread
  deliveryStatus?: string;
  openCount: number;
  clickCount: number;
}

function buildThread(threadId: string, emails: Email[]): Thread {
  const sorted = [...emails].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const latestEmail = sorted[sorted.length - 1];

  // Folder/category from the latest non-sent, non-draft email
  const anchors = sorted.filter((e) => e.folder !== "sent" && e.folder !== "drafts");
  const anchor = anchors[anchors.length - 1] ?? sorted[0];

  // Unique participants (preserving order; exclude "me@reclear.io" from display)
  const seen = new Set<string>();
  const participants: Contact[] = [];
  for (const email of sorted) {
    if (!seen.has(email.from.email)) {
      seen.add(email.from.email);
      participants.push(email.from);
    }
  }

  return {
    id: threadId,
    subject: sorted[0].subject.replace(/^(Re:\s*|Fwd:\s*)+/gi, "").trim(),
    emails: sorted,
    latestEmail,
    participants,
    unreadCount: sorted.filter((e) => !e.read).length,
    isStarred: sorted.some((e) => e.starred),
    folder: anchor.folder,
    category: anchor.category,
    tagIds: [...new Set(sorted.flatMap((e) => e.tagIds))],
    threatUrls: [...new Set(sorted.flatMap((e) => e.threatUrls ?? []))],
    ...(() => {
      const lastSent = [...sorted].filter((e) => e.folder === "sent").at(-1);
      return {
        deliveryStatus: lastSent?.deliveryStatus,
        openCount: lastSent?.openCount ?? 0,
        clickCount: lastSent?.clickCount ?? 0,
      };
    })(),
  };
}

// ── Store ─────────────────────────────────────────────────────────────────────

type Filter = "all" | "unread" | "starred";

interface EmailStore {
  emails: Email[];
  tags: Tag[];
  selectedThreadId: string | null;
  currentFolder: Folder;
  currentCategory: Category;
  filter: Filter;
  activeTagFilter: string | null;
  composing: boolean;

  // Derived
  visibleThreads: () => Thread[];
  getThread: (id: string) => Thread | undefined;
  unreadCount: (folder: Folder, category?: Category) => number;

  // Navigation
  selectThread: (id: string | null) => void;
  setFolder: (folder: Folder) => void;
  setCategory: (category: Category) => void;
  setFilter: (filter: Filter) => void;
  setTagFilter: (tagId: string | null) => void;

  // Thread-level actions
  toggleStarThread: (threadId: string) => void;
  markThreadRead: (threadId: string) => void;
  markThreadUnread: (threadId: string) => void;
  moveThread: (threadId: string, folder: Folder) => void;
  deleteThread: (threadId: string) => void;
  addTagToThread: (threadId: string, tagId: string) => void;
  removeTagFromThread: (threadId: string, tagId: string) => void;
  replyToThread: (threadId: string, body: string) => void;

  // UI
  setComposing: (v: boolean) => void;
  addUserTag: (name: string, color: string) => void;

  // Signature
  signature: string;
  setSignature: (sig: string) => void;
}

export const useEmailStore = create<EmailStore>((set, get) => ({
  emails: EMAILS,
  tags: TAGS,
  selectedThreadId: null,
  currentFolder: "inbox",
  currentCategory: "primary",
  filter: "all",
  activeTagFilter: null,
  composing: false,
  signature: "<p>—</p><p>Me · me@reclear.io</p>",

  visibleThreads: () => {
    const { emails, currentFolder, currentCategory, filter, activeTagFilter } = get();

    // Group all emails by threadId
    const groups = new Map<string, Email[]>();
    for (const email of emails) {
      const group = groups.get(email.threadId) ?? [];
      group.push(email);
      groups.set(email.threadId, group);
    }

    // Build and filter threads
    let threads = [...groups.entries()].map(([id, grp]) => buildThread(id, grp));

    threads = threads.filter((t) => t.folder === currentFolder);
    if (currentFolder === "inbox") {
      threads = threads.filter((t) => t.category === currentCategory);
    }
    if (filter === "unread") threads = threads.filter((t) => t.unreadCount > 0);
    if (filter === "starred") threads = threads.filter((t) => t.isStarred);
    if (activeTagFilter) threads = threads.filter((t) => t.tagIds.includes(activeTagFilter));

    return threads.sort(
      (a, b) => new Date(b.latestEmail.date).getTime() - new Date(a.latestEmail.date).getTime()
    );
  },

  getThread: (id) => {
    const { emails } = get();
    const grp = emails.filter((e) => e.threadId === id);
    if (!grp.length) return undefined;
    return buildThread(id, grp);
  },

  unreadCount: (folder, category) => {
    const { emails } = get();
    // Count unread threads (not emails) — matches Gmail-style badge numbers
    const threadsSeen = new Set<string>();
    const threadsUnread = new Set<string>();
    emails
      .filter((e) => e.folder === folder && (category ? e.category === category : true))
      .forEach((e) => {
        threadsSeen.add(e.threadId);
        if (!e.read) threadsUnread.add(e.threadId);
      });
    return threadsUnread.size;
  },

  selectThread: (id) =>
    set((state) => {
      if (!id) return { selectedThreadId: null };
      // Mark all emails in thread as read
      const updatedEmails = state.emails.map((e) =>
        e.threadId === id ? { ...e, read: true } : e
      );
      return { selectedThreadId: id, emails: updatedEmails };
    }),

  setFolder: (folder) =>
    set({ currentFolder: folder, selectedThreadId: null, filter: "all", activeTagFilter: null }),

  setCategory: (category) =>
    set({ currentCategory: category, selectedThreadId: null, filter: "all" }),

  setFilter: (filter) => set({ filter }),

  setTagFilter: (tagId) => set({ activeTagFilter: tagId, selectedThreadId: null }),

  toggleStarThread: (threadId) =>
    set((state) => {
      const inThread = state.emails.filter((e) => e.threadId === threadId);
      const allStarred = inThread.every((e) => e.starred);
      return {
        emails: state.emails.map((e) =>
          e.threadId === threadId ? { ...e, starred: !allStarred } : e
        ),
      };
    }),

  markThreadRead: (threadId) =>
    set((state) => ({
      emails: state.emails.map((e) =>
        e.threadId === threadId ? { ...e, read: true } : e
      ),
    })),

  markThreadUnread: (threadId) =>
    set((state) => ({
      // Mark only the latest email as unread (Gmail behaviour)
      emails: (() => {
        const latest = state.emails
          .filter((e) => e.threadId === threadId)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
        return state.emails.map((e) =>
          e.id === latest?.id ? { ...e, read: false } : e
        );
      })(),
    })),

  moveThread: (threadId, folder) =>
    set((state) => ({
      emails: state.emails.map((e) => (e.threadId === threadId ? { ...e, folder } : e)),
      selectedThreadId:
        state.selectedThreadId === threadId ? null : state.selectedThreadId,
    })),

  deleteThread: (threadId) =>
    set((state) => ({
      emails: state.emails.map((e) =>
        e.threadId === threadId ? { ...e, folder: "trash" as Folder } : e
      ),
      selectedThreadId:
        state.selectedThreadId === threadId ? null : state.selectedThreadId,
    })),

  addTagToThread: (threadId, tagId) =>
    set((state) => ({
      emails: state.emails.map((e) =>
        e.threadId === threadId && !e.tagIds.includes(tagId)
          ? { ...e, tagIds: [...e.tagIds, tagId] }
          : e
      ),
    })),

  removeTagFromThread: (threadId, tagId) =>
    set((state) => ({
      emails: state.emails.map((e) =>
        e.threadId === threadId ? { ...e, tagIds: e.tagIds.filter((t) => t !== tagId) } : e
      ),
    })),

  replyToThread: (threadId, body) =>
    set((state) => {
      const thread = state.emails.filter((e) => e.threadId === threadId);
      if (!thread.length) return {};

      const original = [...thread].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      )[0];

      // Find the last non-me sender to reply to
      const lastOther = [...thread]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .find((e) => e.from.email !== ME.email);

      const replyEmail: Email = {
        id: `reply-${Date.now()}`,
        threadId,
        from: ME,
        to: lastOther ? [{ name: lastOther.from.name, email: lastOther.from.email }] : original.to,
        subject: original.subject.startsWith("Re:") ? original.subject : `Re: ${original.subject}`,
        preview: body.slice(0, 120),
        body,
        date: new Date().toISOString(),
        read: true,
        starred: false,
        folder: "sent",
        category: original.category,
        tagIds: [],
      };

      return { emails: [...state.emails, replyEmail] };
    }),

  setComposing: (v) => set({ composing: v }),
  setSignature: (sig) => set({ signature: sig }),

  addUserTag: (name, color) =>
    set((state) => {
      const id = name.toLowerCase().replace(/\s+/g, "-");
      if (state.tags.find((t) => t.id === id)) return {};
      const colorMap: Record<string, { bg: string; text: string; dot: string }> = {
        blue:   { bg: "bg-blue-100 dark:bg-blue-950/40",   text: "text-blue-700 dark:text-blue-400",   dot: "bg-blue-500" },
        green:  { bg: "bg-green-100 dark:bg-green-950/40", text: "text-green-700 dark:text-green-400", dot: "bg-green-500" },
        red:    { bg: "bg-red-100 dark:bg-red-950/40",     text: "text-red-700 dark:text-red-400",     dot: "bg-red-500" },
        orange: { bg: "bg-orange-100 dark:bg-orange-950/40", text: "text-orange-700 dark:text-orange-400", dot: "bg-orange-500" },
        purple: { bg: "bg-purple-100 dark:bg-purple-950/40", text: "text-purple-700 dark:text-purple-400", dot: "bg-purple-500" },
        pink:   { bg: "bg-pink-100 dark:bg-pink-950/40",   text: "text-pink-700 dark:text-pink-400",   dot: "bg-pink-500" },
        cyan:   { bg: "bg-cyan-100 dark:bg-cyan-950/40",   text: "text-cyan-700 dark:text-cyan-400",   dot: "bg-cyan-500" },
        yellow: { bg: "bg-yellow-100 dark:bg-yellow-950/40", text: "text-yellow-700 dark:text-yellow-400", dot: "bg-yellow-500" },
      };
      const c = colorMap[color] ?? colorMap.blue;
      return {
        tags: [...state.tags, { id, name, color, bgClass: c.bg, textClass: c.text, dotClass: c.dot }],
      };
    }),
}));
