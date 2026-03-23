const { Op } = require("sequelize");
const Document = require("../models/document");
const DocumentFile = require("../models/documentFile");
const User = require("../models/user");
const Category = require("../models/category");

async function createDocument(data) {
  const doc = await Document.create({
    title: data.title,
    description: data.description || null,
    tags: data.tags || null,
    category_id: data.category_id || null,
    created_by: data.created_by,
    updated_by: data.updated_by || null,
    cover_image: data.cover_image || null,
  });
  return doc.toJSON();
}

async function createDocumentFile(data) {
  const row = await DocumentFile.create({
    document_id: data.document_id,
    file_name: data.file_name,
    file_type: data.file_type || null,
    file_id: data.file_id,
    folder_id: data.folder_id || null,
    is_private:
      data.is_private === true ||
      data.is_private === 1 ||
      data.is_private === "1" ||
      data.is_private === "true",
  });
  return row.toJSON();
}

async function getById(id, options = {}) {
  const include = [
    { model: User, as: "creator", attributes: ["user_id", "first_name", "last_name", "email"] },
    { model: Category, as: "category", attributes: ["category_id", "name"] },
  ];
  if (options.includeFiles !== false) {
    include.push({ model: DocumentFile, as: "documentFiles", attributes: ["document_file_id", "document_id", "file_name", "file_type", "file_id", "created_at"] });
  }
  const doc = await Document.findByPk(id, {
    include,
    attributes: { exclude: [] },
  });
  return doc ? doc.toJSON() : null;
}

async function list(filters = {}) {
  const { page = 1, limit = 20, category_id, sort = "created_at", order = "DESC" } = filters;
  const where = {};
  if (category_id != null) where.category_id = category_id;
  const { rows, count } = await Document.findAndCountAll({
    where,
    include: [
      { model: User, as: "creator", attributes: ["user_id", "first_name", "last_name"] },
      { model: Category, as: "category", attributes: ["category_id", "name"] },
      { model: DocumentFile, as: "documentFiles", attributes: ["document_file_id", "file_name", "file_type"] },
    ],
    limit: Math.min(limit, 100),
    offset: (page - 1) * limit,
    order: [[sort, order]],
  });
  return { rows: rows.map((r) => r.toJSON()), count };
}

async function getDocumentFileById(documentFileId) {
  const row = await DocumentFile.findOne({
    where: { document_file_id: documentFileId },
    include: [{ model: Document, as: "document", attributes: ["document_id", "title"] }],
  });
  return row ? row.toJSON() : null;
}

async function getDocumentFileByDocumentAndFileId(documentId, fileId) {
  const row = await DocumentFile.findOne({
    where: { document_file_id: fileId, document_id: documentId },
  });
  return row ? row.toJSON() : null;
}

async function getByAlfrescoIds(alfrescoIds, filters = {}) {
  if (!alfrescoIds || alfrescoIds.length === 0) return { rows: [], count: 0 };
  const where = { file_id: { [Op.in]: alfrescoIds } };
  const include = [
    { model: Document, as: "document", include: [{ model: User, as: "creator", attributes: ["user_id", "first_name", "last_name"] }, { model: Category, as: "category", attributes: ["category_id", "name"] }] },
  ];
  const files = await DocumentFile.findAll({ where, include });
  const docIds = [...new Set(files.map((f) => f.document_id))];
  const docs = await Document.findAll({
    where: { document_id: { [Op.in]: docIds } },
    include: [
      { model: User, as: "creator", attributes: ["user_id", "first_name", "last_name"] },
      { model: Category, as: "category", attributes: ["category_id", "name"] },
      { model: DocumentFile, as: "documentFiles", attributes: ["document_file_id", "file_name", "file_type", "file_id"] },
    ],
  });
  if (filters.category_id != null) {
    const filtered = docs.filter((d) => d.category_id === filters.category_id);
    return { rows: filtered.map((r) => r.toJSON()), count: filtered.length };
  }
  return { rows: docs.map((r) => r.toJSON()), count: docs.length };
}

async function listAllWithoutSearch(filters = {}) {
  return list(filters);
}

async function updateDocument(id, data) {
  await Document.update(
    {
      title: data.title,
      description: data.description,
      tags: data.tags,
      category_id: data.category_id,
      updated_by: data.updated_by,
    },
    { where: { document_id: id } }
  );
  return getById(id);
}

async function getDocumentFilesByDocumentId(documentId) {
  const files = await DocumentFile.findAll({ where: { document_id: documentId } });
  return files.map((f) => f.toJSON());
}

async function deleteDocument(id) {
  const files = await DocumentFile.findAll({ where: { document_id: id } });
  for (const f of files) {
    await DocumentFile.destroy({ where: { document_file_id: f.document_file_id } });
  }
  await Document.destroy({ where: { document_id: id } });
  return true;
}

module.exports = {
  createDocument,
  createDocumentFile,
  getById,
  list,
  getDocumentFileById,
  getDocumentFileByDocumentAndFileId,
  getByAlfrescoIds,
  listAllWithoutSearch,
  updateDocument,
  getDocumentFilesByDocumentId,
  deleteDocument,
};
