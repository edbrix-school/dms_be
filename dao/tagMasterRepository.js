const { Op } = require("sequelize");
const TagMaster = require("../models/tagMaster");

async function list(pagination = {}, filters = {}) {
  const order = [["tag_id", "DESC"]];
  const where = {};
  const trimmedName = String(filters.name || "").trim();
  if (trimmedName) {
    where.name = { [Op.iLike]: `%${trimmedName}%` };
  }
  const paginated = pagination && pagination.page != null && pagination.limit != null;

  if (paginated) {
    const { page, limit } = pagination;
    const { rows, count } = await TagMaster.findAndCountAll({
      where,
      order,
      limit,
      offset: (page - 1) * limit,
    });
    return { rows: rows.map((r) => r.toJSON()), count, page, limit };
  }

  const rows = await TagMaster.findAll({ where, order });
  return rows.map((r) => r.toJSON());
}

async function getById(id) {
  const row = await TagMaster.findByPk(id);
  return row ? row.toJSON() : null;
}

async function getByName(name) {
  const trimmedName = String(name || "").trim();
  if (!trimmedName) return null;
  const row = await TagMaster.findOne({
    where: { name: { [Op.iLike]: trimmedName } },
  });
  return row ? row.toJSON() : null;
}

async function create(data) {
  const trimmedName = String(data.name || "").trim();
  const existing = await getByName(trimmedName);
  if (existing) {
    throw new Error("A tag with this name already exists.");
  }
  const row = await TagMaster.create({
    name: trimmedName,
  });
  return row.toJSON();
}

async function update(id, data) {
  await TagMaster.update({ name: data.name }, { where: { tag_id: id } });
  return getById(id);
}

async function remove(id) {
  await TagMaster.destroy({ where: { tag_id: id } });
  return true;
}

module.exports = {
  list,
  getById,
  getByName,
  create,
  update,
  remove,
};
