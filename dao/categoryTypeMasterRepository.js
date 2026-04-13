const { Op } = require("sequelize");
const { CategoryTypeMaster } = require("../models");

async function list() {
  const rows = await CategoryTypeMaster.findAll({
    order: [["category_type_id", "DESC"]],
  });
  return rows.map((row) => row.toJSON());
}

async function getById(id) {
  const row = await CategoryTypeMaster.findByPk(id);
  return row ? row.toJSON() : null;
}

async function getByName(name) {
  const trimmed = String(name || "").trim();
  if (!trimmed) return null;
  const row = await CategoryTypeMaster.findOne({
    where: { name: { [Op.iLike]: trimmed } },
  });
  return row ? row.toJSON() : null;
}

async function create(data) {
  const trimmed = String(data.name || "").trim();
  const existing = await getByName(trimmed);
  if (existing) throw new Error("A category type with this name already exists.");

  const row = await CategoryTypeMaster.create({ name: trimmed });
  return row.toJSON();
}

async function update(id, data) {
  const existing = await getById(id);
  if (!existing) return null;

  const trimmed = String(data.name || "").trim();
  const duplicate = await getByName(trimmed);
  if (duplicate && String(duplicate.category_type_id) !== String(id)) {
    throw new Error("A category type with this name already exists.");
  }

  await CategoryTypeMaster.update({ name: trimmed }, { where: { category_type_id: id } });
  return getById(id);
}

async function remove(id) {
  const count = await CategoryTypeMaster.destroy({ where: { category_type_id: id } });
  return count > 0;
}

module.exports = {
  list,
  getById,
  getByName,
  create,
  update,
  remove,
};
