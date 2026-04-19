const fs = require("fs").promises;
const path = require("path");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");

require("dotenv").config();

const DEFAULT_MAX_CHARS = 250000;
const DEFAULT_MAX_FILE_BYTES = 50 * 1024 * 1024;

function getMaxChars() {
  const n = Number(process.env.EXTRACTION_MAX_CHARS);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 2_000_000) : DEFAULT_MAX_CHARS;
}

function getMaxFileBytes() {
  const n = Number(process.env.EXTRACTION_MAX_FILE_BYTES);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_FILE_BYTES;
}

function truncate(str, max) {
  if (str == null) return "";
  const s = String(str);
  return s.length <= max ? s : s.slice(0, max);
}

/**
 * Extract plain text from a multer temp file for indexing (S3/ES path).
 * Never throws; returns "" on unsupported types or errors.
 * @param {{ path: string, mimetype?: string, originalname?: string }} file
 * @returns {Promise<string>}
 */
async function extractText(file) {
  const filePath = file && file.path;
  if (!filePath) return "";

  const maxChars = getMaxChars();
  const maxBytes = getMaxFileBytes();

  try {
    const stat = await fs.stat(filePath);
    if (stat.size > maxBytes) {
      return "";
    }
  } catch (err) {
    return "";
  }

  const mime = (file.mimetype || "").toLowerCase();
  const ext = path.extname(file.originalname || "").toLowerCase();

  try {
    if (mime === "application/pdf" || ext === ".pdf") {
      const buf = await fs.readFile(filePath);
      const data = await pdfParse(buf);
      return truncate(data.text, maxChars);
    }

    if (
      mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      ext === ".docx"
    ) {
      const result = await mammoth.extractRawText({ path: filePath });
      return truncate(result.value, maxChars);
    }

    if (
      mime.startsWith("text/") ||
      mime === "application/csv" ||
      ext === ".txt" ||
      ext === ".csv" ||
      ext === ".md" ||
      ext === ".json" ||
      ext === ".xml" ||
      ext === ".log"
    ) {
      const raw = await fs.readFile(filePath, "utf8");
      return truncate(raw, maxChars);
    }
  } catch (err) {
    console.warn("extractText: failed for", file.originalname || filePath, err.message);
    return "";
  }

  return "";
}

module.exports = {
  extractText,
};
