"use client";

import { create } from "zustand";
import { EMAILS, type Email, type Folder, type Category } from "@/data/emails";
import { TAGS, type Tag } from "@/data/tags";

type Filter = "all" | "unread" | "starred";

interface EmailStore {
  // Data
  emails: Email[];
  tags: Tag[];
  // Selection
  selectedEmailId: string | null;
  // Navigation
  currentFolder: Folder;
  currentCategory: Category;
  // Filtering
  filter: Filter;
  activeTagFilter: string | null;
  // UI
  composing: boolean;
  // Derived
  visibleEmails: () => Email[];
  unreadCount: (folder: Folder, category?: Category) => number;
  // Actions
  selectEmail: (id: string | null) => void;
  setFolder: (folder: Folder) => void;
  setCategory: (category: Category) => void;
  setFilter: (filter: Filter) => void;
  setTagFilter: (tagId: string | null) => void;
  toggleStar: (id: string) => void;
  markRead: (id: string) => void;
  markUnread: (id: string) => void;
  moveToFolder: (id: string, folder: Folder) => void;
  addTag: (emailId: string, tagId: string) => void;
  removeTag: (emailId: string, tagId: string) => void;
  setComposing: (v: boolean) => void;
  deleteEmail: (id: string) => void;
  addUserTag: (name: string, color: string) => void;
}

export const useEmailStore = create<EmailStore>((set, get) => ({
  emails: EMAILS,
  tags: TAGS,
  selectedEmailId: null,
  currentFolder: "inbox",
  currentCategory: "primary",
  filter: "all",
  activeTagFilter: null,
  composing: false,

  visibleEmails: () => {
    const { emails, currentFolder, currentCategory, filter, activeTagFilter } = get();
    let list = emails.filter((e) => e.folder === currentFolder);

    if (currentFolder === "inbox") {
      list = list.filter((e) => e.category === currentCategory);
    }

    if (filter === "unread") list = list.filter((e) => !e.read);
    if (filter === "starred") list = list.filter((e) => e.starred);
    if (activeTagFilter) list = list.filter((e) => e.tagIds.includes(activeTagFilter));

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  unreadCount: (folder, category) => {
    const { emails } = get();
    return emails.filter(
      (e) =>
        e.folder === folder &&
        !e.read &&
        (category ? e.category === category : true)
    ).length;
  },

  selectEmail: (id) =>
    set((state) => {
      if (!id) return { selectedEmailId: null };
      const updatedEmails = state.emails.map((e) =>
        e.id === id ? { ...e, read: true } : e
      );
      return { selectedEmailId: id, emails: updatedEmails };
    }),

  setFolder: (folder) =>
    set({ currentFolder: folder, selectedEmailId: null, filter: "all", activeTagFilter: null }),

  setCategory: (category) =>
    set({ currentCategory: category, selectedEmailId: null, filter: "all" }),

  setFilter: (filter) => set({ filter }),

  setTagFilter: (tagId) => set({ activeTagFilter: tagId, selectedEmailId: null }),

  toggleStar: (id) =>
    set((state) => ({
      emails: state.emails.map((e) =>
        e.id === id ? { ...e, starred: !e.starred } : e
      ),
    })),

  markRead: (id) =>
    set((state) => ({
      emails: state.emails.map((e) => (e.id === id ? { ...e, read: true } : e)),
    })),

  markUnread: (id) =>
    set((state) => ({
      emails: state.emails.map((e) => (e.id === id ? { ...e, read: false } : e)),
    })),

  moveToFolder: (id, folder) =>
    set((state) => ({
      emails: state.emails.map((e) => (e.id === id ? { ...e, folder } : e)),
      selectedEmailId: state.selectedEmailId === id ? null : state.selectedEmailId,
    })),

  addTag: (emailId, tagId) =>
    set((state) => ({
      emails: state.emails.map((e) =>
        e.id === emailId && !e.tagIds.includes(tagId)
          ? { ...e, tagIds: [...e.tagIds, tagId] }
          : e
      ),
    })),

  removeTag: (emailId, tagId) =>
    set((state) => ({
      emails: state.emails.map((e) =>
        e.id === emailId ? { ...e, tagIds: e.tagIds.filter((t) => t !== tagId) } : e
      ),
    })),

  setComposing: (v) => set({ composing: v }),

  deleteEmail: (id) =>
    set((state) => {
      const email = state.emails.find((e) => e.id === id);
      if (!email) return {};
      const updatedEmails = state.emails.map((e) =>
        e.id === id ? { ...e, folder: "trash" as Folder } : e
      );
      return {
        emails: updatedEmails,
        selectedEmailId: state.selectedEmailId === id ? null : state.selectedEmailId,
      };
    }),

  addUserTag: (name, color) =>
    set((state) => {
      const id = name.toLowerCase().replace(/\s+/g, "-");
      if (state.tags.find((t) => t.id === id)) return {};
      const colorMap: Record<string, { bg: string; text: string; dot: string }> = {
        blue: { bg: "bg-blue-100 dark:bg-blue-950/40", text: "text-blue-700 dark:text-blue-400", dot: "bg-blue-500" },
        green: { bg: "bg-green-100 dark:bg-green-950/40", text: "text-green-700 dark:text-green-400", dot: "bg-green-500" },
        red: { bg: "bg-red-100 dark:bg-red-950/40", text: "text-red-700 dark:text-red-400", dot: "bg-red-500" },
        orange: { bg: "bg-orange-100 dark:bg-orange-950/40", text: "text-orange-700 dark:text-orange-400", dot: "bg-orange-500" },
        purple: { bg: "bg-purple-100 dark:bg-purple-950/40", text: "text-purple-700 dark:text-purple-400", dot: "bg-purple-500" },
        pink: { bg: "bg-pink-100 dark:bg-pink-950/40", text: "text-pink-700 dark:text-pink-400", dot: "bg-pink-500" },
        cyan: { bg: "bg-cyan-100 dark:bg-cyan-950/40", text: "text-cyan-700 dark:text-cyan-400", dot: "bg-cyan-500" },
        yellow: { bg: "bg-yellow-100 dark:bg-yellow-950/40", text: "text-yellow-700 dark:text-yellow-400", dot: "bg-yellow-500" },
      };
      const c = colorMap[color] ?? colorMap.blue;
      return {
        tags: [
          ...state.tags,
          { id, name, color, bgClass: c.bg, textClass: c.text, dotClass: c.dot },
        ],
      };
    }),
}));
