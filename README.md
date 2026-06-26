# Plunk Email Client

A self-hosted team email client built on [Plunk](https://useplunk.com). Plunk handles email delivery, inbound routing, and delivery-event webhooks — this app provides the full client experience on top: mailboxes at your own domain, a rich compose UI, threads, tags, contacts, and an admin panel.

## Features

- **Inbox / threads** — conversations grouped by subject, with archive, trash, spam, and starred folders
- **Compose** — rich-text editor with attachments, CC/BCC, and email signatures
- **AI triage** — automatic categorisation (primary, newsletter, notification, internal) and spam scoring via Mistral
- **URL safety** — outbound link checking via Google Safe Browsing; flagged links show a red shield
- **Tags** — colour-coded labels, multi-select from the sidebar
- **Contacts** — auto-populated from sent/received mail, with bounce/unsubscribe tracking
- **Admin panel** — invite users, reset passwords, enable/disable accounts
- **2FA** — TOTP (app-based) with 8 backup codes
- **PWA** — installable, works offline for reading cached mail
- **Dark mode**

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, Tailwind CSS, shadcn/ui, Lexical editor, Zustand |
| Backend | Express, TypeScript, Drizzle ORM |
| Database | PostgreSQL |
| Email delivery | [Plunk](https://useplunk.com) |
| AI | Mistral AI |
| URL safety | Google Safe Browsing v4 |

---

## Prerequisites

- Node.js 20+
- PostgreSQL 14+
- A [Plunk](https://useplunk.com) account with a verified sending domain
- (Optional) Mistral API key for AI features
- (Optional) Google Safe Browsing API key for URL threat detection

---

## Local development

### 1. Clone and install

```bash
git clone <repo-url>
cd reclear-email

cd backend && npm install
cd ../frontend && npm install
```

### 2. Configure the backend

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` — the required fields are marked below.

### 3. Push the database schema

```bash
cd backend
npm run db:push
```

This creates all tables. Re-run it whenever `src/db/schema.ts` changes.

### 4. Start both servers

```bash
# terminal 1
cd backend && npm run dev

# terminal 2
cd frontend && npm run dev
```

Frontend: http://localhost:3000  
Backend: http://localhost:3001

### 5. Create your first admin

**Option A — env vars (recommended for first boot)**

Set `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` in `backend/.env` before starting the server. On first boot, if no users exist, the backend seeds this account automatically. The password is marked as temporary so the admin must change it on first login.

**Option B — CLI script**

```bash
cd backend
npm run create-admin
# or non-interactively:
npm run create-admin -- --name "Alice" --email alice@mail.example.com --recovery-email alice@gmail.com
```

---

## Environment variables

All variables live in `backend/.env`. Copy `backend/.env.example` as a starting point.

### Required

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string — `postgresql://user:pass@host:5432/dbname` |
| `JWT_SECRET` | Long random string used to sign session tokens. Use `openssl rand -hex 32`. |
| `EMAIL_DOMAIN` | Domain for team mailboxes — e.g. `mail.example.com` gives `alice@mail.example.com` |
| `PLUNK_SECRET_KEY` | Plunk secret key for sending email (`sk_…`) |
| `PLUNK_FROM_EMAIL` | Verified sender address on your Plunk domain — e.g. `hello@mail.example.com` |
| `PLUNK_INBOUND_SECRET` | Bearer token Plunk sends with inbound email webhooks |
| `FRONTEND_URL` | Full URL of the frontend — used for CORS and links in emails |

### First-boot admin seed (optional but recommended)

| Variable | Description |
|----------|-------------|
| `ADMIN_NAME` | Display name for the seeded admin |
| `ADMIN_EMAIL` | Login email for the seeded admin |
| `ADMIN_PASSWORD` | Temporary password — the admin must change it on first login |

These are only used once, when the database has no users. Safe to remove after first boot.

### Optional features

| Variable | Description |
|----------|-------------|
| `APP_NAME` | Display name used in emails and the TOTP issuer (default: `Mail`) |
| `MISTRAL_API_KEY` | Enables AI email categorisation and spam scoring |
| `GOOGLE_SAFE_BROWSING_API_KEY` | Enables URL threat detection on incoming mail |
| `GOOGLE_CLIENT_ID` | Arbitrary identifier sent with Safe Browsing API requests (default: `mail-app`) |
| `PLUNK_WEBHOOK_SECRET` | Bearer token for delivery-status webhooks from Plunk (open/click/bounce tracking) |
| `PLUNK_API_BASE` | Override the Plunk API base URL (default: `https://next-api.useplunk.com`) |
| `PORT` | Backend port (default: `3001`) |

### Frontend

The frontend only needs one variable in `frontend/.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

In production, set this to your backend's public URL.

---

## Plunk setup

Plunk handles everything email-related: sending, inbound routing, and delivery events. You need to complete three stages: verify your domain for sending, set up inbound receiving, and configure delivery-tracking webhooks.

---

### Stage 1 — Verify your domain for sending

> **Domain tip:** Use a subdomain like `mail.yourdomain.com` for Plunk. This keeps your primary domain free for Google Workspace, Microsoft 365, or whatever you use personally, and avoids MX record conflicts when you add inbound later.

1. Log in to [Plunk](https://useplunk.com) and go to **Settings → Domains → Add domain**
2. Enter your sending domain (e.g. `mail.example.com`)
3. Plunk will show you three DNS records to add at your registrar/DNS provider:

   | Type | Name | Value |
   |------|------|-------|
   | TXT | `mail.example.com` | SPF record — e.g. `v=spf1 include:amazonses.com ~all` |
   | CNAME | `plunk._domainkey.mail.example.com` | DKIM key provided by Plunk |
   | MX | `mail.example.com` | Bounce feedback MX — provided by Plunk |

4. Add all three records, then click **Verify** in Plunk. DNS propagation can take a few minutes to 48 hours. Check with:

   ```bash
   dig TXT mail.example.com
   dig CNAME plunk._domainkey.mail.example.com
   ```

5. Once verified, go to **Settings → API Keys** and copy your secret key — this is your `PLUNK_SECRET_KEY`.
6. Set `PLUNK_FROM_EMAIL` to any address on the verified domain, e.g. `hello@mail.example.com`.
7. Set `EMAIL_DOMAIN` to the same domain — this is what user mailboxes are assigned under (e.g. `alice@mail.example.com`).

---

### Stage 2 — Receive inbound email

Inbound routing works through a Plunk **Workflow** triggered by the `email.received` event. The workflow contains a Webhook step that POSTs each incoming email to your backend.

> **Important:** Your domain must be fully verified for sending (Stage 1) before inbound can be enabled.

#### 2a. Add the inbound MX record

1. In Plunk, go to **Settings → Domains**, open your verified domain, and find the **Inbound Email** section
2. Copy the MX record value Plunk provides
3. Add it to your DNS:

   | Type | Name | Priority | Value |
   |------|------|----------|-------|
   | MX | `mail.example.com` | 10 | *(value from Plunk)* |

   > If this domain already has MX records (e.g. for Google Workspace), you must use a subdomain — a domain can only have one primary inbound MX target.

4. Verify propagation:

   ```bash
   dig MX mail.example.com
   ```

#### 2b. Create the inbound workflow

1. In Plunk, go to **Workflows → New Workflow**
2. Set the trigger to **Event** and choose `email.received`
3. Add a **Webhook** step with these settings:

   - **Method:** `POST`
   - **URL:** `https://your-backend.example.com/api/webhooks/inbound`
   - **Headers:**
     ```json
     { "Authorization": "Bearer YOUR_INBOUND_SECRET" }
     ```
   - **Body:**
     ```json
     {
       "from": "{{event.from}}",
       "to": "{{event.to}}",
       "subject": "{{event.subject}}",
       "body": "{{event.body}}",
       "messageId": "{{event.messageId}}",
       "timestamp": "{{event.timestamp}}",
       "verdicts": {
         "spam": "{{event.spamVerdict}}",
         "virus": "{{event.virusVerdict}}",
         "spf": "{{event.spfVerdict}}",
         "dkim": "{{event.dkimVerdict}}",
         "dmarc": "{{event.dmarcVerdict}}"
       }
     }
     ```

4. **Enable** the workflow (workflows are disabled by default — this is the most common oversight)
5. Copy `YOUR_INBOUND_SECRET` into `PLUNK_INBOUND_SECRET` in your `.env`

The backend verifies the `Authorization` header on every inbound request and rejects anything without a matching secret.

#### Inbound limitations

- **Catch-all routing** — Plunk delivers all inbound mail for the domain to the same workflow. The backend filters by `event.to` to route to the correct user's inbox.
- **No attachments** — Plunk does not forward attachments.
- **40 MB size cap** — emails larger than this are silently dropped.
- **1 credit per received email** — counts against the same Plunk credit pool as outbound.

---

### Stage 3 — Delivery tracking (optional)

Track opens, clicks, bounces, and complaints by creating a second workflow. This powers the delivery status indicators shown in the Sent folder.

1. In Plunk, go to **Workflows → New Workflow**
2. Set the trigger to **Event** — you'll need **one workflow per event type**, or use a single workflow with a **Condition** step to branch. Create workflows for each of:

   | Event | What it enables |
   |-------|----------------|
   | `email.delivery` | Marks sent email as delivered |
   | `email.open` | Records open count and first-opened timestamp |
   | `email.click` | Records click count and first-clicked timestamp |
   | `email.bounce` | Marks email bounced; disables the recipient contact |
   | `email.complaint` | Records spam complaint; disables the recipient contact |

3. For each workflow, add a **Webhook** step:

   - **Method:** `POST`
   - **URL:** `https://your-backend.example.com/api/webhooks/plunk`
   - **Headers:**
     ```json
     { "Authorization": "Bearer YOUR_WEBHOOK_SECRET" }
     ```
   - **Body:** leave empty — Plunk sends its default payload which includes `event`, `contact`, `workflow`, and `execution` fields, plus event-specific data (`emailId`, `bouncedAt`, `openedAt`, etc.)

4. **Enable** each workflow
5. Copy `YOUR_WEBHOOK_SECRET` into `PLUNK_WEBHOOK_SECRET` in your `.env`

The `emailId` field in each event correlates back to the email record in your database — the backend uses it to update delivery status without relying on address matching.

---

## Production deployment

### Docker (frontend only)

A `Dockerfile` is provided at the repo root for the Next.js frontend:

```bash
docker build -t mail-frontend .
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_API_URL=https://api.example.com \
  mail-frontend
```

The backend does not have a Dockerfile — deploy it with any Node.js host (Railway, Fly, a bare VPS, etc.) and point `DATABASE_URL` at a managed PostgreSQL instance.

### Checklist

- [ ] `JWT_SECRET` is a long random string (not the example value)
- [ ] `ADMIN_PASSWORD` is changed after first login (or removed from env)
- [ ] `FRONTEND_URL` matches your actual frontend domain (for CORS)
- [ ] Database is on a persistent volume or managed service
- [ ] MX and SPF/DKIM/DMARC DNS records are in place
- [ ] HTTPS is terminated upstream (nginx, Caddy, Cloudflare, etc.)

---

## Database management

```bash
cd backend

# Apply schema changes to the database
npm run db:push

# Open Drizzle Studio (visual DB browser)
npm run db:studio
```

Schema lives in `backend/src/db/schema.ts`. Drizzle handles migrations — run `db:push` after any schema change.

---

## Admin tasks

### Add a user

Use the **Team** panel in the UI (admin only), or the CLI:

```bash
cd backend
npm run create-admin -- --name "Bob" --email bob@mail.example.com --recovery-email bob@gmail.com --role user
```

An invite email is sent to the recovery address with a temporary password.

### Delete a user

```bash
cd backend
npx tsx scripts/delete-user.ts --email bob@mail.example.com
```
