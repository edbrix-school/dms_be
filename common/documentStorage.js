require("dotenv").config();

const backend = (process.env.STORAGE_BACKEND || "alfresco").toLowerCase();

const alfresco = require("./documentStorageAlfresco");
const s3 = require("./documentStorageS3");

const impl = backend === "s3" ? s3 : alfresco;

/**
 * @returns {'alfresco'|'s3'}
 */
function getBackend() {
  return backend === "s3" ? "s3" : "alfresco";
}

/**
 * Upload a file; returns opaque storage id for file_id column.
 * @param {object} file - Multer file
 * @param {object} metadata - { title, description, documentId?, ... }
 */
async function uploadFile(file, metadata) {
  return impl.uploadFile(file, metadata);
}

/**
 * Download by storage id.
 * @param {string} storageId
 * @param {object} [options] - S3: { preferredFilename } from DB
 */
async function downloadFile(storageId, options) {
  return impl.downloadFile(storageId, options);
}

/**
 * @param {string} storageId
 */
async function deleteFile(storageId) {
  return impl.deleteFile(storageId);
}

/**
 * Full-text search; returns storage ids (node ids or S3 keys).
 * @param {string} searchText
 * @returns {Promise<string[]>}
 */
async function searchFullText(searchText) {
  return impl.searchFullText(searchText);
}

module.exports = {
  getBackend,
  uploadFile,
  downloadFile,
  deleteFile,
  searchFullText,
};
