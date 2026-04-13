const categoryTypeMasterRepository = require("../dao/categoryTypeMasterRepository");

async function listCategoryTypes() {
  return categoryTypeMasterRepository.list();
}

async function getCategoryTypeById(id) {
  return categoryTypeMasterRepository.getById(id);
}

async function createCategoryType(data) {
  return categoryTypeMasterRepository.create(data);
}

async function updateCategoryType(id, data) {
  return categoryTypeMasterRepository.update(id, data);
}

async function deleteCategoryType(id) {
  return categoryTypeMasterRepository.remove(id);
}

module.exports = {
  listCategoryTypes,
  getCategoryTypeById,
  createCategoryType,
  updateCategoryType,
  deleteCategoryType,
};
