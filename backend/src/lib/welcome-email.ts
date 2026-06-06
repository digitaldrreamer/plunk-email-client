import crypto from "crypto";
import { addEmail } from "./store";

const FROM_EMAIL = process.env.PLUNK_FROM_EMAIL ?? "notifications@teams.reclear.io";
const FROM_NAME  = "Reclear";

/**
 * Insert a welcome email directly into the DB so it appears in the inbox
 * when the new user logs in for the first time. No Plunk delivery needed.
 */
export async function seedWelcomeEmail(to: { name: string; email: string }): Promise<void> {
  const id        = crypto.randomUUID();
  const messageId = `welcome-${id}@reclear.internal`;
  const now       = new Date().toISOString();

  const body = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;color:#111827;">

  <h1 style="font-size:22px;font-weight:700;margin-bottom:4px;">Welcome to Reclear, ${to.name.split(" ")[0]} 👋</h1>
  <p style="color:#6b7280;margin-top:0;font-size:15px;">Your mailbox is ready. Here's a quick guide to get you up to speed.</p>

  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">

  <h2 style="font-size:15px;font-weight:600;margin-bottom:12px;">Your mailbox address</h2>
  <p style="margin:0;">Your email address is <strong>${to.email}</strong>. Use it like any other email — send and receive, reply to threads, attach files.</p>

  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">

  <h2 style="font-size:15px;font-weight:600;margin-bottom:12px;">Getting around</h2>
  <table style="border-collapse:collapse;width:100%;font-size:14px;">
    <tr>
      <td style="padding:8px 12px 8px 0;vertical-align:top;white-space:nowrap;color:#6b7280;font-weight:500;">Compose</td>
      <td style="padding:8px 0;">Click <strong>Compose</strong> in the sidebar or press <code style="background:#f3f4f6;padding:1px 5px;border-radius:4px;font-size:13px;">C</code> anywhere.</td>
    </tr>
    <tr>
      <td style="padding:8px 12px 8px 0;vertical-align:top;white-space:nowrap;color:#6b7280;font-weight:500;">Command palette</td>
      <td style="padding:8px 0;">Press <code style="background:#f3f4f6;padding:1px 5px;border-radius:4px;font-size:13px;">⌘K</code> (or <code style="background:#f3f4f6;padding:1px 5px;border-radius:4px;font-size:13px;">Ctrl+K</code>) to jump anywhere — folders, compose, settings — without lifting your hands.</td>
    </tr>
    <tr>
      <td style="padding:8px 12px 8px 0;vertical-align:top;white-space:nowrap;color:#6b7280;font-weight:500;">Search</td>
      <td style="padding:8px 0;">Use the search bar at the top of your inbox to filter by subject, sender, or content instantly.</td>
    </tr>
    <tr>
      <td style="padding:8px 12px 8px 0;vertical-align:top;white-space:nowrap;color:#6b7280;font-weight:500;">Quick actions</td>
      <td style="padding:8px 0;">Hover over any email row to archive, trash, or mark it read/unread without opening it.</td>
    </tr>
    <tr>
      <td style="padding:8px 12px 8px 0;vertical-align:top;white-space:nowrap;color:#6b7280;font-weight:500;">Tags</td>
      <td style="padding:8px 0;">Create colour-coded tags from the sidebar and apply them to threads to stay organised.</td>
    </tr>
    <tr>
      <td style="padding:8px 12px 8px 0;vertical-align:top;white-space:nowrap;color:#6b7280;font-weight:500;">Drafts</td>
      <td style="padding:8px 0;">Compose windows auto-save your draft locally. Reopen Compose any time to pick up where you left off.</td>
    </tr>
  </table>

  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">

  <h2 style="font-size:15px;font-weight:600;margin-bottom:12px;">Security tips</h2>
  <ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.8;color:#374151;">
    <li>Set up <strong>two-factor authentication</strong> in Settings → Security. It takes 30 seconds and protects your account.</li>
    <li>Add a <strong>recovery email</strong> in Settings → Profile so you can reset your password if you ever get locked out.</li>
    <li>Reclear flags emails with dangerous URLs automatically — look for the red shield on suspicious threads.</li>
  </ul>

  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">

  <p style="font-size:13px;color:#9ca3af;margin:0;">This is an automated message from Reclear. Reply here or contact your admin if you have questions.</p>
</div>`.trim();

  const preview = `Welcome to Reclear, ${to.name.split(" ")[0]}. Your mailbox is ready — here's a quick guide to get you up to speed.`;

  await addEmail({
    id,
    messageId,
    threadId: id,
    from:     { name: FROM_NAME, email: FROM_EMAIL },
    to:       [to],
    subject:  `Welcome to Reclear, ${to.name.split(" ")[0]} 👋`,
    body,
    preview,
    date:     now,
    folder:   "inbox",
    category: "internal",
    read:     false,
    starred:  false,
    tagIds:   [],
    hasAttachments: false,
    threatUrls:     [],
    deliveryStatus: "delivered",
    openCount:  0,
    clickCount: 0,
  });
}
