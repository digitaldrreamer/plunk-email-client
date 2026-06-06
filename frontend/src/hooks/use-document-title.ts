"use client";

import { useEffect } from "react";
import { useEmailStore } from "@/store/email-store";

const FOLDER_LABELS: Record<string, string> = {
  inbox: "Inbox",
  sent: "Sent",
  drafts: "Drafts",
  archive: "Archive",
  spam: "Spam",
  trash: "Trash",
};

const CATEGORY_LABELS: Record<string, string> = {
  primary: "Primary",
  internal: "Internal",
  notifications: "Notifications",
  newsletter: "Newsletter",
};

export function useDocumentTitle() {
  const { currentFolder, currentCategory, selectedThreadId, getThread } = useEmailStore();

  useEffect(() => {
    let title = "reclear";
    const folderLabel = FOLDER_LABELS[currentFolder] ?? currentFolder;

    if (selectedThreadId) {
      const thread = getThread(selectedThreadId);
      if (thread?.subject) {
        title = `${thread.subject} · ${folderLabel} · reclear`;
      } else {
        title = `${folderLabel} · reclear`;
      }
    } else if (currentFolder === "inbox") {
      title = `${CATEGORY_LABELS[currentCategory] ?? currentCategory} · Inbox · reclear`;
    } else {
      title = `${folderLabel} · reclear`;
    }

    document.title = title;
  }, [currentFolder, currentCategory, selectedThreadId, getThread]);
}
