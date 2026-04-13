const moduleNameMasterService = require("../services/moduleNameMasterService");
const Util = require("../common/Util");

async function list(req, res) {
  try {
    const categoryTypeId = req.query.category_type_id != null ? Number.parseInt(req.query.category_type_id, 10) : null;
    if (req.query.category_type_id != null && (!Number.isInteger(categoryTypeId) || categoryTypeId <= 0)) {
      return res.status(400).json({ success: false, message: "category_type_id must be a positive integer." });
    }
    const rows = await moduleNameMasterService.listModuleNames(categoryTypeId);
    return res.status(200).json(Util.getSuccessResponse(rows));
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function getById(req, res) {
  try {
    const row = await moduleNameMasterService.getModuleNameById(req.params.id);
    if (!row) return res.status(404).json({ success: false, message: "Module name not found." });
    return res.status(200).json(Util.getSuccessResponse(row));
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function create(req, res) {
  const errors = Util.validate_prams(
    req.body,
    { name: "ANY", category_type_id: "N" },
    { name: "Name", category_type_id: "Category Type ID" }
  );
  if (Object.keys(errors).length > 0) {
    return res.status(422).json(Util.getErrorResponse(errors));
  }
  try {
    const row = await moduleNameMasterService.createModuleName({
      name: req.body.name,
      category_type_id: Number(req.body.category_type_id),
    });
    return res.status(201).json(Util.getSuccessResponse(row, "Module name created."));
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function update(req, res) {
  const errors = Util.validate_prams(
    req.body,
    { name: "ANY", category_type_id: "N" },
    { name: "Name", category_type_id: "Category Type ID" }
  );
  if (Object.keys(errors).length > 0) {
    return res.status(422).json(Util.getErrorResponse(errors));
  }
  try {
    const row = await moduleNameMasterService.updateModuleName(req.params.id, {
      name: req.body.name,
      category_type_id: Number(req.body.category_type_id),
    });
    if (!row) return res.status(404).json({ success: false, message: "Module name not found." });
    return res.status(200).json(Util.getSuccessResponse(row, "Module name updated."));
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function remove(req, res) {
  try {
    const existing = await moduleNameMasterService.getModuleNameById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: "Module name not found." });
    await moduleNameMasterService.deleteModuleName(req.params.id);
    return res.status(200).json(Util.getSuccessResponse(null, "Module name deleted."));
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
