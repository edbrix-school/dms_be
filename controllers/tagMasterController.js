const tagMasterService = require("../services/tagMasterService");
const Util = require("../common/Util");

async function list(req, res) {
  try {
    const list = await tagMasterService.listTags();
    return res.status(200).json(Util.getSuccessResponse(list));
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  } 
}

async function getById(req, res) {
  try {
    const tag = await tagMasterService.getTagById(req.params.id);
    if (!tag) return res.status(404).json({ success: false, message: "Tag not found." });
    return res.status(200).json(Util.getSuccessResponse(tag));
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
    const tag = await tagMasterService.createTag(req.body);
    return res.status(201).json(Util.getSuccessResponse(tag, "Tag created."));
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
    const tag = await tagMasterService.updateTag(req.params.id, req.body);
    if (!tag) return res.status(404).json({ success: false, message: "Tag not found." });
    return res.status(200).json(Util.getSuccessResponse(tag, "Tag updated."));
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function remove(req, res) {
  try {
    const existing = await tagMasterService.getTagById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: "Tag not found." });
    await tagMasterService.deleteTag(req.params.id);
    return res.status(200).json(Util.getSuccessResponse(null, "Tag deleted."));
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
