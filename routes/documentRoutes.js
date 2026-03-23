const express = require("express");
const multer = require("multer");
const path = require("path");
const documentService = require("../services/documentService");
const { verifyAuth } = require("../middleware/auth");
const Util = require("../common/Util");

const router = express.Router();
const upload = multer({ dest: path.join(__dirname, "../uploads") });

router.post(
  "/",
  verifyAuth,
  upload.fields([{ name: "files", maxCount: 10 }, { name: "cover_image", maxCount: 1 }]),
  async (req, res) => {
  const errors = Util.validate_prams(req.body, { title: "ANY" }, { title: "Title" });
  if (Object.keys(errors).length > 0) {
    return res.status(422).json(Util.getErrorResponse(errors));
  }
  const userId = req.user.user_id;
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

router.post("/search", verifyAuth, async (req, res) => {
  try {
    const result = await documentService.searchDocuments(req.body, req.user);
    return res.status(200).json(Util.getSuccessResponse(result));
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

router.put("/:id", verifyAuth, async (req, res) => {
  const errors = Util.validate_prams(req.body, { title: "ANY" }, { title: "Title" });
  if (Object.keys(errors).length > 0) {
    return res.status(422).json(Util.getErrorResponse(errors));
  }
  try {
    const document = await documentService.updateDocument(req.params.id, req.body, req.user.user_id);
    return res.status(200).json(Util.getSuccessResponse(document, "Document updated."));
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

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
