const { Op, QueryTypes } = require("sequelize");
const Document = require("../models/document");
const DocumentFile = require("../models/documentFile");
const Category = require("../models/category");

const IS_IMAGE_SQL = `(
  media_type = 'image'
  OR LOWER(TRIM(COALESCE(file_type, ''))) IN ('jpg','jpeg','png','gif','webp','svg','bmp','heic','ico')
)`;
const IS_PDF_SQL = `LOWER(TRIM(COALESCE(file_type, ''))) = 'pdf'`;

const FILE_STATS_SUMMARY_SQL = `
SELECT
  COUNT(*)::int AS total_count,
  COALESCE(SUM(file_size), 0)::text AS total_bytes,
  COUNT(*) FILTER (WHERE ${IS_IMAGE_SQL})::int AS image_count,
  COALESCE(SUM(file_size) FILTER (WHERE ${IS_IMAGE_SQL}), 0)::text AS image_bytes,
  COUNT(*) FILTER (WHERE ${IS_PDF_SQL})::int AS pdf_count,
  COALESCE(SUM(file_size) FILTER (WHERE ${IS_PDF_SQL}), 0)::text AS pdf_bytes,
  COUNT(*) FILTER (WHERE NOT (${IS_IMAGE_SQL}) AND NOT (${IS_PDF_SQL}))::int AS other_count,
  COALESCE(SUM(file_size) FILTER (WHERE NOT (${IS_IMAGE_SQL}) AND NOT (${IS_PDF_SQL})), 0)::text AS other_bytes
FROM dms_document_files
`;

const FILES_BY_DISTRIBUTION_TYPE_SQL = `
SELECT
  COALESCE(NULLIF(TRIM(d.distribution), ''), '(Unassigned)') AS distribution,
  COALESCE(NULLIF(TRIM(df.media_type), ''), 'unknown') AS media_type,
  COUNT(*)::int AS file_count,
  COALESCE(SUM(df.file_size), 0)::text AS total_bytes
FROM dms_document_files df
INNER JOIN dms_documents d ON d.document_id = df.document_id
GROUP BY 1, 2
ORDER BY distribution ASC, media_type ASC
`;

const FILE_LIST_ATTRS = [
  "document_file_id",
  "document_id",
  "file_name",
  "file_type",
  "media_type",
  "asset_type",
  "file_size",
  "file_id",
  "created_at",
];

const IMAGE_FILE_TYPES = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "heic", "ico"];

function buildFileFilter(mediaType, fileType, assetType) {
  const where = {};
  const isOtherBucket = mediaType === "other" || fileType === "other";

  if (isOtherBucket) {
    where[Op.not] = {
      [Op.or]: [
        { media_type: "image" },
        { file_type: { [Op.in]: [...IMAGE_FILE_TYPES, "pdf"] } },
      ],
    };
  } else if (mediaType) {
    if (mediaType === "image") {
      where[Op.or] = [
        { media_type: "image" },
        { file_type: { [Op.in]: IMAGE_FILE_TYPES } },
      ];
    } else {
      where.media_type = mediaType;
    }
  }

  if (fileType && !isOtherBucket) {
    if (fileType === "image") {
      where[Op.or] = [
        { media_type: "image" },
        { file_type: { [Op.in]: IMAGE_FILE_TYPES } },
      ];
    } else {
      where.file_type = fileType;
    }
  }

  if (assetType) {
    where.asset_type = { [Op.iLike]: `%${assetType}%` };
  }

  return where;
}

async function createDocument(data, options = {}) {
  const doc = await Document.create({
    title: data.title,
    description: data.description || null,
    doc_id: data.doc_id != null && String(data.doc_id).trim() !== "" ? String(data.doc_id).trim() : null,
    doc_key_poid:
      data.doc_key_poid != null && String(data.doc_key_poid).trim() !== ""
        ? String(data.doc_key_poid).trim()
        : null,
    tags: data.tags || null,
    category_id: data.category_id || null,
    created_by: data.created_by,
    updated_by: data.updated_by || null,
    cover_image: data.cover_image || null,
    distribution: data.distribution != null && String(data.distribution).trim() !== "" ? String(data.distribution).trim() : null,
    module_name: data.module_name != null && String(data.module_name).trim() !== "" ? String(data.module_name).trim() : null,
    screen_name: data.screen_name != null && String(data.screen_name).trim() !== "" ? String(data.screen_name).trim() : null,
    username: data.username != null && String(data.username).trim() !== "" ? String(data.username).trim() : null,
  }, options);
  return doc.toJSON();
}

