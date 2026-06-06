export type Folder = "inbox" | "sent" | "drafts" | "archive" | "spam" | "trash";
export type Category = "primary" | "internal" | "notifications" | "newsletter" | "dangerous";

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

export interface Email {
  id: string;
  threadId: string;
  from: Contact;
  to: Contact[];
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
  hasAttachments?: boolean;
  threatUrls?: string[];
  deliveryStatus?: string;
  openCount?: number;
  clickCount?: number;
  deliveredAt?: string;
  firstOpenedAt?: string;
  firstClickedAt?: string;
  bouncedAt?: string;
}
