const categoryRepository = require("../dao/categoryRepository");

async function listCategories(flat = true, pagination = {}, filters = {}) {
  return categoryRepository.list(flat, pagination, filters);
}

async function getCategoryById(id) {
  return categoryRepository.getById(id);
}

async function createCategory(data) {
  return categoryRepository.create(data);
}

async function updateCategory(id, data) {
  return categoryRepository.update(id, data);
}

async function deleteCategory(id) {
  return categoryRepository.remove(id);
}

module.exports = {
  listCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
};
