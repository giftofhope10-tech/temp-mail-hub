import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

const PORT = process.env.PORT || 3000;

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ── Temp Email Routes ─────────────────────────────────────────────────────────

// POST /api/emails — register a new temp email address
app.post("/api/emails", async (req, res) => {
  const { email_address } = req.body;
  if (!email_address) return res.status(400).json({ error: "email_address required" });
  try {
    const { data, error } = await supabase
      .from("temp_emails")
      .insert({ email_address })
      .select("id, email_address, created_at, expires_at")
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/emails/:id/messages — fetch inbox for a temp email
app.get("/api/emails/:id/messages", async (req, res) => {
  const { id } = req.params;
  try {
    const { data, error } = await supabase
      .from("received_emails")
      .select("*")
      .eq("temp_email_id", id)
      .order("received_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    res.json(data || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/emails/:id — delete a single received email
app.delete("/api/emails/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase.from("received_emails").delete().eq("id", id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Receive-Email Webhook (Cloudflare Email Workers) ─────────────────────────

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
    else bytes.push(...Buffer.from(c, "utf-8"));
  }
  return Buffer.from(bytes).toString("utf-8");
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

// POST /api/webhook/receive-email — inbound email from Cloudflare Email Worker
app.post("/api/webhook/receive-email", async (req, res) => {
  const secret = req.headers["x-webhook-secret"];
  if (WEBHOOK_SECRET && secret !== WEBHOOK_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { to, from, subject, text, html } = req.body;
  if (!to || !from) return res.status(400).json({ error: "Missing required fields: to, from" });

  const recipientEmail = Array.isArray(to) ? to[0] : to;
  const normalizedRecipient = (typeof recipientEmail === "string"
    ? recipientEmail
    : (recipientEmail?.address ?? "")).toLowerCase();

  try {
    const { data: tempEmail, error: lookupError } = await supabase
      .from("temp_emails")
      .select("id, expires_at")
      .eq("email_address", normalizedRecipient)
      .single();

    if (lookupError || !tempEmail) {
      console.log(`No temp email found for: ${normalizedRecipient}`);
      return res.status(404).json({ error: "Recipient not found" });
    }

    if (new Date(tempEmail.expires_at) < new Date()) {
      return res.status(410).json({ error: "Email address expired" });
    }

    const parsed = parseEmailContent(text, html);
    const sender = typeof from === "string" ? from : from?.address || from?.[0] || "Unknown sender";

    const { error: insertError } = await supabase.from("received_emails").insert({
      temp_email_id: tempEmail.id,
      from_address: sender,
      subject: subject || "(No Subject)",
      body_text: parsed.text,
      body_html: parsed.html,
    });

    if (insertError) {
      console.error("Insert error:", insertError);
      return res.status(500).json({ error: "Failed to store email" });
    }

    console.log(`Email stored for ${normalizedRecipient} from ${sender}`);
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

// POST /api/dev/api-keys — generate a developer API key (no auth required)
app.post("/api/dev/api-keys", async (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes("@")) return res.status(400).json({ error: "Valid email required" });
  try {
    const key = "tm_" + crypto.randomUUID().replace(/-/g, "");
    const { error } = await supabase.from("api_keys").insert({
      api_key: key,
      email,
      plan: "free",
      allowed_domains: ["kameti.online"],
      rate_limit_per_minute: 10,
    });
    if (error) throw error;
    res.json({ api_key: key });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to generate key. Email may already have a key." });
  }
});

// Developer API middleware — validate x-api-key + rate limit
const devRouter = express.Router();

devRouter.use(async (req, res, next) => {
  const apiKey = req.headers["x-api-key"] as string;
  if (!apiKey) return res.status(401).json({ error: "Missing x-api-key header" });

  const { data: keyData, error } = await supabase
    .from("api_keys")
    .select("*")
    .eq("api_key", apiKey)
    .eq("is_active", true)
    .single();

  if (error || !keyData) return res.status(403).json({ error: "Invalid or inactive API key" });

  const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
  const { count } = await supabase
    .from("api_usage")
    .select("*", { count: "exact", head: true })
    .eq("api_key_id", keyData.id)
    .gte("requested_at", oneMinuteAgo);

  if ((count || 0) >= keyData.rate_limit_per_minute) {
    return res.status(429).json({ error: "Rate limit exceeded", limit: keyData.rate_limit_per_minute, reset_in: "60s" });
  }

  await supabase.from("api_usage").insert({ api_key_id: keyData.id, endpoint: req.path });
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
  if (!allowed.includes(domain)) {
    return res.status(403).json({ error: `Domain '${domain}' not available on your plan.` });
  }
  const username = generateUsername();
  const emailAddr = `${username}@${domain}`;
  try {
    const { data, error } = await supabase
      .from("temp_emails")
      .insert({ email_address: emailAddr })
      .select("id, email_address, created_at, expires_at")
      .single();
    if (error) throw error;
    res.json({ email: data });
  } catch {
    res.status(500).json({ error: "Failed to create email" });
  }
});

devRouter.get("/inbox", async (req, res) => {
  const emailId = req.query.email_id as string;
  if (!emailId) return res.status(400).json({ error: "email_id parameter required" });
  try {
    const { data, error } = await supabase
      .from("received_emails")
      .select("id, from_address, subject, body_text, body_html, received_at, is_read")
      .eq("temp_email_id", emailId)
      .order("received_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    res.json({ emails: data || [] });
  } catch {
    res.status(500).json({ error: "Failed to fetch emails" });
  }
});

devRouter.delete("/email", async (req, res) => {
  const id = req.query.id as string;
  if (!id) return res.status(400).json({ error: "id parameter required" });
  try {
    const { error } = await supabase.from("received_emails").delete().eq("id", id);
    if (error) throw error;
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete" });
  }
});

app.use("/api/dev", devRouter);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
