import { eq, or, ilike } from "drizzle-orm";
import { db } from "../db";
import { contacts } from "../db/schema";
import { searchPlunkContacts, upsertPlunkContact } from "./plunk";

export interface Contact {
  id: string;
  email: string;
  name: string;
  subscribed: boolean;
  bounced: boolean;
  complained: boolean;
  lastSeenAt?: string;
  createdAt: string;
}

function rowToContact(row: typeof contacts.$inferSelect): Contact {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    subscribed: row.subscribed,
    bounced: row.bounced,
    complained: row.complained,
    lastSeenAt: row.lastSeenAt ?? undefined,
    createdAt: row.createdAt,
  };
}

export async function upsertContact(email: string, name = ""): Promise<void> {
  const normalised = email.toLowerCase().trim();
  const now = new Date().toISOString();

  const [existing] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(eq(contacts.email, normalised))
    .limit(1);

  if (existing) {
    await db.update(contacts)
      .set({
        ...(name && { name }),
        lastSeenAt: now,
      })
      .where(eq(contacts.id, existing.id));
  } else {
    const id = `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    await db.insert(contacts).values({
      id,
      email: normalised,
      name,
      subscribed: true,
      bounced: false,
      complained: false,
      lastSeenAt: now,
      createdAt: now,
    });

    // Mirror to Plunk async
    setImmediate(() => upsertPlunkContact(normalised, name ? { name } : undefined).catch(() => null));
  }
}

export async function markContactBounced(email: string): Promise<void> {
  await db.update(contacts)
    .set({ bounced: true, subscribed: false })
    .where(eq(contacts.email, email.toLowerCase()));
}

export async function markContactComplained(email: string): Promise<void> {
  await db.update(contacts)
    .set({ complained: true, subscribed: false })
    .where(eq(contacts.email, email.toLowerCase()));
}

export async function searchContacts(query: string): Promise<Contact[]> {
  const q = query.trim();
  if (!q) return [];

  // Try Plunk first (has the full list including contacts we've never locally stored)
  const plunkResults = await searchPlunkContacts(q, 8);
  if (plunkResults.length > 0) {
    return plunkResults.map((p) => ({
      id: p.id,
      email: p.email,
      name: String(p.data?.name ?? p.data?.firstName ?? ""),
      subscribed: p.subscribed,
      bounced: false,
      complained: false,
      createdAt: p.createdAt,
    }));
  }

  // Fall back to local DB
  const rows = await db
    .select()
    .from(contacts)
    .where(or(ilike(contacts.email, `%${q}%`), ilike(contacts.name, `%${q}%`)))
    .limit(8);

  return rows.map(rowToContact);
}

export async function getContactByEmail(email: string): Promise<Contact | undefined> {
  const [row] = await db
    .select()
    .from(contacts)
    .where(eq(contacts.email, email.toLowerCase()))
    .limit(1);
  return row ? rowToContact(row) : undefined;
}
