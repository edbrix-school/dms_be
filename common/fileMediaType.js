/**
 * Classify uploaded file as image | video | audio | document | other from MIME type and extension.
 */
function inferMediaType(mimetype, filename) {
  const m = String(mimetype || "").toLowerCase();
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
  if (
    m.includes("pdf") ||
    m.includes("msword") ||
    m.includes("wordprocessingml") ||
    m.includes("spreadsheetml") ||
    m.includes("presentationml") ||
    m === "text/plain" ||
    m === "text/csv" ||
    m.includes("rtf")
  ) {
    return "document";
  }

  const ext = String(filename || "")
    .split(".")
    .pop()
    ?.toLowerCase();
  const imageExt = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico", "heic"];
  const videoExt = ["mp4", "webm", "mov", "avi", "mkv", "m4v", "wmv"];
  const audioExt = ["mp3", "wav", "ogg", "m4a", "flac", "aac"];
  const docExt = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "rtf", "odt", "ods"];

  if (ext && imageExt.includes(ext)) return "image";
  if (ext && videoExt.includes(ext)) return "video";
  if (ext && audioExt.includes(ext)) return "audio";
  if (ext && docExt.includes(ext)) return "document";

  return "other";
}

module.exports = { inferMediaType };
