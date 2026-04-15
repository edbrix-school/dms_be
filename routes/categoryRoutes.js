const express = require("express");
const categoryService = require("../services/categoryService");
const { verifyAuth } = require("../middleware/auth");
const Util = require("../common/Util");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const flat = req.query.flat !== "false";
    const name = String(req.query.name || "").trim();
    const pageNum = Number.parseInt(req.query.page, 10);
    const limitNum = Number.parseInt(req.query.limit, 10);
    const pagination =
      flat && Number.isInteger(pageNum) && pageNum > 0 && Number.isInteger(limitNum) && limitNum > 0
        ? { page: pageNum, limit: limitNum }
        : {};
    const list = await categoryService.listCategories(flat, pagination, { name });
    return res.status(200).json(Util.getSuccessResponse(list));
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const category = await categoryService.getCategoryById(req.params.id);
    if (!category) return res.status(404).json({ success: false, message: "Category not found." });
    return res.status(200).json(Util.getSuccessResponse(category));
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

router.post("/", verifyAuth, async (req, res) => {
  const errors = Util.validate_prams(req.body, { name: "ANY" }, { name: "Name" });
  if (Object.keys(errors).length > 0) {
    return res.status(422).json(Util.getErrorResponse(errors));
  }
  try {
    const category = await categoryService.createCategory(req.body);
    return res.status(201).json(Util.getSuccessResponse(category, "Category created."));
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

router.put("/:id", verifyAuth, async (req, res) => {
  const errors = Util.validate_prams(req.body, { name: "ANY" }, { name: "Name" });
  if (Object.keys(errors).length > 0) {
    return res.status(422).json(Util.getErrorResponse(errors));
  }
  try {
    const category = await categoryService.updateCategory(req.params.id, req.body);
    return res.status(200).json(Util.getSuccessResponse(category, "Category updated."));
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

router.delete("/:id", verifyAuth, async (req, res) => {
  try {
    await categoryService.deleteCategory(req.params.id);
    return res.status(200).json(Util.getSuccessResponse(null, "Category deleted."));
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
