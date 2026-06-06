import { Mistral } from "@mistralai/mistralai";

const client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY! });
const MODEL = "mistral-small-latest";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CategorizationResult {
  category: "primary" | "social" | "updates" | "promotions" | "forums";
  folder: "inbox" | "spam" | "trash";
  matchedTagIds: string[];   // IDs of existing tags that apply
  newTags: { name: string; color: string }[]; // new tags to create (only if no existing tag fits)
  confidence: number; // 0–1
}

export interface SpellFixResult {
  corrected: string;
  changeCount: number;
  changes: { original: string; fixed: string }[];
}

export interface ComposeResult {
  subject: string;
  body: string; // HTML
}

// ── Existing tag shape passed in by callers ───────────────────────────────────

export interface TagHint {
  id: string;
  name: string;
}

// ── Categorize & tag ─────────────────────────────────────────────────────────

export async function categorizeEmail(
  subject: string,
  bodyText: string, // plain-text excerpt (first 800 chars)
  existingTags: TagHint[]
): Promise<CategorizationResult> {
  const tagList = existingTags.length
    ? existingTags.map((t) => `- id: "${t.id}", name: "${t.name}"`).join("\n")
    : "(none yet)";

  const response = await client.chat.complete({
    model: MODEL,
    messages: [
      {
        role: "system",
        content: `You are an email classification engine. Analyze the email and return ONLY a JSON object — no markdown, no explanation.

Rules:
1. "category": one of "primary", "social", "updates", "promotions", "forums"
   - primary: personal, work, or direct correspondence
   - social: social networks, friend invites
   - updates: receipts, shipping, account alerts, app notifications
   - promotions: marketing, newsletters, offers, discounts
   - forums: mailing lists, GitHub notifications, community digests

2. "folder": use "spam" for ANY of the following — otherwise use "inbox":
   - Phishing signals: suspicious URLs (domain doesn't match the claimed sender), urgency + credential harvesting, mismatched sender identity
   - Known spam patterns: unsolicited bulk offers, lottery/prize scams, advance-fee fraud
   - High-confidence spam regardless of how legitimate it looks

3. "matchedTagIds": array of IDs from the provided existing tags list that genuinely apply. Empty array if none fit well.

4. "newTags": array of { name, color } for brand-new tags ONLY when no existing tag is a reasonable fit. Keep it to 0–2 new tags max. Color must be one of: blue, green, red, orange, purple, pink, cyan, yellow.

5. "confidence": float 0–1 reflecting certainty.

Existing tags:
${tagList}

Return exactly this shape:
{
  "category": "...",
  "folder": "...",
  "matchedTagIds": [],
  "newTags": [],
  "confidence": 0.0
}`,
      },
      {
        role: "user",
        content: `Subject: ${subject}\n\n${bodyText.slice(0, 800)}`,
      },
    ],
    responseFormat: { type: "json_object" },
    temperature: 0.1,
  });

  const raw = response.choices?.[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw));

  return {
    category: parsed.category ?? "primary",
    folder: parsed.folder ?? "inbox",
    matchedTagIds: Array.isArray(parsed.matchedTagIds) ? parsed.matchedTagIds : [],
    newTags: Array.isArray(parsed.newTags) ? parsed.newTags : [],
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
  };
}

// ── Spell / grammar fix ───────────────────────────────────────────────────────

export async function fixEmailSpelling(html: string): Promise<SpellFixResult> {
  const response = await client.chat.complete({
    model: MODEL,
    messages: [
      {
        role: "system",
        content: `You are a precise proofreader. Fix ONLY clear spelling and grammar mistakes in the email body.

Rules:
- Preserve ALL HTML tags exactly as-is — only change visible text content
- NEVER touch content inside <pre>, <code>, <tt>, or <kbd> tags — treat it as literal code
- Fix spelling errors and obvious grammar mistakes in prose text only
- Do NOT rephrase, reword, or change sentence structure
- Do NOT change punctuation style, capitalization style, or tone
- Do NOT fix intentional informal language (gonna, wanna, kinda, etc.)
- If nothing needs fixing, return the input unchanged

Return ONLY a JSON object with this exact shape:
{
  "corrected": "<the full corrected HTML string>",
  "changeCount": <number of fixes made>,
  "changes": [{ "original": "...", "fixed": "..." }]
}`,
      },
      {
        role: "user",
        content: html,
      },
    ],
    responseFormat: { type: "json_object" },
    temperature: 0.0,
  });

  const raw = response.choices?.[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw));

  const changes = Array.isArray(parsed.changes) ? parsed.changes : [];
  return {
    corrected: parsed.corrected ?? html,
    changeCount: changes.length,
    changes,
  };
}

// ── Compose / generate from thread ───────────────────────────────────────────

interface ThreadMessage {
  from: string;
  date: string;
  body: string; // plain text
}

export async function composeFromThread(
  thread: { subject: string; messages: ThreadMessage[] },
  instruction: string,
  senderName: string,
  senderEmail: string
): Promise<ComposeResult> {
  const threadContext = thread.messages
    .slice(-6) // last 6 messages for context
    .map((m) => `[${m.date}] ${m.from}:\n${m.body.slice(0, 600)}`)
    .join("\n\n---\n\n");

  const response = await client.chat.complete({
    model: MODEL,
    messages: [
      {
        role: "system",
        content: `You are a professional email assistant for ${senderName} <${senderEmail}>.
Write a reply or new email based on the conversation thread and the user's instruction.

Requirements:
- Write in a natural, professional tone matching the thread's register
- Be concise — no unnecessary filler phrases or padding
- Do NOT include a subject line in the body
- Format the body as clean HTML using only <p>, <br>, <strong>, <em>, <ul>, <li> tags
- Do NOT wrap in <html>, <head>, or <body> tags

Return ONLY a JSON object with this exact shape:
{
  "subject": "<email subject line>",
  "body": "<HTML body content only>"
}`,
      },
      {
        role: "user",
        content: `Thread subject: "${thread.subject}"\n\nConversation:\n${threadContext}\n\nInstruction: ${instruction}`,
      },
    ],
    responseFormat: { type: "json_object" },
    temperature: 0.4,
  });

  const raw = response.choices?.[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw));

  return {
    subject: parsed.subject ?? thread.subject,
    body: parsed.body ?? "<p></p>",
  };
}
