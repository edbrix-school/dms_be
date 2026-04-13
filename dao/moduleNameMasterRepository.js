const { Op } = require("sequelize");
const { ModuleNameMaster, CategoryTypeMaster } = require("../models");

const includeCategoryType = [{ model: CategoryTypeMaster, as: "category_type", attributes: ["category_type_id", "name"], required: false }];

async function list(category_type_id = null) {
  const where = {};
  if (category_type_id != null) where.category_type_id = category_type_id;

  const rows = await ModuleNameMaster.findAll({
    where,
    include: includeCategoryType,
    order: [["module_id", "DESC"]],
  });
  return rows.map((row) => row.toJSON());
}

async function getById(id) {
  const row = await ModuleNameMaster.findByPk(id, { include: includeCategoryType });
  return row ? row.toJSON() : null;
}

async function getByNameAndCategoryType(name, category_type_id) {
  const trimmed = String(name || "").trim();
  if (!trimmed || category_type_id == null) return null;
  const row = await ModuleNameMaster.findOne({
    where: {
      category_type_id,
      name: { [Op.iLike]: trimmed },
    },
  });
  return row ? row.toJSON() : null;
}

async function create(data) {
  const categoryType = await CategoryTypeMaster.findByPk(data.category_type_id);
  if (!categoryType) throw new Error("Invalid category_type_id.");

  const trimmed = String(data.name || "").trim();
  const existing = await getByNameAndCategoryType(trimmed, data.category_type_id);
  if (existing) throw new Error("A module name with this name already exists for the selected category type.");

  const row = await ModuleNameMaster.create({
    category_type_id: data.category_type_id,
    name: trimmed,
  });
  return getById(row.module_id);
}

async function update(id, data) {
  const current = await getById(id);
  if (!current) return null;

  const categoryTypeId = Number(data.category_type_id);
  const categoryType = await CategoryTypeMaster.findByPk(categoryTypeId);
  if (!categoryType) throw new Error("Invalid category_type_id.");

  const trimmed = String(data.name || "").trim();
  const duplicate = await getByNameAndCategoryType(trimmed, categoryTypeId);
  if (duplicate && String(duplicate.module_id) !== String(id)) {
    throw new Error("A module name with this name already exists for the selected category type.");
  }

  await ModuleNameMaster.update(
    { category_type_id: categoryTypeId, name: trimmed },
    { where: { module_id: id } }
  );
  return getById(id);
}

async function remove(id) {
  const count = await ModuleNameMaster.destroy({ where: { module_id: id } });
  return count > 0;
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
};
