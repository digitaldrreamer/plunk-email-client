import { pgTable, text, boolean, integer } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  recoveryEmail: text("recovery_email"),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("user"), // "admin" | "user"
  disabled: boolean("disabled").notNull().default(false),
  lastLoginAt: text("last_login_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  // First-login flow
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  // 2FA
  twoFactorSecret: text("two_factor_secret"),
  twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
  // Invite expiry — only enforced while mustChangePassword is still true
  inviteExpiresAt: text("invite_expires_at"),
  // Password reset (admin-triggered)
  resetToken: text("reset_token"),           // SHA-256 hash of the raw token
  resetTokenExpiresAt: text("reset_token_expires_at"),
  twoFactorBackupCodes: text("two_factor_backup_codes"), // JSON array of SHA-256 hashed backup codes
  signature: text("signature"),
});

export const emails = pgTable("emails", {
  id: text("id").primaryKey(),
  messageId: text("message_id").notNull().unique(),
  threadId: text("thread_id").notNull(),
  fromName: text("from_name").notNull(),
  fromEmail: text("from_email").notNull(),
  toJson: text("to_json").notNull().default("[]"),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  preview: text("preview").notNull(),
  date: text("date").notNull(),
  folder: text("folder").notNull().default("inbox"),
  category: text("category").notNull().default("primary"),
  read: boolean("read").notNull().default(false),
  starred: boolean("starred").notNull().default(false),
  tagIds: text("tag_ids").notNull().default("[]"),
  hasAttachments: boolean("has_attachments").notNull().default(false),
  spamScore: integer("spam_score"),
  threatUrls: text("threat_urls").notNull().default("[]"),
  // Delivery tracking (outbound emails only)
  plunkEmailId: text("plunk_email_id"),
  deliveryStatus: text("delivery_status").notNull().default("pending"),
  openCount: integer("open_count").notNull().default(0),
  clickCount: integer("click_count").notNull().default(0),
  deliveredAt: text("delivered_at"),
  firstOpenedAt: text("first_opened_at"),
  firstClickedAt: text("first_clicked_at"),
  bouncedAt: text("bounced_at"),
});

export const tags = pgTable("tags", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull(),
});

export const contacts = pgTable("contacts", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull().default(""),
  subscribed: boolean("subscribed").notNull().default(true),
  bounced: boolean("bounced").notNull().default(false),
  complained: boolean("complained").notNull().default(false),
  lastSeenAt: text("last_seen_at"),
  createdAt: text("created_at").notNull(),
});
