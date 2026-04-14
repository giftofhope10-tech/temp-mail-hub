export interface ParsedEmailContent {
  html: string;
  text: string;
}

const MIME_PATTERN = /(content-type:\s*(multipart\/|text\/plain|text\/html)|content-transfer-encoding:|^--[-\w.=]+$)/im;
const HTML_PATTERN = /<\/?[a-z][\s\S]*>/i;

const HTML_ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

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

function decodeHtmlEntities(value: string): string {
  return value.replace(/&nbsp;|&amp;|&lt;|&gt;|&quot;|&#39;/g, (entity) => HTML_ENTITIES[entity] ?? entity);
}

function htmlToText(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|section|article|li|tr|blockquote|h[1-6])>/gi, "\n")
      .replace(/<li[^>]*>/gi, "• ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/ *\n */g, "\n")
    .trim();
}

function splitMimeSections(raw: string): string[] {
  const normalized = normalizeLineBreaks(raw);
  const boundaryFromHeaders = normalized.match(/boundary="?([^"\n;]+)"?/i)?.[1];
  const marker = boundaryFromHeaders
    ? `--${boundaryFromHeaders}`
    : normalized.match(/^(--[^\n]+)$/m)?.[1];

  if (!marker) {
    return [normalized];
  }

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

function extractSinglePart(raw: string): ParsedEmailContent {
  const normalized = normalizeLineBreaks(raw);
  const [headers, ...bodyParts] = normalized.split(/\n\n/);

  if (!headers || bodyParts.length === 0) {
    const text = decodeContent(normalized).trim();
    return { html: HTML_PATTERN.test(text) ? text : "", text: HTML_PATTERN.test(text) ? htmlToText(text) : text };
  }

  const contentType = headers.match(/content-type:\s*([^\n;]+)/i)?.[1]?.toLowerCase() ?? "";
  const transferEncoding = headers.match(/content-transfer-encoding:\s*([^\n;]+)/i)?.[1];
  const body = decodeContent(bodyParts.join("\n\n"), transferEncoding).trim();

  if (contentType.includes("text/html") || HTML_PATTERN.test(body)) {
    return { html: body, text: htmlToText(body) };
  }

  return { html: "", text: body };
}

function looksLikeMime(value: string): boolean {
  return MIME_PATTERN.test(value);
}

export function parseStoredEmailContent(bodyText?: string | null, bodyHtml?: string | null): ParsedEmailContent {
  const textSource = bodyText?.trim() ?? "";
  const htmlSource = bodyHtml?.trim() ?? "";

  if (htmlSource && !looksLikeMime(htmlSource)) {
    return {
      html: htmlSource,
      text: textSource && !looksLikeMime(textSource) ? decodeContent(textSource).trim() : htmlToText(htmlSource),
    };
  }

  const mimeSource = [htmlSource, textSource].find((value) => value && looksLikeMime(value)) ?? "";

  if (mimeSource) {
    const html = extractMimePart(mimeSource, "text/html");
    const text = extractMimePart(mimeSource, "text/plain");

    if (html || text) {
      return {
        html,
        text: text || htmlToText(html),
      };
    }

    return extractSinglePart(mimeSource);
  }

  if (textSource && HTML_PATTERN.test(textSource)) {
    return {
      html: textSource,
      text: htmlToText(textSource),
    };
  }

  return {
    html: htmlSource,
    text: decodeContent(textSource).trim(),
  };
}
