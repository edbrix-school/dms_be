const Category = require("../models/category");

async function list(flat = true) {
  const categories = await Category.findAll({
    order: [["sort_order", "ASC"], ["name", "ASC"]],
  });
  const arr = categories.map((c) => c.toJSON());
  if (flat) return arr;
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

async function getById(id) {
  const c = await Category.findByPk(id);
  return c ? c.toJSON() : null;
}

async function create(data) {
  const c = await Category.create({
    name: data.name,
    description: data.description || null,
    parent_id: data.parent_id || null,
    sort_order: data.sort_order != null ? data.sort_order : 0,
  });
  return c.toJSON();
}

async function update(id, data) {
  await Category.update(
    {
      name: data.name,
      description: data.description,
      parent_id: data.parent_id,
      sort_order: data.sort_order,
    },
    { where: { category_id: id } }
  );
  return getById(id);
}

async function remove(id) {
  const count = await require("../models/document").count({ where: { category_id: id } });
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
