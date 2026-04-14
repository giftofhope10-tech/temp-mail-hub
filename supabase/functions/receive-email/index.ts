import { createClient } from "https://esm.sh/@supabase/supabase-js@2.103.0";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const WEBHOOK_SECRET = Deno.env.get("EMAIL_WEBHOOK_SECRET") || "";
const MIME_PATTERN = /(content-type:\s*(multipart\/|text\/plain|text\/html)|content-transfer-encoding:|^--[-\w.=]+$)/im;
const HTML_PATTERN = /<\/?[a-z][\s\S]*>/i;

function normalizeLineBreaks(value: string): string {
  return value.replace(/\r\n/g, "\n");
}

function decodeQuotedPrintable(value: string): string {
  const normalized = value.replace(/=\r?\n/g, "");
  const bytes: number[] = [];

  for (let i = 0; i < normalized.length; i += 1) {
    const current = normalized[i];
    const hex = normalized.slice(i + 1, i + 3);

    if (current === "=" && /^[0-9A-F]{2}$/i.test(hex)) {
      bytes.push(Number.parseInt(hex, 16));
      i += 2;
      continue;
    }

    const code = current.charCodeAt(0);
    if (code <= 0xff) {
      bytes.push(code);
    } else {
      bytes.push(...new TextEncoder().encode(current));
    }
  }

  return new TextDecoder().decode(new Uint8Array(bytes));
}

function decodeBase64(value: string): string {
  try {
    const binary = atob(value.replace(/\s+/g, ""));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return value;
  }
}

function decodeContent(value: string, encoding?: string): string {
  const normalizedEncoding = encoding?.trim().toLowerCase() ?? "";

  if (normalizedEncoding.includes("quoted-printable")) {
    return decodeQuotedPrintable(value);
  }

  if (normalizedEncoding.includes("base64")) {
    return decodeBase64(value);
  }

  if (/(=[0-9a-f]{2}|=\r?\n)/i.test(value)) {
    return decodeQuotedPrintable(value);
  }

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
  const boundaryFromHeaders = normalized.match(/boundary="?([^"\n;]+)"?/i)?.[1];
  const marker = boundaryFromHeaders ? `--${boundaryFromHeaders}` : normalized.match(/^(--[^\n]+)$/m)?.[1];

  if (!marker) return [normalized];

  return normalized
    .split(marker)
    .map((section) => section.trim())
    .filter((section) => section && section !== "--");
}

function extractMimePart(raw: string, mimeType: "text/html" | "text/plain"): string {
  const sections = splitMimeSections(raw);

  for (const section of sections) {
    const cleanedSection = section.replace(/^--$/, "").trim();
    if (!cleanedSection) continue;

    const [headers, ...bodyParts] = cleanedSection.split(/\n\n/);
    if (!headers || bodyParts.length === 0) continue;
    if (!new RegExp(`content-type:\\s*${mimeType}`, "i").test(headers)) continue;

    const transferEncoding = headers.match(/content-transfer-encoding:\s*([^\n;]+)/i)?.[1];
    const body = bodyParts.join("\n\n").trim();
    return decodeContent(body, transferEncoding).trim();
  }

  return "";
}

function parseIncomingEmailContent(text?: string, html?: string) {
  const textSource = text?.trim() ?? "";
  const htmlSource = html?.trim() ?? "";

  if (htmlSource && !MIME_PATTERN.test(htmlSource)) {
    return {
      text: textSource && !MIME_PATTERN.test(textSource) ? decodeContent(textSource).trim() : htmlToText(htmlSource),
      html: htmlSource,
    };
  }

  const mimeSource = [htmlSource, textSource].find((value) => value && MIME_PATTERN.test(value)) ?? "";
  if (mimeSource) {
    const extractedHtml = extractMimePart(mimeSource, "text/html");
    const extractedText = extractMimePart(mimeSource, "text/plain");

    if (extractedHtml || extractedText) {
      return {
        text: extractedText || htmlToText(extractedHtml),
        html: extractedHtml,
      };
    }
  }

  if (textSource && HTML_PATTERN.test(textSource)) {
    return {
      text: htmlToText(textSource),
      html: textSource,
    };
  }

  return {
    text: decodeContent(textSource).trim(),
    html: htmlSource,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("x-webhook-secret");
    if (WEBHOOK_SECRET && authHeader !== WEBHOOK_SECRET) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { to, from, subject, text, html } = body;

    if (!to || !from) {
      return new Response(JSON.stringify({ error: "Missing required fields: to, from" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const recipientEmail = Array.isArray(to) ? to[0] : to;
    const normalizedRecipient = typeof recipientEmail === "string"
      ? recipientEmail.toLowerCase()
      : recipientEmail?.address?.toLowerCase?.() ?? "";

    const { data: tempEmail, error: lookupError } = await supabase
      .from("temp_emails")
      .select("id, expires_at")
      .eq("email_address", normalizedRecipient)
      .single();

    if (lookupError || !tempEmail) {
      console.log(`No temp email found for: ${normalizedRecipient}`);
      return new Response(JSON.stringify({ error: "Recipient not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (new Date(tempEmail.expires_at) < new Date()) {
      console.log(`Temp email expired: ${normalizedRecipient}`);
      return new Response(JSON.stringify({ error: "Email address expired" }), {
        status: 410,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsedContent = parseIncomingEmailContent(text, html);
    const sender = typeof from === "string" ? from : from?.address || from?.[0] || "Unknown sender";

    const { error: insertError } = await supabase
      .from("received_emails")
      .insert({
        temp_email_id: tempEmail.id,
        from_address: sender,
        subject: subject || "(No Subject)",
        body_text: parsedContent.text,
        body_html: parsedContent.html,
      });

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to store email" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Email stored for ${normalizedRecipient} from ${sender}`);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error processing email:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
