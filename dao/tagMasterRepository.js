const TagMaster = require("../models/tagMaster");

async function list() {
  const rows = await TagMaster.findAll({
    order: [["tag_id", "DESC"]],
  });
  return rows.map((r) => r.toJSON());
}

async function getById(id) {
  const row = await TagMaster.findByPk(id);
  return row ? row.toJSON() : null;
}

async function getByName(name) {
  const row = await TagMaster.findOne({ where: { name } });
  return row ? row.toJSON() : null;
}

async function create(data) {
  const row = await TagMaster.create({
    name: data.name,
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
