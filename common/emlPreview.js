function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeNewlines(value = "") {
  return String(value).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function parseHeaders(headerText = "") {
  const headers = {};
  let currentKey = null;

  for (const rawLine of normalizeNewlines(headerText).split("\n")) {
    if (!rawLine) continue;

    if (/^\s/.test(rawLine) && currentKey) {
      headers[currentKey] = `${headers[currentKey]} ${rawLine.trim()}`.trim();
      continue;
    }

    const separatorIndex = rawLine.indexOf(":");
    if (separatorIndex === -1) continue;

    const key = rawLine.slice(0, separatorIndex).trim().toLowerCase();
    const value = rawLine.slice(separatorIndex + 1).trim();
    currentKey = key;
    headers[key] = value;
  }

  return headers;
}

function splitHeadersAndBody(raw = "") {
  const normalized = normalizeNewlines(raw);
  const separatorIndex = normalized.indexOf("\n\n");

  if (separatorIndex === -1) {
    return {
      headerText: normalized,
      bodyText: "",
    };
  }

  return {
    headerText: normalized.slice(0, separatorIndex),
    bodyText: normalized.slice(separatorIndex + 2),
  };
}

function stripQuotes(value = "") {
  return String(value).replace(/^["']|["']$/g, "");
}

function getBoundary(contentType = "") {
  const match = String(contentType).match(/boundary="?([^";]+)"?/i);
  return match ? stripQuotes(match[1]) : null;
}

function getCharset(contentType = "") {
  const match = String(contentType).match(/charset="?([^";]+)"?/i);
  return match ? stripQuotes(match[1]).toLowerCase() : "utf-8";
}

function normalizeContentId(value = "") {
  return String(value).trim().replace(/^<|>$/g, "").toLowerCase();
}

function getMimeType(contentType = "") {
  return String(contentType).split(";")[0].trim().toLowerCase();
}

function getContentTransferEncoding(headers) {
  return String(headers["content-transfer-encoding"] || "").trim().toLowerCase();
}

function decodeTransferEncodingToBuffer(content = "", encoding = "") {
  const normalizedEncoding = String(encoding).trim().toLowerCase();

  if (normalizedEncoding === "base64") {
    const compact = String(content).replace(/\s/g, "");
    try {
      return Buffer.from(compact, "base64");
    } catch (_) {
      return Buffer.from(String(content), "utf8");
    }
  }

  if (normalizedEncoding === "quoted-printable") {
    const normalized = String(content).replace(/=\r?\n/g, "");
    const bytes = [];

    for (let index = 0; index < normalized.length; index += 1) {
      const current = normalized[index];
      if (
        current === "=" &&
        /^[A-Fa-f0-9]{2}$/.test(normalized.slice(index + 1, index + 3))
      ) {
        bytes.push(parseInt(normalized.slice(index + 1, index + 3), 16));
        index += 2;
        continue;
      }

      bytes.push(current.charCodeAt(0));
    }

    return Buffer.from(bytes);
  }

  return Buffer.from(String(content), "utf8");
}

function decodeBodyBuffer(buffer, charset = "utf-8") {
  const normalizedCharset = String(charset || "utf-8").toLowerCase();

  if (normalizedCharset === "utf-8" || normalizedCharset === "utf8") {
    return buffer.toString("utf8");
  }

  return buffer.toString("latin1");
}

function decodeMimeWords(value = "") {
  return String(value).replace(
    /=\?([^?]+)\?([bqBQ])\?([^?]+)\?=/g,
    (_, charset, encoding, encodedText) => {
      try {
        const normalizedCharset = String(charset || "utf-8").toLowerCase();

        if (String(encoding).toLowerCase() === "b") {
          const buffer = Buffer.from(encodedText, "base64");
          return buffer.toString(normalizedCharset === "utf-8" ? "utf8" : "latin1");
        }

        const qpText = String(encodedText)
          .replace(/_/g, " ")
          .replace(/=([A-Fa-f0-9]{2})/g, (_, hex) =>
            String.fromCharCode(parseInt(hex, 16)),
          );
        return Buffer.from(qpText, "binary").toString(
          normalizedCharset === "utf-8" ? "utf8" : "latin1",
        );
      } catch (_) {
        return String(encodedText);
      }
    },
  );
}

function decodeTransferEncoding(content = "", encoding = "") {
  return decodeTransferEncodingToBuffer(content, encoding).toString("utf8");
}

function parseMimeSection(section = "") {
  const { headerText, bodyText } = splitHeadersAndBody(section);
  const headers = parseHeaders(headerText);
  const contentType = String(headers["content-type"] || "text/plain");
  const charset = getCharset(contentType);
  const transferEncoding = getContentTransferEncoding(headers);
  const bodyBuffer = decodeTransferEncodingToBuffer(bodyText, transferEncoding);
  const mimeType = getMimeType(contentType);
  const body = decodeBodyBuffer(bodyBuffer, charset);

  return {
    headers: Object.fromEntries(
      Object.entries(headers).map(([key, value]) => [key, decodeMimeWords(value)]),
    ),
    contentType,
    mimeType,
    contentId: normalizeContentId(headers["content-id"] || ""),
    contentDisposition: String(headers["content-disposition"] || "").toLowerCase(),
    body:
      charset === "utf-8" || charset === "utf8"
        ? body
        : Buffer.from(body, "binary").toString("latin1"),
    bodyBuffer,
  };
}

function parseMultipartBody(bodyText = "", boundary) {
  if (!boundary) {
    return [];
  }

  const normalized = normalizeNewlines(bodyText);
  const parts = normalized
    .split(`--${boundary}`)
    .map((part) => part.trim())
    .filter((part) => part && part !== "--");

  return parts.map((part) => parseMimeSection(part));
}

function parseMimeTree(section = "") {
  const part = typeof section === "string" ? parseMimeSection(section) : section;

  if (!part.mimeType.startsWith("multipart/")) {
    return part;
  }

  const boundary = getBoundary(part.contentType);
  return {
    ...part,
    parts: parseMultipartBody(part.body, boundary).map((child) =>
      parseMimeTree(child),
    ),
  };
}

function flattenMimeTree(part) {
  if (!part) {
    return [];
  }

  if (!part.parts) {
    return [part];
  }

  return part.parts.flatMap((child) => flattenMimeTree(child));
}

function getPartTextValue(part) {
  if (!part) {
    return null;
  }

  if (typeof part.body === "string" && part.body.trim()) {
    return part.body;
  }

  return null;
}

function getHtmlAndTextParts(partTree) {
  const parts = flattenMimeTree(partTree);
  const htmlPart = parts.find((part) => part.mimeType.includes("text/html"));
  const textPart = parts.find((part) => part.mimeType.includes("text/plain"));

  return {
    html: getPartTextValue(htmlPart),
    text: getPartTextValue(textPart),
    attachments: parts.filter(
      (part) =>
        part !== htmlPart &&
        part !== textPart &&
        part.contentId &&
        part.bodyBuffer &&
        !part.mimeType.startsWith("multipart/"),
    ),
  };
}

function inlineCidImages(html = "", attachments = []) {
  if (!html || !attachments.length) {
    return html;
  }

  const attachmentMap = new Map(
    attachments.map((part) => [part.contentId, part]),
  );

  return String(html).replace(
    /cid:([^"]+?)(?=["'\s>])/gi,
    (match, cidReference) => {
      const normalizedCid = normalizeContentId(cidReference);
      const attachment = attachmentMap.get(normalizedCid);

      if (!attachment) {
        return match;
      }

      const base64 = attachment.bodyBuffer.toString("base64");
      return `data:${attachment.mimeType};base64,${base64}`;
    },
  );
}

function getBestBody(headers, bodyText) {
  const contentType = String(headers["content-type"] || "text/plain");

  if (!contentType.toLowerCase().includes("multipart/")) {
    return {
      html: contentType.toLowerCase().includes("text/html") ? bodyText : null,
      text: contentType.toLowerCase().includes("text/html") ? null : bodyText,
    };
  }

  const boundary = getBoundary(contentType);
  const parts = parseMultipartBody(bodyText, boundary);
  const htmlPart = parts.find((part) =>
    String(part.contentType).toLowerCase().includes("text/html"),
  );
  const textPart = parts.find((part) =>
    String(part.contentType).toLowerCase().includes("text/plain"),
  );

  return {
    html: htmlPart?.body || null,
    text: textPart?.body || null,
  };
}

function sanitizeEmailHtml(html = "") {
  return String(html)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\son[a-z]+=(['"])[\s\S]*?\1/gi, "")
    .replace(/<a\b([^>]*)>/gi, (match, attributes) => {
      const hasTarget = /\starget=/i.test(attributes);
      const hasRel = /\srel=/i.test(attributes);
      const normalizedAttributes = attributes
        .replace(/\srel=(['"])([\s\S]*?)\1/i, (relMatch, quote, relValue) => {
          const tokens = new Set(
            String(relValue)
              .split(/\s+/)
              .filter(Boolean),
          );
          tokens.add("noopener");
          tokens.add("noreferrer");
          return ` rel=${quote}${Array.from(tokens).join(" ")}${quote}`;
        })
        .trim();

      return `<a${normalizedAttributes ? ` ${normalizedAttributes}` : ""}${hasTarget ? "" : ' target="_blank"'}${hasRel ? "" : ' rel="noopener noreferrer"'}>`;
    });
}

function buildPreviewDocument({ subject, from, to, date, htmlBody, textBody }) {
  const safeSubject = escapeHtml(subject || "(No subject)");
  const safeFrom = escapeHtml(from || "-");
  const safeTo = escapeHtml(to || "-");
  const safeDate = escapeHtml(date || "-");
  const bodyMarkup = htmlBody
    ? `<div class="message-html">${sanitizeEmailHtml(htmlBody)}</div>`
    : `<pre class="message-text">${escapeHtml(textBody || "No preview content available.")}</pre>`;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeSubject}</title>
    <style>
      body {
        margin: 0;
        font-family: Arial, sans-serif;
        background: #f8fafc;
        color: #0f172a;
      }
      .shell {
        padding: 16px;
      }
      .card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        overflow: hidden;
      }
      .meta {
        padding: 16px;
        border-bottom: 1px solid #e2e8f0;
        background: #f8fafc;
      }
      .meta-row {
        margin: 0 0 8px;
        font-size: 14px;
        line-height: 1.5;
      }
      .meta-row:last-child {
        margin-bottom: 0;
      }
      .label {
        display: inline-block;
        min-width: 64px;
        font-weight: 700;
      }
      .body {
        padding: 16px;
      }
      .message-text {
        white-space: pre-wrap;
        word-break: break-word;
        margin: 0;
        font-family: Consolas, monospace;
      }
      .message-html {
        overflow-wrap: anywhere;
      }
      .message-html img {
        max-width: 100%;
        height: auto;
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <div class="card">
        <div class="meta">
          <p class="meta-row"><span class="label">Subject</span>${safeSubject}</p>
          <p class="meta-row"><span class="label">From</span>${safeFrom}</p>
          <p class="meta-row"><span class="label">To</span>${safeTo}</p>
          <p class="meta-row"><span class="label">Date</span>${safeDate}</p>
        </div>
        <div class="body">${bodyMarkup}</div>
      </div>
    </div>
  </body>
</html>`;
}

function convertEmlBufferToHtml(buffer) {
  const raw = Buffer.isBuffer(buffer) ? buffer.toString("utf8") : String(buffer || "");
  const { headerText, bodyText } = splitHeadersAndBody(raw);
  const headers = Object.fromEntries(
    Object.entries(parseHeaders(headerText)).map(([key, value]) => [
      key,
      decodeMimeWords(value),
    ]),
  );
  const tree = parseMimeTree(`${headerText}\n\n${bodyText}`);
  const bestBody = getHtmlAndTextParts(tree);
  const htmlBody = bestBody.html ? inlineCidImages(bestBody.html, bestBody.attachments) : null;

  return buildPreviewDocument({
    subject: headers.subject,
    from: headers.from,
    to: headers.to,
    date: headers.date,
    htmlBody,
    textBody: bestBody.text,
  });
}

module.exports = {
  convertEmlBufferToHtml,
};