async function createDocumentFile(data, options = {}) {
  const row = await DocumentFile.create({
    document_id: data.document_id,
    file_name: data.file_name,
    file_type: data.file_type || null,
    media_type: data.media_type || null,
    asset_type: data.asset_type != null && String(data.asset_type).trim() !== "" ? String(data.asset_type).trim() : null,
    file_size: data.file_size != null ? data.file_size : null,
    file_id: data.file_id,
    folder_id: data.folder_id || null,
    is_private:
      data.is_private === true ||
      data.is_private === 1 ||
      data.is_private === "1" ||
      data.is_private === "true",
  }, options);
  return row.toJSON();
}

async function getDocumentFileByFileId(fileId, options = {}) {
  const row = await DocumentFile.findOne({
    where: { file_id: fileId },
    ...options,
  });
  return row ? row.toJSON() : null;
}

async function getById(id, options = {}) {
  const includeFiles = options.includeFiles !== false;
  const queryOptions = { ...options };
  delete queryOptions.includeFiles;
  const include = [{ model: Category, as: "category", attributes: ["category_id", "name", "doc_id"] }];
  if (includeFiles) {
    include.push({ model: DocumentFile, as: "documentFiles", attributes: FILE_LIST_ATTRS });
  }
  const doc = await Document.findByPk(id, {
    ...queryOptions,
    include,
    attributes: { exclude: [] },
  });
  return doc ? doc.toJSON() : null;
}

async function runInTransaction(work) {
  return Document.sequelize.transaction(async (transaction) => work(transaction));
}

