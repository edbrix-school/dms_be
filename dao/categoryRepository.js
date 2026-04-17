const { Op } = require("sequelize");
const { Category, Document, CategoryTypeMaster } = require("../models");

const categoryInclude = [
  { model: CategoryTypeMaster, as: "category_type", attributes: ["category_type_id", "name"], required: false },
];

function mapCategory(row) {
  const json = row.toJSON();
  json.category_type = json.category_type || null;
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

async function validateCategoryTypeAndModule(category_type_id) {
  if (category_type_id == null) {
    throw new Error("category_type_id is required together.");
  }
}

async function list(flat = true, pagination = {}, filters = {}) {
  const order = [["sort_order", "ASC"], ["category_id", "DESC"]];
  const where = {};
  const trimmedName = String(filters.name || "").trim();
  if (trimmedName) {
    where.name = { [Op.iLike]: `%${trimmedName}%` };
  }
  const paginated = flat && pagination && pagination.page != null && pagination.limit != null;

  if (paginated) {
    const { page, limit } = pagination;
    const { rows, count } = await Category.findAndCountAll({
      where,
      include: categoryInclude,
      order,
      limit,
      offset: (page - 1) * limit,
    });
    return { rows: rows.map(mapCategory), count, page, limit };
  }

  const categories = await Category.findAll({
    where,
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
  await validateCategoryTypeAndModule(categoryTypeId);

  const c = await Category.create({
    name: trimmedName,
    description: data.description || null,
    parent_id: data.parent_id || null,
    category_type_id: categoryTypeId,
    doc_id: data.doc_id != null ? String(data.doc_id).trim() || null : null,
    module_name: data.module_name != null ? String(data.module_name).trim() || null : null,
    screen_name: data.screen_name != null ? String(data.screen_name).trim() || null : null,
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
  await validateCategoryTypeAndModule(categoryTypeId);

  await Category.update(
    {
      name: trimmedName,
      description: data.description || null,
      parent_id: data.parent_id || null,
      category_type_id: categoryTypeId,
      doc_id: data.doc_id != null ? String(data.doc_id).trim() || null : null,
      module_name: data.module_name != null ? String(data.module_name).trim() || null : null,
      screen_name: data.screen_name != null ? String(data.screen_name).trim() || null : null,
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
