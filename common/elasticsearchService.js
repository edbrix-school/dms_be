const crypto = require("crypto");
const { Client } = require("@elastic/elasticsearch");

require("dotenv").config();

let client;
let indexEnsured;

function getIndexName() {
  return process.env.ELASTICSEARCH_INDEX || "dms-files";
}

function getClient() {
  if (client) return client;
  const url = process.env.ELASTICSEARCH_URL;
  if (!url) {
    throw new Error("ELASTICSEARCH_URL must be set when using Elasticsearch.");
  }
  const opts = { node: url };
  const apiKey = process.env.ELASTICSEARCH_API_KEY;
  if (apiKey) {
    opts.auth = { apiKey };
  } else {
    const user = process.env.ELASTICSEARCH_USERNAME;
    const pass = process.env.ELASTICSEARCH_PASSWORD;
    if (user && pass != null) {
      opts.auth = { username: user, password: String(pass) };
    }
  }
  client = new Client(opts);
  return client;
}

function stableEsId(fileId) {
  return crypto.createHash("sha256").update(String(fileId), "utf8").digest("hex");
}

async function ensureIndex() {
  if (indexEnsured) return;
  const c = getClient();
  const index = getIndexName();
  const exists = await c.indices.exists({ index });
  if (!exists) {
    await c.indices.create({
      index,
      mappings: {
        properties: {
          file_id: { type: "keyword" },
          document_id: { type: "integer" },
          title: { type: "text" },
          description: { type: "text" },
          tags: { type: "text" },
          file_name: { type: "text" },
          content: { type: "text" },
        },
      },
    });
  }
  indexEnsured = true;
}

/**
 * Index or replace a file document.
 * @param {object} doc
 * @param {string} doc.file_id
 * @param {number} doc.document_id
 * @param {string} [doc.title]
 * @param {string} [doc.description]
 * @param {string} [doc.tags]
 * @param {string} [doc.file_name]
 * @param {string} [doc.content]
 */
async function indexFile(doc) {
  await ensureIndex();
  const c = getClient();
  const index = getIndexName();
  const id = stableEsId(doc.file_id);
  const body = {
    file_id: String(doc.file_id),
    document_id: Number(doc.document_id),
    title: doc.title != null ? String(doc.title) : "",
    description: doc.description != null ? String(doc.description) : "",
    tags: doc.tags != null ? String(doc.tags) : "",
    file_name: doc.file_name != null ? String(doc.file_name) : "",
    content: doc.content != null ? String(doc.content) : "",
  };
  await c.index({ index, id, document: body, refresh: true });
}

/**
 * Delete ES doc for a storage key (S3 key or Alfresco id if ever indexed).
 * @param {string} fileId
 */
async function deleteByFileId(fileId) {
  await ensureIndex();
  const c = getClient();
  const index = getIndexName();
  const id = stableEsId(fileId);
  try {
    await c.delete({ index, id, refresh: true });
  } catch (err) {
    if (err.meta && err.meta.statusCode === 404) return;
    throw err;
  }
}

/**
 * Delete all indexed files for a document.
 * @param {number} documentId
 */
async function deleteByDocumentId(documentId) {
  await ensureIndex();
  const c = getClient();
  const index = getIndexName();
  await c.deleteByQuery({
    index,
    refresh: true,
    query: { term: { document_id: Number(documentId) } },
  });
}

/**
 * Update searchable metadata for all rows with matching document_id (e.g. after updateDocument).
 * @param {number} documentId
 * @param {{ title?: string, description?: string, tags?: string }} fields
 */
async function updateMetadataByDocumentId(documentId, fields) {
  await ensureIndex();
  const c = getClient();
  const index = getIndexName();
  const doc = {};
  if (fields.title !== undefined) doc.title = fields.title != null ? String(fields.title) : "";
  if (fields.description !== undefined) {
    doc.description = fields.description != null ? String(fields.description) : "";
  }
  if (fields.tags !== undefined) doc.tags = fields.tags != null ? String(fields.tags) : "";
  if (Object.keys(doc).length === 0) return;

  await c.updateByQuery({
    index,
    refresh: true,
    query: { term: { document_id: Number(documentId) } },
    script: {
      source: `
        if (params.containsKey('title')) ctx._source.title = params.title;
        if (params.containsKey('description')) ctx._source.description = params.description;
        if (params.containsKey('tags')) ctx._source.tags = params.tags;
      `,
      lang: "painless",
      params: doc,
    },
  });
}

/**
 * Full-text search; returns storage ids (file_id) to intersect with DB.
 * @param {string} searchText
 * @returns {Promise<string[]>}
 */
async function searchFullText(searchText) {
  const q = String(searchText || "").trim();
  if (!q) return [];

  await ensureIndex();
  const c = getClient();
  const index = getIndexName();
  const sanitized = q.substring(0, 500);

  const res = await c.search({
    index,
    size: 100,
    query: {
      multi_match: {
        query: sanitized,
        type: "best_fields",
        fields: ["title^2", "description", "tags", "file_name", "content"],
        operator: "or",
        fuzziness: "AUTO",
      },
    },
    _source: ["file_id"],
  });

  const hits = res.hits && res.hits.hits ? res.hits.hits : [];
  return hits.map((h) => h._source && h._source.file_id).filter(Boolean);
}

module.exports = {
  ensureIndex,
  indexFile,
  deleteByFileId,
  deleteByDocumentId,
  updateMetadataByDocumentId,
  searchFullText,
  stableEsId,
};
