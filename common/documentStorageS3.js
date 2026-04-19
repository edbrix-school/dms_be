const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");

const elasticsearchService = require("./elasticsearchService");

require("dotenv").config();

let s3Client;

function getS3Client() {
  if (s3Client) return s3Client;
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
  if (!region) {
    throw new Error("AWS_REGION (or AWS_DEFAULT_REGION) must be set for S3 storage.");
  }
  s3Client = new S3Client({ region });
  return s3Client;
}

function getBucket() {
  const b = process.env.S3_BUCKET || process.env.AWS_S3_BUCKET;
  if (!b) throw new Error("S3_BUCKET must be set for S3 storage.");
  return b;
}

function prefixKey() {
  const p = process.env.S3_DOCUMENTS_PREFIX || "documents/";
  if (!p) return "";
  return p.endsWith("/") ? p : `${p}/`;
}

function safeBasename(name) {
  const base = path.basename(name || "file").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 200);
  return base || "file";
}

/**
 * @param {object} file - Multer file
 * @param {object} metadata - must include documentId for stable paths; optional title, description
 * @returns {Promise<{ id: string }>} id is the S3 object key (stored in file_id)
 */
async function uploadFile(file, metadata = {}) {
  const bucket = getBucket();
  const client = getS3Client();
  const docId =
    metadata.documentId != null && String(metadata.documentId).trim() !== ""
      ? String(metadata.documentId).trim()
      : "pending";
  const original = file.originalname || metadata.originalName || "file";
  const key = `${prefixKey()}${docId}/${randomUUID()}-${safeBasename(original)}`;

  const filePath = file.path || file;
  const body = fs.createReadStream(filePath);
  const contentType = file.mimetype || metadata.mimetype || "application/octet-stream";

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      Metadata: {
        "original-filename": (original || "file").slice(0, 1024),
      },
    })
  );

  return { id: key };
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * @param {string} storageId - S3 object key
 * @param {{ preferredFilename?: string }} [options] - use DB file_name when available
 * @returns {Promise<{ filename: string, buffer: Buffer }>}
 */
async function downloadFile(storageId, options = {}) {
  const bucket = getBucket();
  const client = getS3Client();
  const out = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: storageId,
    })
  );
  const buffer = await streamToBuffer(out.Body);
  const metaName = out.Metadata && out.Metadata["original-filename"];
  const filename =
    (options.preferredFilename && String(options.preferredFilename)) ||
    metaName ||
    path.basename(storageId) ||
    "download";
  return { filename, buffer };
}

/**
 * @param {string} storageId
 */
async function deleteFile(storageId) {
  const bucket = getBucket();
  const client = getS3Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: storageId,
    })
  );
}

/**
 * @param {string} searchText
 * @returns {Promise<string[]>}
 */
async function searchFullText(searchText) {
  return elasticsearchService.searchFullText(searchText);
}

module.exports = {
  uploadFile,
  downloadFile,
  deleteFile,
  searchFullText,
};
