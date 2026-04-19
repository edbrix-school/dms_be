const alfrescoService = require("./alfrescoService");

/**
 * Alfresco-backed storage: same contract as S3 storage for documentService wiring.
 * @param {object} file - Multer file
 * @param {object} metadata - { title, description, author?, ... }
 * @returns {Promise<{ id: string }>}
 */
async function uploadFile(file, metadata = {}) {
  const entry = await alfrescoService.uploadFile(file, metadata);
  return { id: entry.id };
}

/**
 * @param {string} storageId - Alfresco node id
 * @param {object} [_options] - unused; S3 uses preferredFilename from DB
 * @returns {Promise<{ filename: string, buffer: Buffer }>}
 */
async function downloadFile(storageId, _options) {
  const out = await alfrescoService.downloadFile(storageId);
  return {
    filename: out.filename,
    buffer: out.buffer,
  };
}

/**
 * @param {string} storageId
 */
async function deleteFile(storageId) {
  await alfrescoService.deleteFile(storageId);
}

/**
 * @param {string} searchText
 * @returns {Promise<string[]>}
 */
async function searchFullText(searchText) {
  return alfrescoService.search(searchText);
}

module.exports = {
  uploadFile,
  downloadFile,
  deleteFile,
  searchFullText,
};
