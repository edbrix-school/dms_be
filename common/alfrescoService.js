const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
require("dotenv").config();

const getAuthHeader = () => {
  const user = process.env.ALFRESCO_USERNAME || "admin";
  const pass = process.env.ALFRESCO_PASSWORD || "admin";
  return Buffer.from(`${user}:${pass}`).toString("base64");
};

/**
 * Upload a file to Alfresco. Returns node entry with id.
 * @param {object} file - Multer file object: { path, originalname, mimetype }
 * @param {object} metadata - { title, description, author (optional) }
 * @returns {Promise<{ id: string }>} Alfresco node entry
 */
async function uploadFile(file, metadata = {}) {
  const alfrescoUrl = process.env.ALFRESCO_URL;
  const parentId = process.env.ALFRESCO_ID;
  if (!alfrescoUrl || !parentId) {
    throw new Error("ALFRESCO_URL and ALFRESCO_ID must be set.");
  }
  const form = new FormData();
  const filePath = file.path || file;
  const fileName = file.originalname || metadata.originalName || "document";
  const stream = fs.createReadStream(filePath);
  form.append("filedata", stream, {
    filename: fileName,
    contentType: file.mimetype || metadata.mimetype || "application/octet-stream",
  });
  form.append("cm:title", metadata.title || fileName);
  if (metadata.description) form.append("cm:description", metadata.description);
  if (metadata.author) form.append("cm:author", metadata.author);
  try{
    const response = await axios.post(`${alfrescoUrl}/${parentId}/children`, form, {
      auth: {
        username: process.env.ALFRESCO_USERNAME || "admin",
        password: process.env.ALFRESCO_PASSWORD || "admin",
      },
      headers: form.getHeaders(),
      maxBodyLength: Infinity,
    });
    console.log(response);
    return response.data.entry;
  } catch (error) {
    const message =
      error?.response?.data?.error?.briefSummary ||
      error?.response?.data?.error?.errorKey ||
      error?.response?.data?.message ||
      error?.message ||
      "Alfresco upload failed";
    throw new Error(message);
  }
}

/**
 * Download file content from Alfresco by node id.
 * @param {string} nodeId - Alfresco node ID
 * @returns {Promise<{ filename: string, fileExtension: string, buffer: Buffer }>}
 */
async function downloadFile(nodeId) {
  const alfrescoUrl = process.env.ALFRESCO_URL;
  const response = await axios({
    method: "GET",
    url: `${alfrescoUrl}/${nodeId}/content`,
    responseType: "arraybuffer",
    headers: {
      Authorization: `Basic ${getAuthHeader()}`,
    },
  });
  const contentDisposition = response.headers["content-disposition"];
  const match = contentDisposition && contentDisposition.match(/filename="?(.+?)"?$/);
  const filename = match ? match[1].trim() : "download";
  const fileExtension = filename.slice(((filename.lastIndexOf(".") - 1) >>> 0) + 2) || "";
  return {
    filename,
    fileExtension,
    buffer: response.data,
  };
}

/**
 * Search Alfresco; returns array of node IDs.
 * @param {string} searchText
 * @returns {Promise<string[]>}
 */
async function search(searchText) {
  const searchUrl = process.env.ALFRESCO_SEARCH_URL;
  if (!searchUrl) throw new Error("ALFRESCO_SEARCH_URL must be set.");
  const sanitized = String(searchText || "").replace(/"/g, '\\"').substring(0, 200);
  const payload = {
    query: {
      query: `TEXT:"${sanitized}" OR cm:title:"${sanitized}" OR cm:description:"${sanitized}"`,
    },
    paging: { maxItems: 100, skipCount: 0 },
  };
  const response = await axios.post(searchUrl, payload, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${getAuthHeader()}`,
    },
  });
  const entries = response.data?.list?.entries || [];
  return entries.map((e) => e.entry?.id).filter(Boolean);
}

/**
 * Delete a node in Alfresco.
 * @param {string} nodeId
 */
async function deleteFile(nodeId) {
  const alfrescoUrl = process.env.ALFRESCO_URL;
  await axios.delete(`${alfrescoUrl}/${nodeId}`, {
    headers: { Authorization: `Basic ${getAuthHeader()}` },
  });
}

module.exports = {
  uploadFile,
  downloadFile,
  search,
  deleteFile,
};
