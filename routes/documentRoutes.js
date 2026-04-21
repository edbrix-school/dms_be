const express = require("express");
const multer = require("multer");
const path = require("path");
const documentService = require("../services/documentService");
const { verifyAuth } = require("../middleware/auth");
const Util = require("../common/Util");
const { convertEmlBufferToHtml } = require("../common/emlPreview");

const router = express.Router();
const upload = multer({ dest: path.join(__dirname, "../uploads") });

function getFileExtension(filename = "", fileType = "") {
  const fromName = String(filename).split(".").pop();
  return String(fromName || fileType || "").trim().toLowerCase();
}

function getResponseContentType(result) {
  const extension = getFileExtension(result?.filename, result?.file_type);
  const contentTypes = {
    pdf: "application/pdf",
    csv: "text/csv",
    txt: "text/plain; charset=utf-8",
    rtf: "application/rtf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    eml: "message/rfc822",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    bmp: "image/bmp",
    webp: "image/webp",
    svg: "image/svg+xml",
    mp4: "video/mp4",
    webm: "video/webm",
    ogg: "video/ogg",
    mov: "video/quicktime",
  };

  return contentTypes[extension] || "application/octet-stream";
}

router.post(
  "/",
  verifyAuth,
  upload.fields([{ name: "files", maxCount: 10 }, { name: "cover_image", maxCount: 1 }]),
  async (req, res) => {
    const errors = Util.validate_prams(req.body, { title: "ANY" }, { title: "Title" });
    if (Object.keys(errors).length > 0) {
      return res.status(422).json(Util.getErrorResponse(errors));
    }
    const userId = req?.user?.user_id || 5;
    req.body.created_by = userId;
    try {
      const document = await documentService.createDocument(req, req.body, userId);
      return res.status(200).json(Util.getSuccessResponse(document, "Document created."));
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
);

router.get("/", verifyAuth, async (req, res) => {
  try {
    const filters = {
      page: req.query.page || 1,
      limit: req.query.limit || 20,
      category_id: req.query.category_id,
      sort: req.query.sort || "created_at",
      order: req.query.order || "DESC",
    };
    const result = await documentService.listDocuments(filters, req.user);
    return res.status(200).json(Util.getSuccessResponse(result));
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

router.get("/stats/summary", verifyAuth, async (req, res) => {
  try {
    const data = await documentService.getFileStatsSummary();
    return res.status(200).json(Util.getSuccessResponse(data));
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

router.get("/stats/by-distribution", verifyAuth, async (req, res) => {
  try {
    const data = await documentService.getFilesByDistributionAndType();
    return res.status(200).json(Util.getSuccessResponse(data));
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

router.post("/search", verifyAuth, async (req, res) => {
  try {
    const result = await documentService.searchDocuments(req.body, req.user);
    return res.status(200).json(Util.getSuccessResponse(result));
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

router.get("/:id", verifyAuth, async (req, res) => {
  try {
    const document = await documentService.getDocumentById(req.params.id);
    if (!document) return res.status(404).json({ success: false, message: "Document not found." });
    return res.status(200).json(Util.getSuccessResponse(document));
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

router.get("/:id/files/:fileId/content", verifyAuth, async (req, res) => {
  try {
    const result = await documentService.getFileContent(req.params.id, req.params.fileId);
    if (!result) return res.status(404).json({ success: false, message: "File not found." });
    res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    res.setHeader("Content-Type", "application/octet-stream");
    return res.send(result.buffer);
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

router.get("/:id/files/:fileId/open", verifyAuth, async (req, res) => {
  try {
    const result = await documentService.getFileContent(req.params.id, req.params.fileId);
    if (!result) return res.status(404).json({ success: false, message: "File not found." });
    const extension = getFileExtension(result.filename, result.file_type);
    const isEmailFile =
      extension === "eml" || String(result.media_type || "").toLowerCase() === "message/rfc822";
    const isOfficeFile = ["doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(extension);
    res.setHeader(
      "Content-Disposition",
      `${isEmailFile || isOfficeFile ? "attachment" : "inline"}; filename="${result.filename}"`
    );
    res.setHeader("Content-Type", getResponseContentType(result));
    return res.send(result.buffer);
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

router.get("/:id/files/:fileId/preview", verifyAuth, async (req, res) => {
  try {
    const result = await documentService.getFileContent(req.params.id, req.params.fileId);
    if (!result) return res.status(404).json({ success: false, message: "File not found." });

    const extension = getFileExtension(result.filename, result.file_type);
    if (extension !== "eml") {
      return res.status(400).json({ success: false, message: "Preview is supported only for .eml files." });
    }

    const html = convertEmlBufferToHtml(result.buffer);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(html);
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

router.put(
  "/:id",
  verifyAuth,
  upload.fields([{ name: "files", maxCount: 10 }, { name: "cover_image", maxCount: 1 }]),
  async (req, res) => {
  const errors = Util.validate_prams(req.body, { title: "ANY" }, { title: "Title" });
  if (Object.keys(errors).length > 0) {
    return res.status(422).json(Util.getErrorResponse(errors));
  }
  try {
    req.body.files = req.files;
    const document = await documentService.updateDocument(req.params.id, req.body, 5); //req.user.user_id
    return res.status(200).json(Util.getSuccessResponse(document, "Document updated."));
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}
);

router.delete("/:id", verifyAuth, async (req, res) => {
  try {
    const existing = await documentService.getDocumentById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: "Document not found." });
    await documentService.deleteDocument(req.params.id);
    return res.status(200).json(Util.getSuccessResponse(null, "Document deleted."));
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
