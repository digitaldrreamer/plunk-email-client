// Plunk API client — server-side only (uses PLUNK_SECRET_KEY)

const PLUNK_BASE = process.env.PLUNK_API_BASE ?? "https://next-api.useplunk.com";

export interface PlunkAttachment {
  filename: string;
  content: string; // base64-encoded
  mimeType: string;
  contentId?: string;
}

export interface PlunkSendRequest {
  to: string | string[] | { name: string; email: string } | { name: string; email: string }[];
  subject: string;
  body: string; // HTML
  from?: string | { name: string; email: string };
  reply?: string;
  headers?: Record<string, string>;
  attachments?: PlunkAttachment[];
  subscribed?: boolean;
  data?: Record<string, unknown>;
}

export interface PlunkSendResult {
  success: boolean;
  data?: {
    emails: {
      contact: { id: string; email: string };
      email: string; // Plunk email record ID — use to correlate with webhook event.emailId
    }[];
    timestamp: string;
  };
  error?: string;
}

export interface PlunkContact {
  id: string;
  email: string;
  subscribed: boolean;
  data: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export async function sendEmail(req: PlunkSendRequest): Promise<PlunkSendResult> {
  const apiKey = process.env.PLUNK_SECRET_KEY;
  if (!apiKey) throw new Error("PLUNK_SECRET_KEY is not set");

  const from = req.from ?? process.env.PLUNK_FROM_EMAIL ?? "noreply@team.reclear.io";

  const body = {
    to: req.to,
    subject: req.subject,
    body: req.body,
    from,
    ...(req.reply && { reply: req.reply }),
    ...(req.headers && { headers: req.headers }),
    ...(req.attachments?.length && { attachments: req.attachments }),
    ...(req.subscribed !== undefined && { subscribed: req.subscribed }),
    ...(req.data && { data: req.data }),
  };

  let attempt = 0;
  const maxAttempts = 3;
  let lastError = "";

  while (attempt < maxAttempts) {
    attempt++;
    try {
      const res = await fetch(`${PLUNK_BASE}/v1/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

      const json = (await res.json()) as PlunkSendResult;

      if (res.ok) return json;
      if (res.status < 500) return { success: false, error: `Plunk ${res.status}` };
      lastError = `Plunk ${res.status}`;
    } catch (err) {
      lastError = String(err);
    }

    if (attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, attempt * 1000));
    }
  }

  return { success: false, error: lastError };
}

// ── Plunk contacts API ────────────────────────────────────────────────────────

export async function searchPlunkContacts(query: string, limit = 8): Promise<PlunkContact[]> {
  const apiKey = process.env.PLUNK_SECRET_KEY;
  if (!apiKey) return [];

  try {
    const params = new URLSearchParams({ search: query, limit: String(limit) });
    const res = await fetch(`${PLUNK_BASE}/contacts?${params}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return [];
    const json = await res.json() as { data?: PlunkContact[] };
    return json.data ?? [];
  } catch {
    return [];
  }
}

export async function upsertPlunkContact(
  email: string,
  data?: Record<string, unknown>
): Promise<void> {
  const apiKey = process.env.PLUNK_SECRET_KEY;
  if (!apiKey) return;

  try {
    await fetch(`${PLUNK_BASE}/contacts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ email, ...(data ? { data } : {}), subscribed: true }),
    });
  } catch {
    // best-effort — don't fail the main flow
  }
}
