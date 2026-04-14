const categoryTypeMasterService = require("../services/categoryTypeMasterService");
const Util = require("../common/Util");

async function list(req, res) {
  try {
    const pageNum = Number.parseInt(req.query.page, 10);
    const limitNum = Number.parseInt(req.query.limit, 10);
    const pagination =
      Number.isInteger(pageNum) && pageNum > 0 && Number.isInteger(limitNum) && limitNum > 0
        ? { page: pageNum, limit: limitNum }
        : {};
    const rows = await categoryTypeMasterService.listCategoryTypes(pagination);
    return res.status(200).json(Util.getSuccessResponse(rows));
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function getById(req, res) {
  try {
    const row = await categoryTypeMasterService.getCategoryTypeById(req.params.id);
    if (!row) return res.status(404).json({ success: false, message: "Category type not found." });
    return res.status(200).json(Util.getSuccessResponse(row));
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function create(req, res) {
  const errors = Util.validate_prams(req.body, { name: "ANY" }, { name: "Name" });
  if (Object.keys(errors).length > 0) {
    return res.status(422).json(Util.getErrorResponse(errors));
  }
  try {
    const row = await categoryTypeMasterService.createCategoryType(req.body);
    return res.status(201).json(Util.getSuccessResponse(row, "Category type created."));
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function update(req, res) {
  const errors = Util.validate_prams(req.body, { name: "ANY" }, { name: "Name" });
  if (Object.keys(errors).length > 0) {
    return res.status(422).json(Util.getErrorResponse(errors));
  }
  try {
    const row = await categoryTypeMasterService.updateCategoryType(req.params.id, req.body);
    if (!row) return res.status(404).json({ success: false, message: "Category type not found." });
    return res.status(200).json(Util.getSuccessResponse(row, "Category type updated."));
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function remove(req, res) {
  try {
    const existing = await categoryTypeMasterService.getCategoryTypeById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: "Category type not found." });
    await categoryTypeMasterService.deleteCategoryType(req.params.id);
    return res.status(200).json(Util.getSuccessResponse(null, "Category type deleted."));
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
};
