"use client";

import { create } from "zustand";
import { type Email, type Contact, type Folder, type Category } from "@/data/emails";
import { useAuthStore } from "./auth-store";
import { apiUrl } from "@/lib/api";

// ── Tag type ───────────────────────────────────────────────────────────────────

export interface Tag {
  id: string;
  name: string;
  color: string;
  bgClass: string;
  textClass: string;
  dotClass: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getMe(): Contact {
  const user = useAuthStore.getState().user;
  return { name: user?.name ?? "Me", email: user?.email ?? "" };
}

const COLOR_MAP: Record<string, { bgClass: string; textClass: string; dotClass: string }> = {
  blue:   { bgClass: "bg-blue-100 dark:bg-blue-950/40",   textClass: "text-blue-700 dark:text-blue-400",   dotClass: "bg-blue-500" },
  green:  { bgClass: "bg-green-100 dark:bg-green-950/40", textClass: "text-green-700 dark:text-green-400", dotClass: "bg-green-500" },
  red:    { bgClass: "bg-red-100 dark:bg-red-950/40",     textClass: "text-red-700 dark:text-red-400",     dotClass: "bg-red-500" },
  orange: { bgClass: "bg-orange-100 dark:bg-orange-950/40", textClass: "text-orange-700 dark:text-orange-400", dotClass: "bg-orange-500" },
  purple: { bgClass: "bg-purple-100 dark:bg-purple-950/40", textClass: "text-purple-700 dark:text-purple-400", dotClass: "bg-purple-500" },
  pink:   { bgClass: "bg-pink-100 dark:bg-pink-950/40",   textClass: "text-pink-700 dark:text-pink-400",   dotClass: "bg-pink-500" },
  cyan:   { bgClass: "bg-cyan-100 dark:bg-cyan-950/40",   textClass: "text-cyan-700 dark:text-cyan-400",   dotClass: "bg-cyan-500" },
  yellow: { bgClass: "bg-yellow-100 dark:bg-yellow-950/40", textClass: "text-yellow-700 dark:text-yellow-400", dotClass: "bg-yellow-500" },
};

function colorToClasses(color: string) {
  return COLOR_MAP[color] ?? COLOR_MAP.blue;
}

async function apiReq(path: string, opts: RequestInit = {}) {
  return fetch(apiUrl(path), {
    ...opts,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...((opts.headers as Record<string, string>) ?? {}),
    },
  });
}

// ── Thread type ────────────────────────────────────────────────────────────────

export interface Thread {
  id: string;
  subject: string;
  emails: Email[];
  latestEmail: Email;
  participants: Contact[];
  unreadCount: number;
  isStarred: boolean;
  folder: Folder;
  category: Category;
  tagIds: string[];
  threatUrls: string[];
  deliveryStatus?: string;
  openCount: number;
  clickCount: number;
}

