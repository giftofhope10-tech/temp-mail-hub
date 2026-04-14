# TempMail — Replit Project

A disposable temporary email service. Users get a random email address that receives real emails, with a 24-hour lifetime. Also includes a developer API for programmatic access.

## Architecture

**Frontend:** React + Vite + TypeScript + Tailwind CSS + shadcn/ui (port 5000)
**Backend:** Express.js + TypeScript + Drizzle ORM (port 3000)
**Database:** Replit PostgreSQL

In development, both run together via `concurrently`. Vite proxies `/api/*` requests to the Express server.

## Key Files

- `server/index.ts` — Express server with all API routes
- `server/schema.ts` — Drizzle ORM schema (temp_emails, received_emails, api_keys, api_usage)
- `server/db.ts` — Database connection
- `src/pages/Index.tsx` — Main app page (email generator + inbox)
- `src/pages/ApiDocs.tsx` — Developer API documentation page
- `src/components/` — React UI components
- `drizzle.config.ts` — Drizzle configuration
- `vite.config.ts` — Vite with API proxy to backend

## API Routes

- `POST /api/emails` — Register a new temp email address
- `GET /api/emails/:id/messages` — Fetch inbox for a temp email
- `DELETE /api/emails/:id` — Delete a received email
- `POST /api/webhook/receive-email` — Inbound email webhook (secured with EMAIL_WEBHOOK_SECRET)
- `POST /api/dev/api-keys` — Generate a developer API key
- `GET /api/dev/domains` — List available domains (requires x-api-key)
- `POST /api/dev/generate` — Generate temp email via API (requires x-api-key)
- `GET /api/dev/inbox` — Fetch inbox via API (requires x-api-key)
- `DELETE /api/dev/email` — Delete email via API (requires x-api-key)

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection string (auto-set by Replit)
- `EMAIL_WEBHOOK_SECRET` — Optional secret for securing the inbound email webhook

## Running

```bash
npm run dev       # Start both frontend and backend
npm run db:push   # Sync database schema
```

## Domains

Three email domains are configured: `kameti.online`, `giftofhop.online`, `globaljobpoint.com`

To receive emails at these domains, configure an MX record pointing to a mail server that POSTs to `/api/webhook/receive-email`.
