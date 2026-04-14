/**
 * TempMail — Cloudflare Email Worker
 *
 * Setup steps:
 * 1. Deploy this worker in your Cloudflare dashboard (Workers & Pages → Create Worker)
 * 2. Set the following environment variables in the worker settings:
 *    - WEBHOOK_URL  : https://your-replit-app.replit.app/api/webhook/receive-email
 *    - WEBHOOK_SECRET : =p0,1BXfmnS;bT^c7n$W8/N_DZ40mB{z
 * 3. In Cloudflare Email Routing, add a "Custom address" rule for each domain:
 *    - catch-all (*) → Send to Worker → select this worker
 *    Do this for: kameti.online, giftofhop.online, globaljobpoint.com
 */

export default {
  async email(message, env, ctx) {
    const webhookUrl = env.WEBHOOK_URL;
    const webhookSecret = env.WEBHOOK_SECRET;

    if (!webhookUrl) {
      console.error("WEBHOOK_URL environment variable not set");
      message.setReject("Configuration error");
      return;
    }

    try {
      // Read the raw email body
      const rawEmail = await streamToText(message.raw);

      // Build the payload matching what our webhook expects
      const payload = {
        to: message.to,
        from: message.from,
        subject: getHeader(rawEmail, "Subject") || "(No Subject)",
        html: extractMimePart(rawEmail, "text/html"),
        text: extractMimePart(rawEmail, "text/plain") || rawEmail,
      };

      // POST to our Replit webhook
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-secret": webhookSecret || "",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.text();
        console.error(`Webhook failed: ${response.status} ${body}`);
        // Don't reject — avoid bouncing the email back to sender
      } else {
        console.log(`Email forwarded to webhook: ${message.to}`);
      }
    } catch (err) {
      console.error("Error processing email:", err);
    }
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function streamToText(stream) {
  const reader = stream.getReader();
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = new Uint8Array(chunks.reduce((acc, c) => acc + c.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    total.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(total);
}

function getHeader(raw, name) {
  const match = raw.match(new RegExp(`^${name}:\\s*(.+)`, "im"));
  return match ? match[1].trim() : null;
}

function normalizeLineBreaks(value) {
  return value.replace(/\r\n/g, "\n");
}

function decodeQuotedPrintable(value) {
  const normalized = value.replace(/=\r?\n/g, "");
  const bytes = [];
  for (let i = 0; i < normalized.length; i++) {
    const c = normalized[i];
    const hex = normalized.slice(i + 1, i + 3);
    if (c === "=" && /^[0-9A-F]{2}$/i.test(hex)) {
      bytes.push(parseInt(hex, 16));
      i += 2;
      continue;
    }
    const code = c.charCodeAt(0);
    if (code <= 0xff) bytes.push(code);
    else bytes.push(...new TextEncoder().encode(c));
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}

function decodeBase64(value) {
  try {
    const binary = atob(value.replace(/\s+/g, ""));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return value;
  }
}

function decodeContent(value, encoding) {
  const enc = (encoding || "").trim().toLowerCase();
  if (enc.includes("quoted-printable")) return decodeQuotedPrintable(value);
  if (enc.includes("base64")) return decodeBase64(value);
  return value;
}

function extractMimePart(raw, mimeType) {
  const normalized = normalizeLineBreaks(raw);
  const boundaryMatch = normalized.match(/boundary="?([^"\n;]+)"?/i);
  const boundary = boundaryMatch ? `--${boundaryMatch[1]}` : null;

  if (!boundary) return "";

  const sections = normalized
    .split(boundary)
    .map((s) => s.trim())
    .filter((s) => s && s !== "--");

  for (const section of sections) {
    const cleaned = section.replace(/^--$/, "").trim();
    if (!cleaned) continue;
    const [headers, ...bodyParts] = cleaned.split(/\n\n/);
    if (!headers || bodyParts.length === 0) continue;
    if (!new RegExp(`content-type:\\s*${mimeType}`, "i").test(headers)) continue;
    const encMatch = headers.match(/content-transfer-encoding:\s*([^\n;]+)/i);
    const enc = encMatch ? encMatch[1] : "";
    return decodeContent(bodyParts.join("\n\n").trim(), enc).trim();
  }
  return "";
}