function buildThread(threadId: string, emails: Email[]): Thread {
  const sorted = [...emails].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const latestEmail = sorted[sorted.length - 1];

  const anchors = sorted.filter((e) => e.folder !== "sent" && e.folder !== "drafts");
  const anchor = anchors[anchors.length - 1] ?? sorted[0];

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

// ── Store ──────────────────────────────────────────────────────────────────────

type Filter = "all" | "unread" | "starred";

interface EmailStore {
  emails: Email[];
  tags: Tag[];
  loading: boolean;
  selectedThreadId: string | null;
  currentFolder: Folder;
  activeCategories: Category[];
  filter: Filter;
  activeTagFilter: string | null;
  composing: boolean;
  composeDraft: { id: string; to: string[]; subject: string; body: string } | null;
  signature: string;

  // API
  loadEmails: () => Promise<void>;
  loadTags: () => Promise<void>;
  getTagById: (id: string) => Tag | undefined;

  // Derived
  visibleThreads: () => Thread[];
  getThread: (id: string) => Thread | undefined;
  unreadCount: (folder: Folder, category?: Category) => number;

  // Navigation
  selectThread: (id: string | null) => void;
  setFolder: (folder: Folder) => void;
  toggleCategory: (category: Category) => void;
  setFilter: (filter: Filter) => void;
  setTagFilter: (tagId: string | null) => void;

  // Mutations (optimistic + API-backed)
  toggleStarThread: (threadId: string) => Promise<void>;
  markThreadRead: (threadId: string) => Promise<void>;
  markThreadUnread: (threadId: string) => Promise<void>;
  moveThread: (threadId: string, folder: Folder) => Promise<void>;
  deleteThread: (threadId: string) => Promise<void>;
  addTagToThread: (threadId: string, tagId: string) => Promise<void>;
  removeTagFromThread: (threadId: string, tagId: string) => Promise<void>;
  replyToThread: (threadId: string, body: string) => void;

  // UI
  setComposing: (v: boolean) => void;
  openDraft: (draft: { id: string; to: string[]; subject: string; body: string }) => void;
  clearComposeDraft: () => void;
  addUserTag: (name: string, color: string) => Promise<void>;
  setSignature: (sig: string) => void;

  // Real-time
  addEmail: (email: Email) => void;
  patchEmail: (id: string, patch: Partial<Email>) => void;
  removeEmail: (id: string) => void;
}

export const useEmailStore = create<EmailStore>((set, get) => ({
  emails: [],
  tags: [],
  loading: false,
  selectedThreadId: null,
  currentFolder: "inbox",
  activeCategories: ["primary", "internal", "notifications", "newsletter"] as Category[],
  filter: "all",
  activeTagFilter: null,
  composing: false,
  composeDraft: null,
  signature: "<p>—</p>",

  // ── API loading ──────────────────────────────────────────────────────────────

  loadEmails: async () => {
    set({ loading: true });
    try {
      const res = await apiReq("/api/emails");
      const json = await res.json() as { success: boolean; data: Email[] };
      if (json.success) set({ emails: json.data });
    } catch {
      // silently fail — store stays empty
    } finally {
      set({ loading: false });
    }
  },

  loadTags: async () => {
    try {
      const res = await apiReq("/api/tags");
      const raw = await res.json() as { id: string; name: string; color: string }[];
      if (Array.isArray(raw)) {
        set({ tags: raw.map((t) => ({ ...t, ...colorToClasses(t.color) })) });
      }
    } catch {
      // silently fail
    }
  },

  getTagById: (id) => get().tags.find((t) => t.id === id),

  // ── Derived ──────────────────────────────────────────────────────────────────

  visibleThreads: () => {
    const { emails, currentFolder, activeCategories, filter, activeTagFilter } = get();

    const groups = new Map<string, Email[]>();
    for (const email of emails) {
      const group = groups.get(email.threadId) ?? [];
      group.push(email);
      groups.set(email.threadId, group);
    }

    let threads = [...groups.entries()].map(([id, grp]) => buildThread(id, grp));

    threads = threads.filter((t) => t.folder === currentFolder);
    if (currentFolder === "inbox") {
      const active = new Set(activeCategories);
      threads = threads.filter((t) => active.has(t.category));
    }
    if (filter === "unread") threads = threads.filter((t) => t.unreadCount > 0);
    if (filter === "starred") threads = threads.filter((t) => t.isStarred);
    if (activeTagFilter) threads = threads.filter((t) => t.tagIds.includes(activeTagFilter));

    return threads.sort(
      (a, b) => new Date(b.latestEmail.date).getTime() - new Date(a.latestEmail.date).getTime()
    );
  },

  getThread: (id) => {
    const grp = get().emails.filter((e) => e.threadId === id);
    if (!grp.length) return undefined;
    return buildThread(id, grp);
  },

  unreadCount: (folder, category) => {
    const { emails } = get();
    const threadsUnread = new Set<string>();
    emails
      .filter((e) => e.folder === folder && (category ? e.category === category : true))
      .forEach((e) => { if (!e.read) threadsUnread.add(e.threadId); });
    return threadsUnread.size;
  },

  // ── Navigation ───────────────────────────────────────────────────────────────

  selectThread: (id) => {
    if (!id) { set({ selectedThreadId: null }); return; }
    const unread = get().emails.filter((e) => e.threadId === id && !e.read);
    set((state) => ({
      selectedThreadId: id,
      emails: state.emails.map((e) => e.threadId === id ? { ...e, read: true } : e),
    }));
    // Background sync
    Promise.all(
      unread.map((e) => apiReq(`/api/emails/${e.id}/read`, { method: "PATCH", body: JSON.stringify({ read: true }) }))
    ).catch(() => null);
  },

  setFolder: (folder) =>
    set({ currentFolder: folder, selectedThreadId: null, filter: "all", activeTagFilter: null }),

  toggleCategory: (category) =>
    set((state) => {
      const current = state.activeCategories;
      const next = current.includes(category)
        ? current.filter((c) => c !== category)
        : [...current, category];
      return { activeCategories: next.length ? next : current, selectedThreadId: null };
    }),

  setFilter: (filter) => set({ filter }),

  setTagFilter: (tagId) => set({ activeTagFilter: tagId, selectedThreadId: null }),

  // ── Mutations ────────────────────────────────────────────────────────────────

  toggleStarThread: async (threadId) => {
    const inThread = get().emails.filter((e) => e.threadId === threadId);
    const allStarred = inThread.every((e) => e.starred);
    const target = !allStarred;
    set((state) => ({
      emails: state.emails.map((e) => e.threadId === threadId ? { ...e, starred: target } : e),
    }));
    const toToggle = inThread.filter((e) => e.starred !== target);
    await Promise.all(toToggle.map((e) => apiReq(`/api/emails/${e.id}/star`, { method: "PATCH" }))).catch(() => null);
  },

  markThreadRead: async (threadId) => {
    const unread = get().emails.filter((e) => e.threadId === threadId && !e.read);
    set((state) => ({
      emails: state.emails.map((e) => e.threadId === threadId ? { ...e, read: true } : e),
    }));
    await Promise.all(
      unread.map((e) => apiReq(`/api/emails/${e.id}/read`, { method: "PATCH", body: JSON.stringify({ read: true }) }))
    ).catch(() => null);
  },

  markThreadUnread: async (threadId) => {
    const latest = get().emails
      .filter((e) => e.threadId === threadId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    if (!latest) return;
    set((state) => ({
      emails: state.emails.map((e) => e.id === latest.id ? { ...e, read: false } : e),
    }));
    await apiReq(`/api/emails/${latest.id}/read`, { method: "PATCH", body: JSON.stringify({ read: false }) }).catch(() => null);
  },

  moveThread: async (threadId, folder) => {
    const inThread = get().emails.filter((e) => e.threadId === threadId);
    set((state) => ({
      emails: state.emails.map((e) => e.threadId === threadId ? { ...e, folder } : e),
      selectedThreadId: state.selectedThreadId === threadId ? null : state.selectedThreadId,
    }));
    await Promise.all(
      inThread.map((e) => apiReq(`/api/emails/${e.id}/move`, { method: "PATCH", body: JSON.stringify({ folder }) }))
    ).catch(() => null);
  },

  deleteThread: async (threadId) => {
    const inThread = get().emails.filter((e) => e.threadId === threadId);
    set((state) => ({
      emails: state.emails.map((e) => e.threadId === threadId ? { ...e, folder: "trash" as Folder } : e),
      selectedThreadId: state.selectedThreadId === threadId ? null : state.selectedThreadId,
    }));
    await Promise.all(
      inThread.map((e) => apiReq(`/api/emails/${e.id}/move`, { method: "PATCH", body: JSON.stringify({ folder: "trash" }) }))
    ).catch(() => null);
  },

  addTagToThread: async (threadId, tagId) => {
    const inThread = get().emails.filter((e) => e.threadId === threadId);
    set((state) => ({
      emails: state.emails.map((e) =>
        e.threadId === threadId && !e.tagIds.includes(tagId)
          ? { ...e, tagIds: [...e.tagIds, tagId] }
          : e
      ),
    }));
    await Promise.all(
      inThread
        .filter((e) => !e.tagIds.includes(tagId))
        .map((e) => apiReq(`/api/emails/${e.id}/tags`, {
          method: "PATCH",
          body: JSON.stringify({ tagIds: [...e.tagIds, tagId] }),
        }))
    ).catch(() => null);
  },

  removeTagFromThread: async (threadId, tagId) => {
    const inThread = get().emails.filter((e) => e.threadId === threadId);
    set((state) => ({
      emails: state.emails.map((e) =>
        e.threadId === threadId ? { ...e, tagIds: e.tagIds.filter((t) => t !== tagId) } : e
      ),
    }));
    await Promise.all(
      inThread.map((e) => apiReq(`/api/emails/${e.id}/tags`, {
        method: "PATCH",
        body: JSON.stringify({ tagIds: e.tagIds.filter((t) => t !== tagId) }),
      }))
    ).catch(() => null);
  },

  replyToThread: (threadId, body) => {
    set((state) => {
      const thread = state.emails.filter((e) => e.threadId === threadId);
      if (!thread.length) return {};
      const original = [...thread].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      )[0];
      const me = getMe();
      const lastOther = [...thread]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .find((e) => e.from.email !== me.email);

      const replyEmail: Email = {
        id: `reply-${Date.now()}`,
        threadId,
        from: me,
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
    });
  },

  // ── UI ───────────────────────────────────────────────────────────────────────

  setComposing: (v) => set({ composing: v }),
  openDraft: (draft) => set({ composeDraft: draft, composing: true }),
  clearComposeDraft: () => set({ composeDraft: null }),
  setSignature: (sig) => set({ signature: sig }),

  addEmail: (email) => {
    set((state) => {
      if (state.emails.find((e) => e.id === email.id)) return {};
      return { emails: [...state.emails, email] };
    });
  },

  patchEmail: (id, patch) => {
    set((state) => ({
      emails: state.emails.map((e) => e.id === id ? { ...e, ...patch } : e),
    }));
  },

  removeEmail: (id) => {
    set((state) => ({
      emails: state.emails.filter((e) => e.id !== id),
      selectedThreadId: state.selectedThreadId === id ? null : state.selectedThreadId,
    }));
  },

  addUserTag: async (name, color) => {
    const id = name.toLowerCase().replace(/\s+/g, "-");
    if (get().tags.find((t) => t.id === id)) return;
    const classes = colorToClasses(color);
    // Optimistic
    set((state) => ({
      tags: [...state.tags, { id, name, color, ...classes }],
    }));
    try {
      await apiReq("/api/tags", { method: "POST", body: JSON.stringify({ name, color }) });
    } catch {
      // rollback on failure
      set((state) => ({ tags: state.tags.filter((t) => t.id !== id) }));
    }
  },
}));