async function list(filters = {}) {
  const { page = 1, limit = 20, category_id, sort = "created_at", order = "DESC" } = filters;
  const where = {};
  if (category_id != null) where.category_id = category_id;
  const { rows, count } = await Document.findAndCountAll({
    where,
    include: [
      { model: Category, as: "category", attributes: ["category_id", "name", "doc_id", "description"] },
      { model: DocumentFile, as: "documentFiles", attributes: ["document_file_id", "file_name", "file_type", "media_type", "asset_type", "file_size"] },
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
    { model: Document, as: "document", include: [{ model: Category, as: "category", attributes: ["category_id", "name", "doc_id"] }] },
  ];
  const files = await DocumentFile.findAll({ where, include });
  const docIds = [...new Set(files.map((f) => f.document_id))];
  const docs = await Document.findAll({
    where: { document_id: { [Op.in]: docIds } },
    include: [
      { model: Category, as: "category", attributes: ["category_id", "name", "doc_id"] },
      { model: DocumentFile, as: "documentFiles", attributes: FILE_LIST_ATTRS },
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

async function getDocumentIdsByAlfrescoFileIds(alfrescoIds) {
  if (!alfrescoIds || alfrescoIds.length === 0) return [];
  const rows = await DocumentFile.findAll({
    attributes: ["document_id"],
    where: { file_id: { [Op.in]: alfrescoIds } },
    group: ["document_id"],
    raw: true,
  });
  return rows.map((r) => r.document_id);
}

function trimOrEmpty(v) {
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

async function searchDocuments(filters = {}) {
  const {
    page = 1,
    limit = 20,
    category_id,
    created_by,
    title,
    description,
    tags,
    distribution,
    module_name,
    screen_name,
    media_type,
    file_type,
    asset_type,
    document_id_in,
    doc_id_in,
  } = filters;

  const whereDoc = {};
  if (category_id != null && category_id !== "") whereDoc.category_id = category_id;
  if (created_by != null && created_by !== "") whereDoc.created_by = created_by;
  if (document_id_in && document_id_in.length > 0) {
    whereDoc.document_id = { [Op.in]: document_id_in };
  } else if (document_id_in && document_id_in.length === 0) {
    return { rows: [], count: 0 };
  }
  if (doc_id_in && doc_id_in.length > 0) {
    whereDoc.doc_id = { [Op.in]: doc_id_in };
  } else if (doc_id_in && doc_id_in.length === 0) {
    return { rows: [], count: 0 };
  }

  const addILike = (field, val) => {
    const t = trimOrEmpty(val);
    if (t) whereDoc[field] = { [Op.iLike]: `%${t}%` };
  };
  addILike("title", title);
  addILike("description", description);
  addILike("tags", tags);
  addILike("distribution", distribution);
  addILike("module_name", module_name);
  addILike("screen_name", screen_name);

  const fileWhere = {};
  const mt = trimOrEmpty(media_type);
  const ft = trimOrEmpty(file_type);
  const at = trimOrEmpty(asset_type);
  Object.assign(fileWhere, buildFileFilter(mt, ft, at));
  const hasFileFilter = Boolean(mt || ft || at);

  const fileInclude = {
    model: DocumentFile,
    as: "documentFiles",
    attributes: FILE_LIST_ATTRS,
    ...(hasFileFilter ? { where: fileWhere, required: true } : {}),
  };

  const perPage = Math.min(Number(limit) || 20, 100);
  const pg = Math.max(Number(page) || 1, 1);

  const { rows, count } = await Document.findAndCountAll({
    where: whereDoc,
    distinct: true,
    col: Document.primaryKeyAttribute || "document_id",
    include: [
      { model: Category, as: "category", attributes: ["category_id", "name", "doc_id"] },
      fileInclude,
    ],
    limit: perPage,
    offset: (pg - 1) * perPage,
    order: [["created_at", "DESC"]],
  });

  return { rows: rows.map((r) => r.toJSON()), count };
}

async function updateDocument(id, data) {
  const patch = {
    title: data.title,
    description: data.description,
    tags: data.tags,
    category_id: data.category_id,
    updated_by: data.updated_by,
  };
  if (data.doc_id !== undefined) {
    patch.doc_id = data.doc_id != null && String(data.doc_id).trim() !== "" ? String(data.doc_id).trim() : null;
  }
  if (data.doc_key_poid !== undefined) {
    patch.doc_key_poid =
      data.doc_key_poid != null && String(data.doc_key_poid).trim() !== ""
        ? String(data.doc_key_poid).trim()
        : null;
  }
  if (data.distribution !== undefined) {
    patch.distribution =
      data.distribution != null && String(data.distribution).trim() !== ""
        ? String(data.distribution).trim()
        : null;
  }
  if (data.module_name !== undefined) {
    patch.module_name =
      data.module_name != null && String(data.module_name).trim() !== ""
        ? String(data.module_name).trim()
        : null;
  }
  if (data.screen_name !== undefined) {
    patch.screen_name =
      data.screen_name != null && String(data.screen_name).trim() !== ""
        ? String(data.screen_name).trim()
        : null;
  }
  if (data.username !== undefined) {
    patch.username =
      data.username != null && String(data.username).trim() !== ""
        ? String(data.username).trim()
        : null;
  }
  await Document.update(patch, { where: { document_id: id } });
  return getById(id);
}

async function getDocumentFilesByDocumentId(documentId) {
  const files = await DocumentFile.findAll({ where: { document_id: documentId } });
  return files.map((f) => f.toJSON());
}

async function deleteDocumentFilesByDocumentId(documentId, options = {}) {
  await DocumentFile.destroy({
    where: { document_id: documentId },
    ...options,
  });
  return true;
}

async function deleteDocument(id) {
  const files = await DocumentFile.findAll({ where: { document_id: id } });
  for (const f of files) {
    await DocumentFile.destroy({ where: { document_file_id: f.document_file_id } });
  }
  await Document.destroy({ where: { document_id: id } });
  return true;
}

async function getFileStatsSummaryRaw() {
  const sequelize = Document.sequelize;
  const [row] = await sequelize.query(FILE_STATS_SUMMARY_SQL, { type: QueryTypes.SELECT });
  return row || {};
}

async function getFilesByDistributionAndTypeRaw() {
  const sequelize = Document.sequelize;
  return sequelize.query(FILES_BY_DISTRIBUTION_TYPE_SQL, { type: QueryTypes.SELECT });
}

module.exports = {
  createDocument,
  createDocumentFile,
  getDocumentFileByFileId,
  getById,
  list,
  getDocumentFileById,
  getDocumentFileByDocumentAndFileId,
  getByAlfrescoIds,
  listAllWithoutSearch,
  getDocumentIdsByAlfrescoFileIds,
  searchDocuments,
  updateDocument,
  getDocumentFilesByDocumentId,
  deleteDocumentFilesByDocumentId,
  deleteDocument,
  getFileStatsSummaryRaw,
  getFilesByDistributionAndTypeRaw,
  runInTransaction,
};
