const fs = require("fs").promises;
const documentRepository = require("../dao/documentRepository");
const alfrescoService = require("../common/alfrescoService");
const { inferMediaType } = require("../common/fileMediaType");

function parseStringArray(raw) {
  if (raw == null || raw === "") return [];
  if (Array.isArray(raw)) return raw.map((x) => (x == null ? "" : String(x)));
  try {
    const j = JSON.parse(raw);
    return Array.isArray(j) ? j.map((x) => (x == null ? "" : String(x))) : [];
  } catch {
    return [];
  }
}

async function createDocument(req, body, userId) {
  const doc = await documentRepository.createDocument({
    title: body.title,
    description: body.description || null,
    tags: body.tags || null,
    category_id: body.category_id || null,
    created_by: userId,
    cover_image: body.cover_image || null,
    distribution: body.distribution,
  });
  const files = req.files && (req.files.files || req.files["files"]);
  const fileList = Array.isArray(files) ? files : files ? [files] : [];
  const assetTypes = parseStringArray(body.file_asset_types);
  const mediaOverrides = parseStringArray(body.file_media_types);
  const defaultAssetType =
    body.asset_type != null && String(body.asset_type).trim() !== "" ? String(body.asset_type).trim() : null;

  for await (const [i, file] of fileList.entries()) {
    try {
      const entry = await alfrescoService.uploadFile(file, {
        title: body.title,
        description: body.description,
      });
      const ext = (file.originalname || "").split(".").pop() || "";
      const overrideMedia = mediaOverrides[i] != null && String(mediaOverrides[i]).trim();
      const mediaType = overrideMedia || inferMediaType(file.mimetype, file.originalname);
      let assetType = defaultAssetType;
      if (assetTypes[i] != null && String(assetTypes[i]).trim() !== "") {
        assetType = String(assetTypes[i]).trim();
      }
      await documentRepository.createDocumentFile({
        document_id: doc.document_id,
        file_name: file.originalname || "file",
        file_type: ext,
        media_type: mediaType,
        asset_type: assetType,
        file_size: file.size != null ? file.size : null,
        file_id: entry.id,
        folder_id: body.folder_id || null,
        is_private: body.is_private,
      });
    } finally {
      try {
        if (file.path) await fs.unlink(file.path);
      } catch (_) {}
    }
  }
  return documentRepository.getById(doc.document_id);
}

async function listDocuments(filters, user) {
  return documentRepository.list(filters);
}

async function getDocumentById(id) {
  return documentRepository.getById(id);
}

async function getFileContent(documentId, fileId) {
  const fileRow = await documentRepository.getDocumentFileByDocumentAndFileId(documentId, fileId);
  if (!fileRow) return null;
  const { filename, buffer } = await alfrescoService.downloadFile(fileRow.file_id);
  return { ...fileRow, filename, buffer };
}

function mergeSearchFields(body) {
  const nested = body.search_fields && typeof body.search_fields === "object" && !Array.isArray(body.search_fields) ? body.search_fields : {};
  const pick = (k) => (body[k] !== undefined && body[k] !== null ? body[k] : nested[k]);
  return {
    page: body.page ?? nested.page,
    limit: body.limit ?? nested.limit,
    category_id: pick("category_id"),
    created_by: pick("created_by"),
    title: pick("title"),
    description: pick("description"),
    tags: pick("tags"),
    distribution: pick("distribution"),
    media_type: pick("media_type"),
    asset_type: pick("asset_type"),
    search_text: pick("search_text"),
  };
}

function hasAnyDbSearchCriterion(f) {
  const nonEmpty = (v) => v != null && String(v).trim() !== "";
  return (
    nonEmpty(f.title) ||
    nonEmpty(f.description) ||
    nonEmpty(f.tags) ||
    nonEmpty(f.distribution) ||
    nonEmpty(f.media_type) ||
    nonEmpty(f.asset_type) ||
    (f.category_id != null && f.category_id !== "") ||
    (f.created_by != null && f.created_by !== "")
  );
}

async function searchDocuments(body, user) {
  const f = mergeSearchFields(body);
  const searchText = (f.search_text != null ? String(f.search_text) : "").trim();
  const hasAlfresco = !!searchText;
  const hasDb = hasAnyDbSearchCriterion(f);

  if (!hasDb && !hasAlfresco) {
    return documentRepository.listAllWithoutSearch({
      page: f.page || 1,
      limit: f.limit || 20,
      category_id: f.category_id,
    });
  }

  let documentIdIn = null;
  if (hasAlfresco) {
    const alfrescoIds = await alfrescoService.search(searchText);
    documentIdIn = await documentRepository.getDocumentIdsByAlfrescoFileIds(alfrescoIds);
    if (documentIdIn.length === 0) {
      return { rows: [], count: 0 };
    }
  }

  return documentRepository.searchDocuments({
    page: f.page || 1,
    limit: f.limit || 20,
    category_id: f.category_id,
    created_by: f.created_by,
    title: f.title,
    description: f.description,
    tags: f.tags,
    distribution: f.distribution,
    media_type: f.media_type,
    asset_type: f.asset_type,
    document_id_in: documentIdIn,
  });
}

async function updateDocument(id, body, userId) {
  await documentRepository.updateDocument(id, {
    title: body.title,
    description: body.description,
    tags: body.tags,
    category_id: body.category_id,
    distribution: body.distribution,
    updated_by: userId,
  });
  return documentRepository.getById(id);
}

async function deleteDocument(id) {
  const files = await documentRepository.getDocumentFilesByDocumentId(id);
  for (const f of files) {
    try {
      await alfrescoService.deleteFile(f.file_id);
    } catch (err) {
      console.error("Alfresco delete error for", f.file_id, err.message);
    }
  }
  await documentRepository.deleteDocument(id);
  return true;
}

function parseBytes(v) {
  if (v == null || v === "") return 0;
  const s = String(v).trim();
  if (/^\d+$/.test(s) && s.length > 14) {
    try {
      return Number(BigInt(s));
    } catch {
      return 0;
    }
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function bytesToGb(bytes) {
  const b = parseBytes(bytes);
  if (!Number.isFinite(b) || b <= 0) return 0;
  return Math.round((b / 1024 ** 3) * 1e6) / 1e6;
}

function statBucket(row, countKey, bytesKey) {
  const count = Number(row[countKey]) || 0;
  const bytes = parseBytes(row[bytesKey]);
  return {
    count,
    size_bytes: String(bytes),
    size_gb: bytesToGb(bytes),
  };
}

async function getFileStatsSummary() {
  const row = await documentRepository.getFileStatsSummaryRaw();
  return {
    total_assets: statBucket(row, "total_count", "total_bytes"),
    images: statBucket(row, "image_count", "image_bytes"),
    pdfs: statBucket(row, "pdf_count", "pdf_bytes"),
    other_files: statBucket(row, "other_count", "other_bytes"),
  };
}

async function getFilesByDistributionAndType() {
  const rows = await documentRepository.getFilesByDistributionAndTypeRaw();
  return rows.map((r) => {
    const bytes = parseBytes(r.total_bytes);
    return {
      distribution: r.distribution,
      type: r.media_type,
      file_count: Number(r.file_count) || 0,
      total_size_bytes: String(bytes),
      total_size_gb: bytesToGb(bytes),
    };
  });
}

module.exports = {
  createDocument,
  listDocuments,
  getDocumentById,
  getFileContent,
  searchDocuments,
  updateDocument,
  deleteDocument,
  getFileStatsSummary,
  getFilesByDistributionAndType,
};
