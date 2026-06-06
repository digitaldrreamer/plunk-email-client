#!/usr/bin/env tsx
/**
 * Isolated AI smoke-test — no server, no DB, no auth required.
 * Calls mistral.ts functions directly with sample data.
 *
 * Usage:
 *   npx tsx scripts/test-ai.ts                  # run all three
 *   npx tsx scripts/test-ai.ts categorize
 *   npx tsx scripts/test-ai.ts spell
 *   npx tsx scripts/test-ai.ts compose
 *
 * Overrides (apply to whichever function you're running):
 *   --subject "Your invoice is ready"
 *   --body    "Plain-text email body…"
 *   --html    "<p>Helo wrold</p>"
 *   --instruction "Write a polite decline"
 */

import "dotenv/config";
import { categorizeEmail, fixEmailSpelling, composeFromThread } from "../src/lib/mistral";

// ── CLI helpers ───────────────────────────────────────────────────────────────

function arg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}

const cmd = process.argv[2]; // categorize | spell | compose | undefined

// ── Samples ───────────────────────────────────────────────────────────────────

const SAMPLE = {
  // Ambiguous: looks like a legitimate security alert but has phishing signals
  // (mismatched urgency, vague sender). Should the model catch it?
  categorize: {
    subject: arg("--subject") ?? "[Action Required] Unusual sign-in detected on your account — verify now",
    body: arg("--body") ?? `We noticed a sign-in to your account from an unrecognized device in Lagos, Nigeria on June 5, 2026 at 03:14 AM UTC.

If this was you, no action is needed.

If you did NOT authorize this sign-in, your account may be compromised. Click the link below immediately to secure your account and reset your credentials:

http://secure-account-verify.net/reset?token=a8f2c1d9e3b74f6a

This link expires in 30 minutes. If you ignore this message, your account access may be suspended.

— The Security Team`,
    tags: [
      { id: "work", name: "Work" },
      { id: "finance", name: "Finance" },
      { id: "important", name: "Important" },
      { id: "legal", name: "Legal" },
    ],
  },

  // HTML with: technical terms (OAuth, API, JWT), a code block that must survive
  // untouched, intentional informal language (gonna, kinda), and real typos mixed in
  spell: {
    html: arg("--html") ?? `<p>Hey Marcus,</p>
<p>Just wanted to follw up on the OAuth 2.0 intergration we discused. I'm gonna need the API keys by Thurdsay — the JWT expiry issuse is kinda blocking are whole pipeline.</p>
<p>Here's the enpoint we're hitting:</p>
<pre><code>POST /api/v2/auth/tokn
Content-Type: application/json

{ "grant_type": "client_credentails" }</code></pre>
<p>The error we're recieving is a 401 even when the scopes look corect. Coud you double-check the cliant secret hashing on you're end?</p>
<p>Thx,<br>Dev Team</p>`,
  },

  // 5-message contract negotiation thread with overlapping concerns from three parties
  compose: {
    subject: arg("--subject") ?? "Re: Re: Re: Re: SaaS MSA — final terms before signing",
    messages: [
      {
        from: "legal@partnercorp.com",
        date: "2026-05-28",
        body: "We've reviewed the MSA draft. We're comfortable with sections 1–7 but need modifications to the liability cap (section 8.2) and the data residency clause (section 11). Our standard position is liability capped at 3 months of fees, not 12.",
      },
      {
        from: "me@reclear.io",
        date: "2026-05-29",
        body: "Thanks for the review. We can meet at 6 months on the liability cap but 3 months is too low given the integration complexity. On data residency we're flexible — EU-only or US + EU both work for us.",
      },
      {
        from: "legal@partnercorp.com",
        date: "2026-05-30",
        body: "6 months is workable. On data residency our DPO has now confirmed EU-only is required. One new item: we need a 90-day termination-for-convenience clause added; currently the draft only has termination-for-cause.",
      },
      {
        from: "cfo@partnercorp.com",
        date: "2026-06-02",
        body: "Jumping in — finance also needs net-60 payment terms. Current draft says net-30. This is a hard requirement from our AP team.",
      },
      {
        from: "me@reclear.io",
        date: "2026-06-03",
        body: "Got it. We're aligned on EU-only residency and 6-month liability cap. I'll need to check internally on the 90-day termination and net-60 — those weren't in the original scope.",
      },
    ],
    instruction: arg("--instruction") ?? "Come back with our position: accept 90-day termination-for-convenience, counter net-60 with net-45 as a compromise, and confirm we'll have a redlined draft to them by end of week",
    senderName: "Demo User",
    senderEmail: "me@reclear.io",
  },
};

// ── Runners ───────────────────────────────────────────────────────────────────

async function runCategorize() {
  const { subject, body, tags } = SAMPLE.categorize;
  console.log("\n━━ categorizeEmail ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  subject :", subject);
  console.log("  body    :", body.slice(0, 80) + (body.length > 80 ? "…" : ""));
  console.log("  tags    :", tags.map((t) => t.id).join(", "));
  console.log();

  const result = await categorizeEmail(subject, body, tags);

  console.log("  category      :", result.category);
  console.log("  folder        :", result.folder);
  console.log("  matchedTagIds :", result.matchedTagIds.join(", ") || "(none)");
  console.log("  newTags       :", result.newTags.length ? JSON.stringify(result.newTags) : "(none)");
  console.log("  confidence    :", result.confidence);
}

async function runSpell() {
  const { html } = SAMPLE.spell;
  console.log("\n━━ fixEmailSpelling ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  input :", html);
  console.log();

  const result = await fixEmailSpelling(html);

  console.log("  corrected   :", result.corrected);
  console.log("  changeCount :", result.changeCount);
  if (result.changes.length > 0) {
    console.log("  changes:");
    for (const c of result.changes) {
      console.log(`    "${c.original}" → "${c.fixed}"`);
    }
  }
}

async function runCompose() {
  const { subject, messages, instruction, senderName, senderEmail } = SAMPLE.compose;
  console.log("\n━━ composeFromThread ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  subject     :", subject);
  console.log("  messages    :", messages.length);
  console.log("  instruction :", instruction);
  console.log();

  const result = await composeFromThread({ subject, messages }, instruction, senderName, senderEmail);

  console.log("  subject :", result.subject);
  console.log("  body    :\n");
  console.log(result.body);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.MISTRAL_API_KEY) {
    console.error("✗  MISTRAL_API_KEY not set — add it to backend/.env");
    process.exit(1);
  }

  const run: Record<string, () => Promise<void>> = {
    categorize: runCategorize,
    spell: runSpell,
    compose: runCompose,
  };

  const targets = cmd && run[cmd] ? [cmd] : ["categorize", "spell", "compose"];

  for (const name of targets) {
    try {
      await run[name]();
    } catch (err) {
      console.error(`\n✗  ${name} failed:`, (err as Error).message);
      process.exitCode = 1;
    }
  }

  console.log();
}

main();
