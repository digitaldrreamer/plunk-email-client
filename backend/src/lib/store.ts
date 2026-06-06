import { eq, and, type SQL } from "drizzle-orm";
import { db } from "../db";
import { emails } from "../db/schema";

export interface StoredEmail {
  id: string;
  messageId: string;
  threadId: string;
  from: { name: string; email: string };
  to: { name: string; email: string }[];
  subject: string;
  body: string;
  preview: string;
  date: string;
  folder: string;
  category: string;
  read: boolean;
  starred: boolean;
  tagIds: string[];
  hasAttachments: boolean;
  spamScore?: number;
  threatUrls: string[];
  // Delivery tracking
  plunkEmailId?: string;
  deliveryStatus: string; // pending|sent|delivered|opened|clicked|bounced|complained
  openCount: number;
  clickCount: number;
  deliveredAt?: string;
  firstOpenedAt?: string;
  firstClickedAt?: string;
  bouncedAt?: string;
}

function rowToEmail(row: typeof emails.$inferSelect): StoredEmail {
  return {
    id: row.id,
    messageId: row.messageId,
    threadId: row.threadId,
    from: { name: row.fromName, email: row.fromEmail },
    to: JSON.parse(row.toJson) as { name: string; email: string }[],
    subject: row.subject,
    body: row.body,
    preview: row.preview,
    date: row.date,
    folder: row.folder,
    category: row.category,
    read: row.read,
    starred: row.starred,
    tagIds: JSON.parse(row.tagIds) as string[],
    hasAttachments: row.hasAttachments,
    spamScore: row.spamScore ?? undefined,
    threatUrls: JSON.parse(row.threatUrls) as string[],
    plunkEmailId: row.plunkEmailId ?? undefined,
    deliveryStatus: row.deliveryStatus,
    openCount: row.openCount,
    clickCount: row.clickCount,
    deliveredAt: row.deliveredAt ?? undefined,
    firstOpenedAt: row.firstOpenedAt ?? undefined,
    firstClickedAt: row.firstClickedAt ?? undefined,
    bouncedAt: row.bouncedAt ?? undefined,
  };
}

export async function listEmails(filters: {
  folder?: string;
  category?: string;
  tagId?: string;
  unread?: boolean;
  starred?: boolean;
}): Promise<StoredEmail[]> {
  const conditions: SQL[] = [];
  if (filters.folder) conditions.push(eq(emails.folder, filters.folder));
  if (filters.category) conditions.push(eq(emails.category, filters.category));
  if (filters.unread === true) conditions.push(eq(emails.read, false));
  if (filters.starred === true) conditions.push(eq(emails.starred, true));

  const rows = await db.select().from(emails)
    .where(conditions.length ? and(...conditions) : undefined);

  return rows
    .filter((r) => {
      if (!filters.tagId) return true;
      return (JSON.parse(r.tagIds) as string[]).includes(filters.tagId);
    })
    .map(rowToEmail);
}

export async function getEmail(id: string): Promise<StoredEmail | undefined> {
  const [row] = await db.select().from(emails).where(eq(emails.id, id)).limit(1);
  return row ? rowToEmail(row) : undefined;
}

export async function getEmailByPlunkId(plunkEmailId: string): Promise<StoredEmail | undefined> {
  const [row] = await db.select().from(emails)
    .where(eq(emails.plunkEmailId, plunkEmailId)).limit(1);
  return row ? rowToEmail(row) : undefined;
}

export async function addEmail(email: StoredEmail): Promise<void> {
  const [exists] = await db.select({ id: emails.id }).from(emails)
    .where(eq(emails.messageId, email.messageId)).limit(1);
  if (exists) return;

  await db.insert(emails).values({
    id: email.id,
    messageId: email.messageId,
    threadId: email.threadId,
    fromName: email.from.name,
    fromEmail: email.from.email,
    toJson: JSON.stringify(email.to),
    subject: email.subject,
    body: email.body,
    preview: email.preview,
    date: email.date,
    folder: email.folder,
    category: email.category,
    read: email.read,
    starred: email.starred,
    tagIds: JSON.stringify(email.tagIds),
    hasAttachments: email.hasAttachments,
    spamScore: email.spamScore ?? null,
    threatUrls: JSON.stringify(email.threatUrls),
    plunkEmailId: email.plunkEmailId ?? null,
    deliveryStatus: email.deliveryStatus,
    openCount: email.openCount,
    clickCount: email.clickCount,
    deliveredAt: email.deliveredAt ?? null,
    firstOpenedAt: email.firstOpenedAt ?? null,
    firstClickedAt: email.firstClickedAt ?? null,
    bouncedAt: email.bouncedAt ?? null,
  });
}

export async function updateEmail(id: string, patch: Partial<StoredEmail>): Promise<StoredEmail | undefined> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.folder !== undefined) dbPatch.folder = patch.folder;
  if (patch.category !== undefined) dbPatch.category = patch.category;
  if (patch.read !== undefined) dbPatch.read = patch.read;
  if (patch.starred !== undefined) dbPatch.starred = patch.starred;
  if (patch.tagIds !== undefined) dbPatch.tagIds = JSON.stringify(patch.tagIds);
  if (patch.hasAttachments !== undefined) dbPatch.hasAttachments = patch.hasAttachments;
  if (patch.threatUrls !== undefined) dbPatch.threatUrls = JSON.stringify(patch.threatUrls);
  if (patch.deliveryStatus !== undefined) dbPatch.deliveryStatus = patch.deliveryStatus;
  if (patch.openCount !== undefined) dbPatch.openCount = patch.openCount;
  if (patch.clickCount !== undefined) dbPatch.clickCount = patch.clickCount;
  if (patch.deliveredAt !== undefined) dbPatch.deliveredAt = patch.deliveredAt;
  if (patch.firstOpenedAt !== undefined) dbPatch.firstOpenedAt = patch.firstOpenedAt;
  if (patch.firstClickedAt !== undefined) dbPatch.firstClickedAt = patch.firstClickedAt;
  if (patch.bouncedAt !== undefined) dbPatch.bouncedAt = patch.bouncedAt;

  if (!Object.keys(dbPatch).length) return getEmail(id);

  await db.update(emails).set(dbPatch).where(eq(emails.id, id));
  return getEmail(id);
}

export async function updateEmailByPlunkId(
  plunkEmailId: string,
  patch: Partial<StoredEmail>
): Promise<void> {
  const email = await getEmailByPlunkId(plunkEmailId);
  if (email) await updateEmail(email.id, patch);
}

export async function deleteEmail(id: string): Promise<boolean> {
  const [exists] = await db.select({ id: emails.id }).from(emails).where(eq(emails.id, id)).limit(1);
  if (!exists) return false;
  await db.delete(emails).where(eq(emails.id, id));
  return true;
}
