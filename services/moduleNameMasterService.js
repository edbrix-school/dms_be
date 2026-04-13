const moduleNameMasterRepository = require("../dao/moduleNameMasterRepository");

async function listModuleNames(category_type_id) {
  return moduleNameMasterRepository.list(category_type_id);
}

async function getModuleNameById(id) {
  return moduleNameMasterRepository.getById(id);
}

async function createModuleName(data) {
  return moduleNameMasterRepository.create(data);
}

async function updateModuleName(id, data) {
  return moduleNameMasterRepository.update(id, data);
}

async function deleteModuleName(id) {
  return moduleNameMasterRepository.remove(id);
}

module.exports = {
  listModuleNames,
  getModuleNameById,
  createModuleName,
  updateModuleName,
  deleteModuleName,
};
