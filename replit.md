# TempMail — Replit Project

A disposable temporary email service. Users get a random email address that receives real emails, with a 24-hour lifetime. Also includes a developer API for programmatic access.

## Architecture

**Frontend:** React + Vite + TypeScript + Tailwind CSS + shadcn/ui (port 5000)
**Backend:** Express.js + TypeScript (port 3000)
**Database:** Supabase PostgreSQL (project: lwsrdqpxnlrzjqucbdwt)
**Email Routing:** Cloudflare Email Routing → Email Worker → backend webhook

In development, both frontend and backend run together via `concurrently`. Vite proxies all `/api/*` requests to the Express server.

## Key Files

- `server/index.ts` — Express server with all API routes (uses Supabase service role key server-side only)
- `src/pages/Index.tsx` — Main app page (email generator + inbox)
- `src/pages/ApiDocs.tsx` — Developer API documentation page
- `src/components/` — React UI components
- `cloudflare-worker/email-worker.js` — Cloudflare Email Worker script (receives inbound emails)
- `cloudflare-worker/wrangler.toml` — Cloudflare Worker config
- `supabase/setup.sql` — SQL to create all tables in Supabase

## API Routes

### Internal (used by frontend)
- `POST /api/emails` — Register a new temp email address
- `GET /api/emails/:id/messages` — Fetch inbox for a temp email
- `DELETE /api/emails/:id` — Delete a received email

### Webhook (Cloudflare Email Worker → backend)
- `POST /api/webhook/receive-email` — Inbound email from Cloudflare (secured with x-webhook-secret header)

### Developer API (requires x-api-key header)
- `POST /api/dev/api-keys` — Generate a developer API key
- `GET /api/dev/domains` — List available domains
- `POST /api/dev/generate` — Generate temp email via API
- `GET /api/dev/inbox` — Fetch inbox via API
- `DELETE /api/dev/email` — Delete email via API

## Environment Variables / Secrets

- `SUPABASE_URL` — Supabase project URL (env var)
- `SUPABASE_SERVICE_ROLE_KEY` — Service role key (secret, server-side only)
- `SUPABASE_ANON_KEY` — Anon/public key (secret)
- `EMAIL_WEBHOOK_SECRET` — Webhook secret for Cloudflare Email Worker (secret)
- `SUPABASE_DB_PASSWORD` — Supabase DB password (secret, used for direct migrations)

## Cloudflare Email Worker Setup

1. Go to Cloudflare Dashboard → Workers & Pages → Create Worker
2. Paste `cloudflare-worker/email-worker.js`
3. Set environment variables in the worker:
   - `WEBHOOK_URL` = `https://your-app.replit.app/api/webhook/receive-email`
   - `WEBHOOK_SECRET` = (value of EMAIL_WEBHOOK_SECRET secret)
4. In Cloudflare Email Routing, add catch-all rules for each domain pointing to this worker:
   - kameti.online, giftofhop.online, globaljobpoint.com

## Domains

Three email domains: `kameti.online`, `giftofhop.online`, `globaljobpoint.com`

## Running

```bash
npm run dev   # Start both frontend and backend
```
