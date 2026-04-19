const fs = require("fs").promises;
const documentRepository = require("../dao/documentRepository");
const documentStorage = require("../common/documentStorage");
const elasticsearchService = require("../common/elasticsearchService");
const { extractText } = require("../common/extractText");
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

function parseDocIdFilters(...values) {
  const out = [];
  for (const raw of values) {
    if (raw == null || raw === "") continue;
    if (Array.isArray(raw)) {
      out.push(...raw);
      continue;
    }
    if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (!trimmed) continue;
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          out.push(...parsed);
          continue;
        }
      } catch (_) {}
      if (trimmed.includes(",")) {
        out.push(...trimmed.split(","));
        continue;
      }
    }
    out.push(raw);
  }
  return [...new Set(out.map((v) => String(v).trim()).filter((v) => v !== ""))];
}

async function createDocument(req, body, userId) {
  const files = req.files && (req.files.files || req.files["files"]);
  const fileList = Array.isArray(files) ? files : files ? [files] : [];
  const assetTypes = parseStringArray(body.file_asset_types);
  const mediaOverrides = parseStringArray(body.file_media_types);
  const defaultAssetType =
    body.asset_type != null && String(body.asset_type).trim() !== "" ? String(body.asset_type).trim() : null;
  const newlyUploadedFileIds = [];
  const esIndexRows = [];
  let createdDocumentId = null;

  try {
    await documentRepository.runInTransaction(async (transaction) => {
      const doc = await documentRepository.createDocument(
        {
          title: body.title,
          description: body.description || null,
          doc_id: body.doc_id,
          tags: body.tags || null,
          category_id: body.category_id || null,
          created_by: userId,
          cover_image: body.cover_image || null,
          distribution: body.distribution,
        },
        { transaction }
      );
      createdDocumentId = doc.document_id;

      for await (const [i, file] of fileList.entries()) {
        const entry = await documentStorage.uploadFile(file, {
          title: body.title,
          description: body.description,
          documentId: doc.document_id,
        });
        const existingFile = await documentRepository.getDocumentFileByFileId(entry.id, { transaction });
        if (existingFile) {
          throw new Error(
            `Duplicate file upload is not allowed. File "${file.originalname}" already exists in document ${existingFile.document_id}.`
          );
        }
        newlyUploadedFileIds.push(entry.id);

        const ext = (file.originalname || "").split(".").pop() || "";
        const overrideMedia = mediaOverrides[i] != null && String(mediaOverrides[i]).trim();
        const mediaType = overrideMedia || inferMediaType(file.mimetype, file.originalname);
        let assetType = defaultAssetType;
        if (assetTypes[i] != null && String(assetTypes[i]).trim() !== "") {
          assetType = String(assetTypes[i]).trim();
        }
        const fileName = file.originalname || "file";
        await documentRepository.createDocumentFile(
          {
            document_id: doc.document_id,
            file_name: fileName,
            file_type: ext,
            media_type: mediaType,
            asset_type: assetType,
            file_size: file.size != null ? file.size : null,
            file_id: entry.id,
            folder_id: body.folder_id || null,
            is_private: body.is_private,
          },
          { transaction }
        );
        if (documentStorage.getBackend() === "s3") {
          const content = await extractText({
            path: file.path,
            mimetype: file.mimetype,
            originalname: file.originalname,
          });
          esIndexRows.push({
            file_id: entry.id,
            document_id: doc.document_id,
            title: body.title,
            description: body.description,
            tags: body.tags,
            file_name: fileName,
            content,
          });
        }
      }
    });
    if (documentStorage.getBackend() === "s3" && esIndexRows.length > 0) {
      for (const row of esIndexRows) {
        await elasticsearchService.indexFile(row);
      }
    }
  } catch (err) {
    for (const fileId of newlyUploadedFileIds) {
      try {
        await documentStorage.deleteFile(fileId);
      } catch (_) {}
    }
    throw err;
  } finally {
    for (const file of fileList) {
      try {
        if (file.path) await fs.unlink(file.path);
      } catch (_) {}
    }
  }
  return createdDocumentId ? documentRepository.getById(createdDocumentId) : null;
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
  const { filename, buffer } = await documentStorage.downloadFile(fileRow.file_id, {
    preferredFilename: fileRow.file_name,
  });
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
    file_type: pick("file_type"),
    asset_type: pick("asset_type"),
    doc_id: pick("doc_id"),
    doc_ids: pick("doc_ids"),
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
    nonEmpty(f.file_type) ||
    nonEmpty(f.asset_type) ||
    parseDocIdFilters(f.doc_id, f.doc_ids).length > 0 ||
    (f.category_id != null && f.category_id !== "") ||
    (f.created_by != null && f.created_by !== "")
  );
}

async function searchDocuments(body, user) {
  const f = mergeSearchFields(body);
  const docIdIn = parseDocIdFilters(f.doc_id, f.doc_ids);
  const effectiveDocIdIn = docIdIn.length > 0 ? docIdIn : null;
  const searchText = (f.search_text != null ? String(f.search_text) : "").trim();
  const hasFullText = !!searchText;
  const hasDb = hasAnyDbSearchCriterion({ ...f, doc_id: effectiveDocIdIn });

  if (!hasDb && !hasFullText) {
    return documentRepository.listAllWithoutSearch({
      page: f.page || 1,
      limit: f.limit || 20,
      category_id: f.category_id,
    });
  }

  let documentIdIn = null;
  if (hasFullText) {
    const storageIds = await documentStorage.searchFullText(searchText);
    documentIdIn = await documentRepository.getDocumentIdsByAlfrescoFileIds(storageIds);
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
    file_type: f.file_type,
    asset_type: f.asset_type,
    doc_id_in: effectiveDocIdIn,
    document_id_in: documentIdIn,
  });
}

async function updateDocument(id, body, userId) {
  await documentRepository.updateDocument(id, {
    title: body.title,
    description: body.description,
    doc_id: body.doc_id,
    tags: body.tags,
    category_id: body.category_id,
    distribution: body.distribution,
    updated_by: userId,
  });
  const doc = await documentRepository.getById(id);
  if (documentStorage.getBackend() === "s3") {
    await elasticsearchService.updateMetadataByDocumentId(id, {
      title: doc.title,
      description: doc.description,
      tags: doc.tags,
    });
  }
  return doc;
}

async function deleteDocument(id) {
  const files = await documentRepository.getDocumentFilesByDocumentId(id);
  for (const f of files) {
    try {
      await documentStorage.deleteFile(f.file_id);
    } catch (err) {
      console.error("Storage delete error for", f.file_id, err.message);
    }
  }
  if (documentStorage.getBackend() === "s3") {
    try {
      await elasticsearchService.deleteByDocumentId(id);
    } catch (err) {
      console.error("Elasticsearch delete error for document", id, err.message);
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
