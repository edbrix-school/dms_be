const fs = require("fs").promises;
const documentRepository = require("../dao/documentRepository");
const alfrescoService = require("../common/alfrescoService");

async function createDocument(req, body, userId) {
  const doc = await documentRepository.createDocument({
    title: body.title,
    description: body.description || null,
    tags: body.tags || null,
    category_id: body.category_id || null,
    created_by: userId,
    cover_image: body.cover_image || null,
  });
  const files = req.files && (req.files.files || req.files["files"]);
  const fileList = Array.isArray(files) ? files : files ? [files] : [];
  for (const file of fileList) {
    try {
      const entry = await alfrescoService.uploadFile(file, {
        title: body.title,
        description: body.description,
      });
      const ext = (file.originalname || "").split(".").pop() || "";
      await documentRepository.createDocumentFile({
        document_id: doc.document_id,
        file_name: file.originalname || "file",
        file_type: ext,
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

async function searchDocuments(body, user) {
  const searchText = (body.search_text || "").trim();
  const filters = {
    category_id: body.category_id,
    page: body.page || 1,
    limit: body.limit || 20,
  };
  if (!searchText) {
    return documentRepository.listAllWithoutSearch(filters);
  }
  const alfrescoIds = await alfrescoService.search(searchText);
  return documentRepository.getByAlfrescoIds(alfrescoIds, filters);
}

async function updateDocument(id, body, userId) {
  await documentRepository.updateDocument(id, {
    title: body.title,
    description: body.description,
    tags: body.tags,
    category_id: body.category_id,
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

module.exports = {
  createDocument,
  listDocuments,
  getDocumentById,
  getFileContent,
  searchDocuments,
  updateDocument,
  deleteDocument,
};
