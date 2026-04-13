const { Op } = require("sequelize");
const { Category, Document, CategoryTypeMaster, ModuleNameMaster } = require("../models");

const categoryInclude = [
  { model: CategoryTypeMaster, as: "category_type", attributes: ["category_type_id", "name"], required: false },
  { model: ModuleNameMaster, as: "module", attributes: ["module_id", "category_type_id", "name"], required: false },
];

function mapCategory(row) {
  const json = row.toJSON();
  json.category_type = json.category_type || null;
  json.module = json.module || null;
  return json;
}

function buildTree(arr) {
  const byId = {};
  arr.forEach((c) => {
    byId[c.category_id] = { ...c, children: [] };
  });
  const roots = [];
  arr.forEach((c) => {
    const node = byId[c.category_id];
    if (!c.parent_id) roots.push(node);
    else if (byId[c.parent_id]) byId[c.parent_id].children.push(node);
    else roots.push(node);
  });
  return roots;
}

async function validateCategoryTypeAndModule(category_type_id, module_id) {
  if ((category_type_id == null && module_id != null) || (category_type_id != null && module_id == null)) {
    throw new Error("Both category_type_id and module_id are required together.");
  }
  if (category_type_id == null && module_id == null) return;

  const categoryType = await CategoryTypeMaster.findByPk(category_type_id);
  if (!categoryType) throw new Error("Invalid category_type_id.");

  const moduleRow = await ModuleNameMaster.findByPk(module_id);
  if (!moduleRow) throw new Error("Invalid module_id.");
  if (String(moduleRow.category_type_id) !== String(category_type_id)) {
    throw new Error("Selected module_id does not belong to the provided category_type_id.");
  }
}

async function list(flat = true, pagination = {}) {
  const order = [["sort_order", "ASC"], ["category_id", "DESC"]];
  const paginated = flat && pagination && pagination.page != null && pagination.limit != null;

  if (paginated) {
    const { page, limit } = pagination;
    const { rows, count } = await Category.findAndCountAll({
      include: categoryInclude,
      order,
      limit,
      offset: (page - 1) * limit,
    });
    return { rows: rows.map(mapCategory), count, page, limit };
  }

  const categories = await Category.findAll({
    include: categoryInclude,
    order,
  });
  const arr = categories.map(mapCategory);
  if (flat) return arr;
  return buildTree(arr);
}

async function getById(id) {
  const c = await Category.findByPk(id, { include: categoryInclude });
  return c ? mapCategory(c) : null;
}

async function getByName(name) {
  const trimmedName = String(name || "").trim();
  if (!trimmedName) return null;
  const row = await Category.findOne({
    where: { name: { [Op.iLike]: trimmedName } },
  });
  return row ? row.toJSON() : null;
}

async function create(data) {
  const trimmedName = String(data.name || "").trim();
  const existing = await getByName(trimmedName);
  if (existing) {
    throw new Error("A category with this name already exists.");
  }

  const categoryTypeId = data.category_type_id != null ? Number(data.category_type_id) : null;
  const moduleId = data.module_id != null ? Number(data.module_id) : null;
  await validateCategoryTypeAndModule(categoryTypeId, moduleId);

  const c = await Category.create({
    name: trimmedName,
    description: data.description || null,
    parent_id: data.parent_id || null,
    category_type_id: categoryTypeId,
    module_id: moduleId,
    sort_order: data.sort_order != null ? data.sort_order : 0,
  });
  return getById(c.category_id);
}

async function update(id, data) {
  const existing = await getById(id);
  if (!existing) return null;

  const trimmedName = String(data.name || "").trim();
  const duplicate = await getByName(trimmedName);
  if (duplicate && String(duplicate.category_id) !== String(id)) {
    throw new Error("A category with this name already exists.");
  }

  const categoryTypeId = data.category_type_id != null ? Number(data.category_type_id) : null;
  const moduleId = data.module_id != null ? Number(data.module_id) : null;
  await validateCategoryTypeAndModule(categoryTypeId, moduleId);

  await Category.update(
    {
      name: trimmedName,
      description: data.description || null,
      parent_id: data.parent_id || null,
      category_type_id: categoryTypeId,
      module_id: moduleId,
      sort_order: data.sort_order != null ? data.sort_order : 0,
    },
    { where: { category_id: id } }
  );
  return getById(id);
}

async function remove(id) {
  const count = await Document.count({ where: { category_id: id } });
  if (count > 0) throw new Error("Category has documents; reassign or delete them first.");
  await Category.destroy({ where: { category_id: id } });
  return true;
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
};
