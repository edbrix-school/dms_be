const tagMasterRepository = require("../dao/tagMasterRepository");

async function listTags(pagination = {}, filters = {}) {
  return tagMasterRepository.list(pagination, filters);
}

async function getTagById(id) {
  return tagMasterRepository.getById(id);
}

async function createTag(data) {
  const existing = await tagMasterRepository.getByName(data.name.trim());
  if (existing) {
    throw new Error("A tag with this name already exists.");
  }
  return tagMasterRepository.create({ name: data.name.trim() });
}

async function updateTag(id, data) {
  const trimmed = data.name.trim();
  const existing = await tagMasterRepository.getByName(trimmed);
  if (existing && String(existing.tag_id) !== String(id)) {
    throw new Error("A tag with this name already exists.");
  }
  return tagMasterRepository.update(id, { name: trimmed });
}

async function deleteTag(id) {
  return tagMasterRepository.remove(id);
}

module.exports = {
  listTags,
  getTagById,
  createTag,
  updateTag,
  deleteTag,
};
