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
  threadId: string; // groups emails into a conversation
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
  threatUrls?: string[];
  // Delivery tracking — populated for outbound emails only
  deliveryStatus?: string;
  openCount?: number;
  clickCount?: number;
  deliveredAt?: string;
  firstOpenedAt?: string;
  firstClickedAt?: string;
  bouncedAt?: string;
}

export const ME: Contact = { name: "Me", email: "me@reclear.io" };

const now = new Date();
const d = (offsetDays: number, hours = 10, mins = 0) => {
  const date = new Date(now);
  date.setDate(date.getDate() - offsetDays);
  date.setHours(hours, mins, 0, 0);
  return date.toISOString();
};

export const EMAILS: Email[] = [
  // ── Thread: t-budget (3 messages) ───────────────────
  {
    id: "e1",
    threadId: "t-budget",
    from: { name: "Sarah Chen", email: "sarah.chen@acme.com", verified: true },
    to: [ME],
    subject: "Q4 Budget Review — numbers look tight",
    preview: "Hey, I went through the spreadsheet you sent and a few line items need discussion before we sign off.",
    body: `Hey,

I went through the spreadsheet you sent over and a few line items need discussion before we sign off on this quarter.

Marketing spend is 18% over projection, and the engineering tooling budget has absorbed some surprises. I'd like to schedule a 30-min sync this week to align on adjustments.

Does Thursday 2pm work for you? I'll create the invite once you confirm.

— Sarah`,
    date: d(0, 9, 15),
    read: false,
    starred: true,
    folder: "inbox",
    category: "primary",
    tagIds: ["work", "finance"],
  },
  {
    id: "e1b",
    threadId: "t-budget",
    from: ME,
    to: [{ name: "Sarah Chen", email: "sarah.chen@acme.com" }],
    subject: "Re: Q4 Budget Review — numbers look tight",
    preview: "Thursday 2pm works great. I'll prepare a summary of the over-spend line items beforehand.",
    body: `Hi Sarah,

Thursday 2pm works great. I'll prepare a summary of the over-spend line items beforehand so we can move quickly.

Talk soon,
Me`,
    date: d(0, 9, 45),
    read: true,
    starred: false,
    folder: "sent",
    category: "primary",
    tagIds: ["work", "finance"],
  },
  {
    id: "e1c",
    threadId: "t-budget",
    from: { name: "Sarah Chen", email: "sarah.chen@acme.com", verified: true },
    to: [ME],
    subject: "Re: Q4 Budget Review — numbers look tight",
    preview: "Perfect, Thursday 2pm confirmed. I'll also pull together the marketing variance report beforehand.",
    body: `Great, confirmed for Thursday 2pm.

I'll also pull together the marketing variance report so we have everything in one place. I think once we see the full picture it'll be easier to agree on where to adjust.

Also — do you want to loop in finance? Their sign-off will be needed if we're moving budget between departments.

See you Thursday,
Sarah`,
    date: d(0, 14, 30),
    read: false,
    starred: false,
    folder: "inbox",
    category: "primary",
    tagIds: ["work", "finance"],
  },

  // ── Thread: t-brand (2 messages) ────────────────────
  {
    id: "e2",
    threadId: "t-brand",
    from: { name: "Marcus Webb", email: "marcus@webb.design" },
    to: [ME],
    subject: "Brand refresh — final assets attached",
    preview: "All the files are exported and ready. Let me know if you need different formats.",
    body: `Hi,

The brand refresh is done. I've attached the full asset pack — logo variants (SVG + PNG), colour tokens as CSS variables, and the updated icon set.

Key changes from v1:
• Wordmark tightened by 8%, better readability at small sizes
• Neutral palette shifted slightly warmer
• New secondary accent: #6366f1 (indigo-500)

Let me know if you need Figma source files or anything exported differently.

Cheers,
Marcus`,
    date: d(1, 14, 30),
    read: false,
    starred: false,
    folder: "inbox",
    category: "primary",
    tagIds: ["design", "work"],
    attachments: [
      { id: "a1", name: "brand-assets-v2.zip", size: "18.4 MB", type: "application/zip" },
      { id: "a2", name: "colour-tokens.css", size: "4 KB", type: "text/css" },
    ],
  },
  {
    id: "e2b",
    threadId: "t-brand",
    from: ME,
    to: [{ name: "Marcus Webb", email: "marcus@webb.design" }],
    subject: "Re: Brand refresh — final assets attached",
    preview: "These look great! The indigo accent is a big improvement. Sharing with the team today.",
    body: `Hey Marcus,

These look great! The indigo accent is a big improvement over the old blue — much more distinct. Wordmark change is subtle but you can feel it at small sizes.

I'll share the asset pack with the team today and come back if anyone has questions. Should be good to go.

Thanks!`,
    date: d(1, 17, 10),
    read: true,
    starred: false,
    folder: "sent",
    category: "primary",
    tagIds: ["design", "work"],
  },

  // ── Thread: t-nda (single) ───────────────────────────
  {
    id: "e3",
    threadId: "t-nda",
    from: { name: "Priya Nair", email: "priya.nair@legalteam.io", verified: true },
    to: [ME],
    subject: "NDA — please review and sign by Friday",
    preview: "Attached is the updated NDA. We've incorporated all the changes discussed last week.",
    body: `Hi,

Please find attached the updated NDA incorporating all the changes we discussed on the call last week, specifically around the mutual confidentiality clause and the 2-year non-compete carve-out.

The deadline for signature is this Friday EOD. You can sign electronically via DocuSign — I'll send the link separately once you confirm you've reviewed the document.

Let me know if you have any questions.

Best,
Priya`,
    date: d(2, 11, 0),
    read: true,
    starred: false,
    folder: "inbox",
    category: "primary",
    tagIds: ["legal", "important"],
    attachments: [
      { id: "a3", name: "NDA-v3-final.pdf", size: "256 KB", type: "application/pdf" },
    ],
  },

  // ── Thread: t-trip (3 messages) ─────────────────────
  {
    id: "e4",
    threadId: "t-trip",
    from: { name: "Tomás Rivera", email: "tomas@product.co" },
    to: [ME],
    subject: "Weekend trip — confirming dates",
    preview: "I've booked the cabin for the 15th–17th. Are you still able to make it?",
    body: `Hey!

Cabin is booked for the 15th–17th. Cost is split 4 ways — I'll send you a payment link for your share (~$85).

The drive is about 3 hrs. If you can be ready by 9am Friday we should beat the traffic. Let me know if you'd rather carpool or drive separately.

Packing list is in the shared doc — I'll drop the link in the group chat.

See you there!
Tomás`,
    date: d(3, 18, 45),
    read: true,
    starred: true,
    folder: "inbox",
    category: "primary",
    tagIds: ["personal", "travel"],
  },
  {
    id: "e4b",
    threadId: "t-trip",
    from: ME,
    to: [{ name: "Tomás Rivera", email: "tomas@product.co" }],
    subject: "Re: Weekend trip — confirming dates",
    preview: "Confirmed! I'll drive myself — see you at the cabin around noon.",
    body: `Hey Tomás!

Confirmed. I'll drive separately so I have flexibility on the return. Should be there around noon on Friday.

Payment sent via the link — let me know if you got it.

See you then!`,
    date: d(3, 19, 10),
    read: true,
    starred: false,
    folder: "sent",
    category: "primary",
    tagIds: ["personal", "travel"],
  },
  {
    id: "e4c",
    threadId: "t-trip",
    from: { name: "Tomás Rivera", email: "tomas@product.co" },
    to: [ME],
    subject: "Re: Weekend trip — confirming dates",
    preview: "Got the payment, thanks! I'll add you to the group chat now.",
    body: `Got it, payment received — thanks!

Adding you to the group chat now. The packing list is there. Main things to bring: sleeping bag (the cabin has blankets but they're thin), good boots for trails, and something warm for the evenings.

Can't wait!
Tomás`,
    date: d(2, 9, 0),
    read: true,
    starred: false,
    folder: "inbox",
    category: "primary",
    tagIds: ["personal", "travel"],
  },

  // ── Thread: t-investor (2 messages) ─────────────────
  {
    id: "e5",
    threadId: "t-investor",
    from: { name: "Aisha Okonkwo", email: "aisha@investors.io", verified: true },
    to: [ME],
    subject: "Follow-up from our meeting — next steps",
    preview: "Great conversation yesterday. I'm attaching the term sheet draft for your review.",
    body: `Hi,

Really enjoyed our conversation yesterday. Your traction metrics are impressive and the team clearly has strong product intuition.

I'm attaching a preliminary term sheet for your review — this is non-binding and just meant to open the formal dialogue. Our target close date is end of month.

A few things to look at closely:
• Section 3.2 — liquidation preference (1x non-participating)
• Section 5 — pro-rata rights
• Board composition (Section 7)

Happy to jump on a call early next week to walk through it.

Best,
Aisha`,
    date: d(4, 9, 0),
    read: true,
    starred: true,
    folder: "inbox",
    category: "primary",
    tagIds: ["finance", "important"],
    attachments: [
      { id: "a4", name: "term-sheet-draft.pdf", size: "190 KB", type: "application/pdf" },
    ],
  },
  {
    id: "e5b",
    threadId: "t-investor",
    from: ME,
    to: [{ name: "Aisha Okonkwo", email: "aisha@investors.io" }],
    subject: "Re: Follow-up from our meeting — next steps",
    preview: "Thank you for the term sheet. I've had a chance to review and have a few questions on 3.2 and 5.",
    body: `Hi Aisha,

Thank you for sending this over — I've reviewed it and it looks like a solid starting point.

I have a couple of questions:

1. Section 3.2 — the 1x non-participating is great. Can we discuss whether the preference applies only in a liquidation or also in certain acquisition scenarios?

2. Section 5 — the pro-rata rights look standard. Does this extend to future rounds beyond Series B?

Happy to jump on a call Thursday or Friday to discuss. Does either work for you?

Best,
Me`,
    date: d(3, 16, 0),
    read: true,
    starred: false,
    folder: "sent",
    category: "primary",
    tagIds: ["finance", "important"],
  },

  // ── Thread: t-deploy-freeze (single) ────────────────
  {
    id: "e6",
    threadId: "t-deploy-freeze",
    from: { name: "Dev Team", email: "dev@reclear.io" },
    to: [{ name: "All", email: "all@reclear.io" }],
    subject: "Deployment freeze: Dec 20–Jan 3",
    preview: "As a reminder, no production deployments during the holiday period unless critical.",
    body: `Hi team,

Just a reminder that we have a deployment freeze from Dec 20 through Jan 3. No production deployments unless it's a Sev-1 incident.

If you need an exception, get approval from the on-call lead and document it in the incidents channel.

Enjoy the break,
Dev Ops`,
    date: d(1, 8, 0),
    read: false,
    starred: false,
    folder: "inbox",
    category: "internal",
    tagIds: ["work"],
  },

  // ── Thread: t-roadmap (2 messages) ──────────────────
  {
    id: "e7",
    threadId: "t-roadmap",
    from: { name: "Lena Schmidt", email: "lena@reclear.io" },
    to: [ME],
    subject: "Product roadmap Q1 — please review",
    preview: "I've updated the roadmap doc with the new priorities from the all-hands. Would love your feedback.",
    body: `Hey,

I've updated the roadmap doc with the reprioritisation from the all-hands. The big shifts:
• Email tagging feature moved up to Jan
• Mobile app pushed to March (not Feb as originally planned)
• API v2 stays on track for end of Jan

I'd love your feedback before I share with the wider team on Thursday. Especially on whether the Jan timeline for tagging is realistic given current eng capacity.

Thanks!
Lena`,
    date: d(2, 13, 20),
    read: false,
    starred: false,
    folder: "inbox",
    category: "internal",
    tagIds: ["product", "work"],
  },
  {
    id: "e7b",
    threadId: "t-roadmap",
    from: ME,
    to: [{ name: "Lena Schmidt", email: "lena@reclear.io" }],
    subject: "Re: Product roadmap Q1 — please review",
    preview: "Jan for tagging is tight but doable if we scope it to the core feature. Left comments in the doc.",
    body: `Hey Lena,

Jan for tagging is tight but doable if we scope it to the core feature (add/remove tags, filter by tag) and defer tag-based rules/automation to Q2.

I left some comments directly in the doc on the mobile timeline — I actually think March is more realistic than February given the current eng workload, so good call there.

One thing I'd flag: API v2 and tagging overlap on the same team. Worth a quick check that we're not creating a bottleneck.

Happy to jump on a call before Thursday if helpful.`,
    date: d(2, 15, 45),
    read: true,
    starred: false,
    folder: "sent",
    category: "internal",
    tagIds: ["product", "work"],
  },

  // ── Thread: t-hr (single) ────────────────────────────
  {
    id: "e8",
    threadId: "t-hr",
    from: { name: "HR Team", email: "hr@reclear.io" },
    to: [{ name: "All", email: "all@reclear.io" }],
    subject: "Annual performance review cycle starts Monday",
    preview: "Please complete your self-assessment by Dec 15. Manager reviews due Dec 22.",
    body: `Hi everyone,

The annual performance review cycle opens Monday. Here's what you need to do:

1. Complete your self-assessment in Lattice by Dec 15
2. Request peer feedback from 2–4 colleagues by Dec 12
3. Manager reviews close Dec 22

HR will be hosting drop-in sessions (Mon/Wed 4–5pm) if you have questions about the process.

HR Team`,
    date: d(5, 9, 0),
    read: true,
    starred: false,
    folder: "inbox",
    category: "internal",
    tagIds: ["work"],
  },

  // ── Thread: t-expenses (single) ──────────────────────
  {
    id: "e9",
    threadId: "t-expenses",
    from: { name: "Finance Ops", email: "finance@reclear.io" },
    to: [{ name: "Team Leads", email: "leads@reclear.io" }],
    subject: "Expense reports due by 5pm today",
    preview: "This is your final reminder to submit any outstanding expenses for the current period.",
    body: `Hi,

This is your final reminder — all expense reports for November must be submitted in Expensify by 5pm today to make the payroll cut.

If you miss the deadline, expenses will be rolled into the next cycle (December).

Finance Ops`,
    date: d(0, 7, 30),
    read: false,
    starred: false,
    folder: "inbox",
    category: "internal",
    tagIds: ["finance", "work"],
  },

  // ── Thread: t-github (single) ────────────────────────
  {
    id: "e10",
    threadId: "t-github",
    from: { name: "GitHub", email: "noreply@github.com", verified: true },
    to: [ME],
    subject: "[reclear-io/reclear-email] PR #12 approved",
    preview: "lena-schmidt approved your pull request: feat: email tagging system",
    body: `lena-schmidt approved your pull request.

Repository: reclear-io/reclear-email
PR #12: feat: email tagging system
Branch: feat/tagging → main

View the pull request:
https://github.com/reclear-io/reclear-email/pull/12`,
    date: d(0, 10, 5),
    read: false,
    starred: false,
    folder: "inbox",
    category: "notifications",
    tagIds: ["work"],
  },

  // ── Thread: t-stripe (single) ────────────────────────
  {
    id: "e11",
    threadId: "t-stripe",
    from: { name: "Stripe", email: "notify@stripe.com", verified: true },
    to: [ME],
    subject: "Payment received — $2,400.00",
    preview: "A payment of $2,400.00 has been received from Acme Corp.",
    body: `Payment received

Amount: $2,400.00
From: Acme Corp
Invoice: INV-2024-089
Date: ${new Date(d(0, 8, 0)).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}

View in Stripe Dashboard`,
    date: d(0, 8, 12),
    read: true,
    starred: false,
    folder: "inbox",
    category: "notifications",
    tagIds: ["finance"],
  },

  // ── Thread: t-vercel (single) ────────────────────────
  {
    id: "e12",
    threadId: "t-vercel",
    from: { name: "Vercel", email: "noreply@vercel.com", verified: true },
    to: [ME],
    subject: "Your deployment succeeded",
    preview: "reclear-email was successfully deployed to production.",
    body: `Deployment successful

Project: reclear-email
Environment: Production
Domain: reclear-email.vercel.app
Duration: 2m 14s
Status: Ready`,
    date: d(1, 15, 40),
    read: true,
    starred: false,
    folder: "inbox",
    category: "notifications",
    tagIds: ["work"],
  },

  // ── Thread: t-linear (single) ────────────────────────
  {
    id: "e13",
    threadId: "t-linear",
    from: { name: "Linear", email: "notify@linear.app", verified: true },
    to: [ME],
    subject: "Issue REC-204 assigned to you",
    preview: "Lena Schmidt assigned REC-204: Implement tag filtering in email list",
    body: `New issue assigned to you

REC-204: Implement tag filtering in email list
Assigned by: Lena Schmidt
Priority: High
Project: Reclear Email — Q1 Roadmap
Due: Jan 10

View issue in Linear`,
    date: d(2, 11, 55),
    read: true,
    starred: false,
    folder: "inbox",
    category: "notifications",
    tagIds: ["work", "product"],
  },

  // ── Thread: t-lenny (single) ─────────────────────────
  {
    id: "e14",
    threadId: "t-lenny",
    from: { name: "Lenny's Newsletter", email: "lenny@lennysnewsletter.com", verified: true },
    to: [ME],
    subject: "How the best PMs think about prioritisation",
    preview: "This week: a framework used by PMs at Stripe, Figma, and Notion to cut through the noise.",
    body: `Hi,

This week I dug into how the best PMs at Stripe, Figma, and Notion approach the hardest part of the job: what to work on next.

The short version: the most effective PMs I've spoken to all share one habit — they obsessively clarify "what does success look like in 90 days?" before touching a backlog.

Everything else follows from that...

[Read the full issue →]`,
    date: d(3, 8, 0),
    read: true,
    starred: false,
    folder: "inbox",
    category: "newsletter",
    tagIds: ["product"],
  },

  // ── Thread: t-css (single) ───────────────────────────
  {
    id: "e15",
    threadId: "t-css",
    from: { name: "CSS Weekly", email: "hey@css-weekly.com" },
    to: [ME],
    subject: "CSS Weekly #598 — Tailwind v4, Container Queries, and more",
    preview: "This week's best links: Tailwind v4 deep-dive, CSS anchor positioning, and a neat scroll-driven animation trick.",
    body: `CSS Weekly #598

This week's highlights:
• Tailwind CSS v4 — everything that changed
• CSS anchor positioning is now in all major browsers
• Scroll-driven animations without JavaScript
• The future of CSS nesting

[Read the full issue →]`,
    date: d(6, 9, 0),
    read: false,
    starred: false,
    folder: "inbox",
    category: "newsletter",
    tagIds: ["design"],
  },

  // ── Thread: t-pragmatic (single) ─────────────────────
  {
    id: "e16",
    threadId: "t-pragmatic",
    from: { name: "The Pragmatic Engineer", email: "pragmatic@newsletter.pragmaticengineer.com", verified: true },
    to: [ME],
    subject: "Big Tech salaries in 2025: what's changed?",
    preview: "After surveying 2,400 engineers, here's what compensation looks like at FAANG and beyond.",
    body: `Hi,

After analysing data from 2,400 engineers across 40+ companies, I can share some clear trends for 2025.

TL;DR: Total comp is up at Microsoft and Google, flat at Meta, and down at Amazon (mainly due to RSU corrections). Startups Series A–C are being more competitive than ever on base.

Detailed breakdowns by level, company, and role inside...

[Read the full issue →]`,
    date: d(7, 8, 30),
    read: true,
    starred: true,
    folder: "inbox",
    category: "newsletter",
    tagIds: ["work"],
  },

  // ── Thread: t-morning (single) ───────────────────────
  {
    id: "e17",
    threadId: "t-morning",
    from: { name: "Morning Brew", email: "crew@morningbrew.com" },
    to: [ME],
    subject: "Today's briefing: Fed holds rates, Apple event recap",
    preview: "Good morning. The Fed held rates steady — here's what it means for markets.",
    body: `Good morning!

FINANCE: Fed holds rates at 4.25–4.50% for the third consecutive meeting. Markets reacted positively; S&P 500 up 0.8%.

TECH: Apple's December event unveiled the M4 MacBook Air and new spatial computing SDK updates.

WORLD: COP30 climate negotiations in Brazil kicked off with ambitious new pledges from the EU and Canada.

Have a great day!
Morning Brew`,
    date: d(0, 6, 0),
    read: false,
    starred: false,
    folder: "inbox",
    category: "newsletter",
    tagIds: ["finance"],
  },

  // ── Drafts ───────────────────────────────────────────
  {
    id: "e20",
    threadId: "t-draft-investor",
    from: ME,
    to: [{ name: "Aisha Okonkwo", email: "aisha@investors.io" }],
    subject: "Re: Follow-up from our meeting — next steps",
    preview: "Thank you for the term sheet. I've reviewed sections 3.2 and 5 and have a few questions...",
    body: `Hi Aisha,

Thank you for sending over the term sheet. I've reviewed it and have a few questions:

1. Section 3.2 — the 1x non-participating preference is acceptable. However, could we discuss...`,
    date: d(4, 16, 0),
    read: true,
    starred: false,
    folder: "drafts",
    category: "primary",
    tagIds: ["finance", "important"],
  },
  {
    id: "e21",
    threadId: "t-draft-oncall",
    from: ME,
    to: [{ name: "Dev Team", email: "dev@reclear.io" }],
    subject: "Proposal: on-call rotation changes",
    preview: "I've been thinking about the current rotation and have a proposal to reduce burnout...",
    body: `Hi team,

I've been reflecting on our current on-call setup and wanted to share a proposal before the next team meeting.

The main change I'm proposing: move from weekly to bi-weekly rotations, with a dedicated "shadow" slot...`,
    date: d(6, 11, 0),
    read: true,
    starred: false,
    folder: "drafts",
    category: "internal",
    tagIds: ["work"],
  },

  // ── Spam ─────────────────────────────────────────────
  {
    id: "e22",
    threadId: "t-spam-lottery",
    from: { name: "Lottery Winner", email: "winner@prize-claims.xyz" },
    to: [ME],
    subject: "YOU HAVE WON $1,000,000 — CLAIM NOW",
    preview: "Congratulations! You have been selected as the winner of our international lottery.",
    body: `CONGRATULATIONS!!!

You have been selected as the WINNER of our International Online Lottery. Your email address was randomly selected from 10 million entries worldwide.

To claim your prize of USD $1,000,000 you must respond within 48 hours...`,
    date: d(2, 3, 0),
    read: false,
    starred: false,
    folder: "spam",
    category: "primary",
    tagIds: [],
  },
  {
    id: "e23",
    threadId: "t-spam-deals",
    from: { name: "Deals Alert", email: "deals@cheapmeds-online.biz" },
    to: [ME],
    subject: "💊 70% off — limited time ONLY",
    preview: "Get your medications at 70% off retail price. No prescription needed.",
    body: `Special offer — today only!

Get your medications at 70% off retail. No prescription required. Fast worldwide shipping.

Click here to order now...`,
    date: d(5, 14, 0),
    read: true,
    starred: false,
    folder: "spam",
    category: "newsletter",
    tagIds: [],
  },

  // ── Trash ─────────────────────────────────────────────
  {
    id: "e24",
    threadId: "t-trash-news",
    from: { name: "Old Newsletter", email: "news@outdated-service.com" },
    to: [ME],
    subject: "Your weekly digest",
    preview: "Here's what happened this week in tech...",
    body: `Your weekly tech digest...`,
    date: d(30, 9, 0),
    read: true,
    starred: false,
    folder: "trash",
    category: "newsletter",
    tagIds: [],
  },
  {
    id: "e25",
    threadId: "t-trash-account",
    from: { name: "Old Service", email: "no-reply@service.io" },
    to: [ME],
    subject: "Your account will be deleted",
    preview: "Your free trial has expired. Your data will be deleted in 7 days.",
    body: `Your trial has expired and your data will be deleted in 7 days unless you upgrade.`,
    date: d(14, 11, 0),
    read: true,
    starred: false,
    folder: "trash",
    category: "notifications",
    tagIds: [],
  },
];
