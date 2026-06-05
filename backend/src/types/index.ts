export type Folder = "inbox" | "sent" | "drafts" | "archive" | "spam" | "trash";
export type Category = "primary" | "internal" | "notifications" | "newsletter";

export interface Contact {
  name: string;
  email: string;
  avatar?: string;
  verified?: boolean;
}

export interface Attachment {
  id: string;
  name: string;
  size: string;
  type: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface Email {
  id: string;
  from: Contact;
  to: Contact[];
  cc?: Contact[];
  subject: string;
  preview: string;
  body: string;
  date: string;
  read: boolean;
  starred: boolean;
  folder: Folder;
  category: Category;
  tagIds: string[];
  attachments?: Attachment[];
  threadCount?: number;
}
