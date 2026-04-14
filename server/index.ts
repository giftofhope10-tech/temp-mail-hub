import express from "express";
import cors from "cors";
import { db } from "./db.js";
import { tempEmails, receivedEmails, apiKeys, apiUsage } from "./schema.js";
import { eq, desc, gte, sql } from "drizzle-orm";

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

const PORT = process.env.PORT || 3000;

// ── Temp Email Routes ─────────────────────────────────────────────────────────

// POST /api/emails — register a new temp email address
app.post("/api/emails", async (req, res) => {
  const { email_address } = req.body;
  if (!email_address) return res.status(400).json({ error: "email_address required" });
  try {
    const [row] = await db
      .insert(tempEmails)
      .values({ email_address })
      .returning({ id: tempEmails.id, email_address: tempEmails.email_address, created_at: tempEmails.created_at, expires_at: tempEmails.expires_at });
    res.json(row);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/emails/:id/messages — fetch inbox for a temp email
app.get("/api/emails/:id/messages", async (req, res) => {
  const { id } = req.params;
  try {
    const rows = await db
      .select()
      .from(receivedEmails)
      .where(eq(receivedEmails.temp_email_id, id))
      .orderBy(desc(receivedEmails.received_at))
      .limit(50);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/emails/:id — delete a single received email
app.delete("/api/emails/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await db.delete(receivedEmails).where(eq(receivedEmails.id, id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Receive-Email Webhook ─────────────────────────────────────────────────────

const WEBHOOK_SECRET = process.env.EMAIL_WEBHOOK_SECRET || "";
const MIME_PATTERN = /(content-type:\s*(multipart\/|text\/plain|text\/html)|content-transfer-encoding:|^--[-\w.=]+$)/im;
const HTML_PATTERN = /<\/?[a-z][\s\S]*>/i;

function normalizeLineBreaks(value: string) { return value.replace(/\r\n/g, "\n"); }

function decodeQuotedPrintable(value: string): string {
  const normalized = value.replace(/=\r?\n/g, "");
  const bytes: number[] = [];
  for (let i = 0; i < normalized.length; i++) {
    const c = normalized[i], hex = normalized.slice(i + 1, i + 3);
    if (c === "=" && /^[0-9A-F]{2}$/i.test(hex)) { bytes.push(parseInt(hex, 16)); i += 2; continue; }
    const code = c.charCodeAt(0);
    if (code <= 0xff) bytes.push(code);
    else bytes.push(...new TextEncoder().encode(c));
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}

function decodeBase64(value: string): string {
  try { return Buffer.from(value.replace(/\s+/g, ""), "base64").toString("utf-8"); } catch { return value; }
}

function decodeContent(value: string, encoding?: string): string {
  const enc = encoding?.trim().toLowerCase() ?? "";
  if (enc.includes("quoted-printable")) return decodeQuotedPrintable(value);
  if (enc.includes("base64")) return decodeBase64(value);
  if (/(=[0-9a-f]{2}|=\r?\n)/i.test(value)) return decodeQuotedPrintable(value);
  return value;
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|li|tr|blockquote|h[1-6])>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/ *\n */g, "\n")
    .trim();
}

function splitMimeSections(raw: string): string[] {
  const normalized = normalizeLineBreaks(raw);
  const bFromHeaders = normalized.match(/boundary="?([^"\n;]+)"?/i)?.[1];
  const marker = bFromHeaders ? `--${bFromHeaders}` : normalized.match(/^(--[^\n]+)$/m)?.[1];
  if (!marker) return [normalized];
  return normalized.split(marker).map(s => s.trim()).filter(s => s && s !== "--");
}

function extractMimePart(raw: string, mimeType: "text/html" | "text/plain"): string {
  for (const section of splitMimeSections(raw)) {
    const cleaned = section.replace(/^--$/, "").trim();
    if (!cleaned) continue;
    const [headers, ...bodyParts] = cleaned.split(/\n\n/);
    if (!headers || bodyParts.length === 0) continue;
    if (!new RegExp(`content-type:\\s*${mimeType}`, "i").test(headers)) continue;
    const enc = headers.match(/content-transfer-encoding:\s*([^\n;]+)/i)?.[1];
    return decodeContent(bodyParts.join("\n\n").trim(), enc).trim();
  }
  return "";
}

function parseEmailContent(text?: string, html?: string) {
  const textSrc = text?.trim() ?? "";
  const htmlSrc = html?.trim() ?? "";
  if (htmlSrc && !MIME_PATTERN.test(htmlSrc)) {
    return { text: textSrc && !MIME_PATTERN.test(textSrc) ? decodeContent(textSrc).trim() : htmlToText(htmlSrc), html: htmlSrc };
  }
  const mimeSrc = [htmlSrc, textSrc].find(v => v && MIME_PATTERN.test(v)) ?? "";
  if (mimeSrc) {
    const eHtml = extractMimePart(mimeSrc, "text/html");
    const eText = extractMimePart(mimeSrc, "text/plain");
    if (eHtml || eText) return { text: eText || htmlToText(eHtml), html: eHtml };
  }
  if (textSrc && HTML_PATTERN.test(textSrc)) return { text: htmlToText(textSrc), html: textSrc };
  return { text: decodeContent(textSrc).trim(), html: htmlSrc };
}

// POST /api/webhook/receive-email — inbound email webhook
app.post("/api/webhook/receive-email", async (req, res) => {
  const secret = req.headers["x-webhook-secret"];
  if (WEBHOOK_SECRET && secret !== WEBHOOK_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const { to, from, subject, text, html } = req.body;
  if (!to || !from) return res.status(400).json({ error: "Missing required fields: to, from" });

  const recipientEmail = Array.isArray(to) ? to[0] : to;
  const normalizedRecipient = (typeof recipientEmail === "string" ? recipientEmail : recipientEmail?.address ?? "").toLowerCase();

  try {
    const [tempEmail] = await db
      .select({ id: tempEmails.id, expires_at: tempEmails.expires_at })
      .from(tempEmails)
      .where(eq(tempEmails.email_address, normalizedRecipient))
      .limit(1);

    if (!tempEmail) return res.status(404).json({ error: "Recipient not found" });
    if (new Date(tempEmail.expires_at) < new Date()) return res.status(410).json({ error: "Email address expired" });

    const parsed = parseEmailContent(text, html);
    const sender = typeof from === "string" ? from : from?.address || from?.[0] || "Unknown sender";

    await db.insert(receivedEmails).values({
      temp_email_id: tempEmail.id,
      from_address: sender,
      subject: subject || "(No Subject)",
      body_text: parsed.text,
      body_html: parsed.html,
    });

    res.json({ success: true });
  } catch (err: any) {
    console.error("Error processing email:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Developer API Routes ──────────────────────────────────────────────────────

const ALL_DOMAINS = ["kameti.online", "giftofhop.online", "globaljobpoint.com"];

function generateUsername() {
  const adj = ["cool","fast","wild","dark","blue","red","zen","hot","ice","pro","ace","max","top","neo","sky"];
  const nouns = ["mail","fox","wolf","bear","hawk","star","bolt","wave","fire","byte","node","flux","core","dash","link"];
  const a = adj[Math.floor(Math.random() * adj.length)];
  const n = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 999) + 1;
  return `${a}${n}${num}`;
}

async function validateApiKey(key: string) {
  const [keyData] = await db.select().from(apiKeys).where(eq(apiKeys.api_key, key)).limit(1);
  if (!keyData || !keyData.is_active) return null;
  return keyData;
}

async function checkRateLimit(keyId: string, limitPerMinute: number): Promise<boolean> {
  const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(apiUsage)
    .where(eq(apiUsage.api_key_id, keyId));
  // More accurate: filter by time
  const recent = await db.execute(
    sql`SELECT count(*) FROM api_usage WHERE api_key_id = ${keyId} AND requested_at >= ${oneMinuteAgo}`
  );
  const count = Number((recent.rows[0] as any)?.count ?? 0);
  return count < limitPerMinute;
}

// POST /api/dev/api-keys — generate an API key
app.post("/api/dev/api-keys", async (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes("@")) return res.status(400).json({ error: "Valid email required" });
  try {
    const key = "tm_" + crypto.randomUUID().replace(/-/g, "");
    const [row] = await db.insert(apiKeys).values({
      api_key: key,
      email,
      plan: "free",
      allowed_domains: ["kameti.online"],
      rate_limit_per_minute: 10,
    }).returning();
    res.json({ api_key: row.api_key });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to generate key. Email may already have a key." });
  }
});

// Developer API middleware
const devRouter = express.Router();

devRouter.use(async (req, res, next) => {
  const apiKey = req.headers["x-api-key"] as string;
  if (!apiKey) return res.status(401).json({ error: "Missing x-api-key header" });
  const keyData = await validateApiKey(apiKey);
  if (!keyData) return res.status(403).json({ error: "Invalid or inactive API key" });

  const withinLimit = await checkRateLimit(keyData.id, keyData.rate_limit_per_minute);
  if (!withinLimit) return res.status(429).json({ error: "Rate limit exceeded", limit: keyData.rate_limit_per_minute, reset_in: "60s" });

  await db.insert(apiUsage).values({ api_key_id: keyData.id, endpoint: req.path });
  (req as any).keyData = keyData;
  next();
});

devRouter.get("/domains", (req, res) => {
  const keyData = (req as any).keyData;
  const available = keyData.plan === "paid" ? ALL_DOMAINS : (keyData.allowed_domains || [ALL_DOMAINS[0]]);
  res.json({ domains: available, plan: keyData.plan });
});

devRouter.post("/generate", async (req, res) => {
  const keyData = (req as any).keyData;
  const domain = req.body.domain || keyData.allowed_domains?.[0] || "kameti.online";
  const allowed = keyData.plan === "paid" ? ALL_DOMAINS : (keyData.allowed_domains || [ALL_DOMAINS[0]]);
  if (!allowed.includes(domain)) return res.status(403).json({ error: `Domain '${domain}' not available on your plan.` });

  const username = generateUsername();
  const emailAddr = `${username}@${domain}`;
  try {
    const [row] = await db.insert(tempEmails).values({ email_address: emailAddr })
      .returning({ id: tempEmails.id, email_address: tempEmails.email_address, created_at: tempEmails.created_at, expires_at: tempEmails.expires_at });
    res.json({ email: row });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to create email" });
  }
});

devRouter.get("/inbox", async (req, res) => {
  const emailId = req.query.email_id as string;
  if (!emailId) return res.status(400).json({ error: "email_id parameter required" });
  try {
    const rows = await db.select().from(receivedEmails).where(eq(receivedEmails.temp_email_id, emailId)).orderBy(desc(receivedEmails.received_at)).limit(50);
    res.json({ emails: rows });
  } catch {
    res.status(500).json({ error: "Failed to fetch emails" });
  }
});

devRouter.delete("/email", async (req, res) => {
  const id = req.query.id as string;
  if (!id) return res.status(400).json({ error: "id parameter required" });
  try {
    await db.delete(receivedEmails).where(eq(receivedEmails.id, id));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete" });
  }
});

app.use("/api/dev", devRouter);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
