#!/usr/bin/env node
/**
 * Standalone document importer for the DMS Postgres DB + Alfresco.
 *
 * This mimics documentService.createDocument() / documentRepository's
 * createDocument + createDocumentFile (as they exist today: no doc_id,
 * doc_key_poid, username, module_name or screen_name columns - those were
 * removed from the dms_documents table) plus alfrescoService.uploadFile().
 *
 * It does NOT require any file from the dms-api app (no models/, dao/,
 * services/, common/, config/). It only needs three third-party packages
 * and a .env with the same DB_* / ALFRESCO_* variables the app itself uses:
 *
 *   npm install pg axios form-data dotenv
 *
 * so this file can be copied anywhere (a migration box, a different
 * checkout, a cron host) and run on its own.
 *
 * On top of documents + document_files, it optionally resolves a
 * `category` name (e.g. "Marketing") against the dms_categories table to
 * get a category_id, so a manifest can use human category names instead of
 * numeric ids.
 *
 * Added on top of the current app behavior (which does neither of these):
 *   - The document + all its file rows are written in a single DB
 *     transaction, so a failure partway through never leaves a
 *     half-written document.
 *   - If a later file fails after earlier files were already uploaded to
 *     Alfresco, those Alfresco nodes are deleted (compensating cleanup)
 *     before the DB transaction is rolled back, instead of being orphaned.
 * These don't change any field or behavior you depend on - they only
 * change what happens when something fails partway through. Remove the
 * transaction/cleanup blocks if you'd rather mirror the app exactly.
 *
 * Usage - single document:
 *   node standaloneDocumentImport.js \
 *     --title "Q1 Report" --created-by 1 \
 *     --files "/path/a.pdf|/path/b.docx" \
 *     [--description "..."] [--category "Marketing"] [--category-id 3] \
 *     [--distribution "Marketing"] [--tags "tag1,tag2"] \
 *     [--asset-type "Report"] [--file-asset-types "One-pager|Spec sheet"] \
 *     [--cover-image "..."] [--is-private] [--folder-id 5]
 *
 * Usage - batch from a CSV manifest:
 *   node standaloneDocumentImport.js --manifest ./manifest.csv --created-by 1
 *
 * Manifest columns (header row required): title, description, category,
 * category_id, distribution, tags, asset_type, created_by, cover_image,
 * is_private, folder_id, files, file_asset_types.
 * `files` and `file_asset_types` are "|"-separated (see manifest.standalone.sample.csv).
 * `category` (a name) is resolved against dms_categories; `category_id`
 * wins if both are given. `created_by` in a row overrides --created-by.
 *
 * Required env vars (same ones the app's own .env already has):
 *   DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
 *   ALFRESCO_URL, ALFRESCO_ID, ALFRESCO_USERNAME, ALFRESCO_PASSWORD
 * Optional: DB_SSL=true, DB_SSL_REJECT_UNAUTHORIZED=false
 */

"use strict";

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const axios = require("axios");
const FormData = require("form-data");

// ---------------------------------------------------------------------------
// Env validation
// ---------------------------------------------------------------------------

const REQUIRED_ENV = [
  "DB_HOST",
  "DB_NAME",
  "DB_USER",
  "ALFRESCO_URL",
  "ALFRESCO_ID",
  "ALFRESCO_USERNAME",
  "ALFRESCO_PASSWORD",
];

function checkEnv() {
  const missing = REQUIRED_ENV.filter((k) => process.env[k] == null || process.env[k] === "");
  if (missing.length > 0) {
    console.error(`Missing required environment variable(s): ${missing.join(", ")}`);
    console.error("These are the same DB_*/ALFRESCO_* variables the dms-api app's own .env uses.");
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// DB pool (plain pg, no Sequelize/ORM, no app models)
// ---------------------------------------------------------------------------

function buildPool() {
  const ssl =
    process.env.DB_SSL === "true"
      ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false" }
      : undefined;
  return new Pool({
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432", 10),
    database: process.env.DB_NAME || "dms",
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "",
    ...(ssl ? { ssl } : {}),
    max: 10,
  });
}

// ---------------------------------------------------------------------------
// Alfresco (reimplemented inline - mirrors common/alfrescoService.js)
// ---------------------------------------------------------------------------

function alfrescoAuthHeader() {
  const user = process.env.ALFRESCO_USERNAME || "admin";
  const pass = process.env.ALFRESCO_PASSWORD || "admin";
  return Buffer.from(`${user}:${pass}`).toString("base64");
}

async function alfrescoUpload(filePath, { title, description, mimetype }) {
  const alfrescoUrl = process.env.ALFRESCO_URL;
  const parentId = process.env.ALFRESCO_ID;
  const fileName = path.basename(filePath);
  const form = new FormData();
  form.append("filedata", fs.createReadStream(filePath), {
    filename: fileName,
    contentType: mimetype || "application/octet-stream",
  });
  form.append("cm:title", title || fileName);
  if (description) form.append("cm:description", description);
  try {
    const response = await axios.post(`${alfrescoUrl}/${parentId}/children`, form, {
      auth: { username: process.env.ALFRESCO_USERNAME, password: process.env.ALFRESCO_PASSWORD },
      headers: form.getHeaders(),
      maxBodyLength: Infinity,
    });
    return response.data.entry; // { id, ... }
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

async function alfrescoDelete(nodeId) {
  const alfrescoUrl = process.env.ALFRESCO_URL;
  await axios.delete(`${alfrescoUrl}/${nodeId}`, {
    headers: { Authorization: `Basic ${alfrescoAuthHeader()}` },
  });
}

// ---------------------------------------------------------------------------
// Media type inference (mirrors common/fileMediaType.js's inferMediaType)
// ---------------------------------------------------------------------------

const EXT_MIME = {
  pdf: "application/pdf", csv: "text/csv", txt: "text/plain",
  doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp",
  bmp: "image/bmp", svg: "image/svg+xml", mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime",
  mp3: "audio/mpeg", wav: "audio/wav",
};

function extOf(filename) {
  return String(filename || "").split(".").pop()?.toLowerCase() || "";
}

function guessMimetype(filename) {
  return EXT_MIME[extOf(filename)] || "";
}

function inferMediaType(filename) {
  const ext = extOf(filename);
  const imageExt = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico", "heic"];
  const videoExt = ["mp4", "webm", "mov", "avi", "mkv", "m4v", "wmv"];
  const audioExt = ["mp3", "wav", "ogg", "m4a", "flac", "aac"];
  const docExt = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "rtf", "odt", "ods"];
  if (imageExt.includes(ext)) return "image";
  if (videoExt.includes(ext)) return "video";
  if (audioExt.includes(ext)) return "audio";
  if (docExt.includes(ext)) return "document";
  return "other";
}

// ---------------------------------------------------------------------------
// CSV parser (handles quoted fields, embedded commas, "" escapes)
// ---------------------------------------------------------------------------

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const pushField = () => { row.push(field); field = ""; };
  const pushRow = () => { rows.push(row); row = []; };
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ",") { pushField(); i++; continue; }
    if (c === "\r") { i++; continue; }
    if (c === "\n") { pushField(); pushRow(); i++; continue; }
    field += c; i++;
  }
  if (field.length > 0 || row.length > 0) { pushField(); pushRow(); }
  const filtered = rows.filter((r) => !(r.length === 1 && r[0] === ""));
  if (filtered.length === 0) return [];
  const header = filtered[0].map((h) => h.trim());
  return filtered.slice(1).map((r) => {
    const obj = {};
    header.forEach((h, idx) => { obj[h] = (r[idx] || "").trim(); });
    return obj;
  });
}

function splitMulti(value) {
  if (!value) return [];
  return String(value).split("|").map((s) => s.trim()).filter((s) => s !== "");
}

function truthy(v) {
  return v === true || v === 1 || v === "1" || String(v).toLowerCase() === "true";
}

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { concurrency: 3, state: "./standalone_import_state.json", out: "./standalone_import_results.csv" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case "--title": args.title = next(); break;
      case "--description": args.description = next(); break;
      case "--category": args.category = next(); break;
      case "--category-id": args.categoryId = next(); break;
      case "--distribution": args.distribution = next(); break;
      case "--tags": args.tags = next(); break;
      case "--asset-type": args.assetType = next(); break;
      case "--file-asset-types": args.fileAssetTypes = next(); break;
      case "--cover-image": args.coverImage = next(); break;
      case "--is-private": args.isPrivate = true; break;
      case "--folder-id": args.folderId = next(); break;
      case "--files": args.files = next(); break;
      case "--created-by": args.createdBy = next(); break;
      case "--manifest": args.manifest = next(); break;
      case "--concurrency": args.concurrency = parseInt(next(), 10); break;
      case "--state": args.state = next(); break;
      case "--out": args.out = next(); break;
      case "--force": args.force = true; break;
      case "--dry-run": args.dryRun = true; break;
      case "--help": case "-h": args.help = true; break;
      default:
        console.error(`Unknown argument: ${a}`);
        process.exit(1);
    }
  }
  return args;
}

function printHelpAndExit() {
  console.log(fs.readFileSync(__filename, "utf8").split("*/")[0]);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Category-name -> category_id lookup (the "one more table")
// ---------------------------------------------------------------------------

const categoryCache = new Map();

async function resolveCategoryId(pool, row) {
  if (row.category_id) return parseInt(row.category_id, 10);
  const name = (row.category || "").trim();
  if (!name) return null;
  const cacheKey = name.toLowerCase();
  if (categoryCache.has(cacheKey)) return categoryCache.get(cacheKey);

  const { rows } = await pool.query(
    "SELECT category_id, name FROM dms_categories WHERE LOWER(name) = LOWER($1)",
    [name]
  );
  if (rows.length === 0) {
    throw new Error(`No category found named "${name}" in dms_categories.`);
  }
  if (rows.length > 1) {
    const ids = rows.map((r) => r.category_id).join(", ");
    throw new Error(
      `Category name "${name}" matches ${rows.length} rows in dms_categories (ids: ${ids}). ` +
        `Use the "category_id" column/flag to disambiguate.`
    );
  }
  const id = rows[0].category_id;
  categoryCache.set(cacheKey, id);
  return id;
}

// ---------------------------------------------------------------------------
// Import one row: document + its files, in a single DB transaction
// ---------------------------------------------------------------------------

async function importRow(pool, row) {
  const files = splitMulti(row.files);
  if (files.length === 0) throw new Error("No files listed for this row.");
  const missing = files.filter((f) => !fs.existsSync(f));
  if (missing.length > 0) throw new Error(`File(s) not found: ${missing.join(", ")}`);

  if (!row.title) throw new Error("Missing required field: title");
  const createdBy = row.created_by || row.createdBy;
  if (!createdBy) throw new Error("Missing required field: created_by (no --created-by default and no per-row value).");

  const categoryId = await resolveCategoryId(pool, row);

  const perFileAssetTypes = splitMulti(row.file_asset_types || row.fileAssetTypes);
  const defaultAssetType = (row.asset_type || row.assetType || "").trim() || null;

  const client = await pool.connect();
  const uploadedNodeIds = [];
  try {
    await client.query("BEGIN");

    const docInsert = await client.query(
      `INSERT INTO dms_documents (title, description, tags, category_id, created_by, cover_image, distribution, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING document_id`,
      [
        row.title,
        row.description || null,
        row.tags || null,
        categoryId,
        createdBy,
        row.cover_image || row.coverImage || null,
        row.distribution || null,
      ]
    );
    const documentId = docInsert.rows[0].document_id;

    for (let i = 0; i < files.length; i++) {
      const filePath = files[i];
      const fileName = path.basename(filePath);
      const entry = await alfrescoUpload(filePath, {
        title: row.title,
        description: row.description,
        mimetype: guessMimetype(fileName),
      });
      uploadedNodeIds.push(entry.id);

      let assetType = defaultAssetType;
      if (perFileAssetTypes[i] != null && perFileAssetTypes[i].trim() !== "") {
        assetType = perFileAssetTypes[i].trim();
      }

      await client.query(
        `INSERT INTO dms_document_files (document_id, file_name, file_type, media_type, asset_type, file_size, file_id, folder_id, is_private, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
        [
          documentId,
          fileName,
          extOf(fileName),
          inferMediaType(fileName),
          assetType,
          fs.statSync(filePath).size,
          entry.id,
          row.folder_id || row.folderId || null,
          truthy(row.is_private != null ? row.is_private : row.isPrivate),
        ]
      );
    }

    await client.query("COMMIT");
    return { documentId, fileCount: files.length };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    for (const nodeId of uploadedNodeIds) {
      try { await alfrescoDelete(nodeId); } catch (_) {}
    }
    throw err;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// State (resume) + concurrency-limited runner
// ---------------------------------------------------------------------------

function loadState(p) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch (_) { return {}; }
}
function saveState(p, state) {
  fs.writeFileSync(p, JSON.stringify(state, null, 2));
}
function rowKey(row, index) {
  return `row:${index}:${row.title}`;
}

async function runWithConcurrency(items, limit, worker) {
  let index = 0;
  let active = 0;
  return new Promise((resolve, reject) => {
    function next() {
      if (index >= items.length && active === 0) return resolve();
      while (active < limit && index < items.length) {
        const i = index++;
        active++;
        Promise.resolve(worker(items[i], i))
          .then(() => { active--; next(); })
          .catch(reject);
      }
    }
    next();
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || (!args.manifest && !args.title)) printHelpAndExit();

  checkEnv();
  const pool = buildPool();

  try {
    if (args.manifest) {
      if (!fs.existsSync(args.manifest)) {
        console.error(`Manifest not found: ${args.manifest}`);
        process.exitCode = 1;
        return;
      }
      const rows = parseCsv(fs.readFileSync(args.manifest, "utf8"));
      if (rows.length === 0) {
        console.error("Manifest has no data rows.");
        process.exitCode = 1;
        return;
      }

      const state = loadState(args.state);
      const results = [];
      let skipped = 0;

      const toProcess = rows
        .map((row, i) => ({ row: { ...row, created_by: row.created_by || args.createdBy }, i, key: rowKey(row, i) }))
        .filter(({ key }) => {
          if (!args.force && state[key] && state[key].status === "success") { skipped++; return false; }
          return true;
        });

      console.log(`Manifest rows: ${rows.length}. Already done (skipped): ${skipped}. To process: ${toProcess.length}.` + (args.dryRun ? " [dry run]" : ""));

      await runWithConcurrency(toProcess, Math.max(1, args.concurrency), async ({ row, i, key }) => {
        if (args.dryRun) {
          console.log(`[row ${i}] DRY RUN would import "${row.title}" with files: ${row.files}`);
          return;
        }
        try {
          const { documentId, fileCount } = await importRow(pool, row);
          state[key] = { status: "success", document_id: documentId };
          results.push({ key, title: row.title, status: "success", document_id: documentId, files: fileCount });
          console.log(`[row ${i}] OK - "${row.title}" -> document_id ${documentId} (${fileCount} file(s))`);
        } catch (err) {
          state[key] = { status: "failed", error: err.message };
          results.push({ key, title: row.title, status: "failed", error: err.message });
          console.error(`[row ${i}] FAILED - "${row.title}" - ${err.message}`);
        }
        saveState(args.state, state);
      });

      if (!args.dryRun) {
        const header = "key,title,status,document_id,error\n";
        const lines = results.map((r) =>
          [r.key, r.title, r.status, r.document_id || "", (r.error || "").replace(/[\r\n,]/g, " ")]
            .map((v) => `"${String(v).replace(/"/g, '""')}"`)
            .join(",")
        );
        fs.writeFileSync(args.out, header + lines.join("\n") + "\n");
        console.log(`\nResults written to ${args.out}`);
      }
      const succeeded = results.filter((r) => r.status === "success").length;
      const failed = results.filter((r) => r.status === "failed").length;
      console.log(`\nDone. success=${succeeded} failed=${failed} skipped=${skipped}`);
      if (failed > 0) process.exitCode = 1;
    } else {
      const row = {
        title: args.title,
        description: args.description,
        category: args.category,
        category_id: args.categoryId,
        distribution: args.distribution,
        tags: args.tags,
        asset_type: args.assetType,
        file_asset_types: args.fileAssetTypes,
        cover_image: args.coverImage,
        is_private: args.isPrivate,
        folder_id: args.folderId,
        files: args.files,
        created_by: args.createdBy,
      };
      if (args.dryRun) {
        console.log(`DRY RUN would import "${row.title}" with files: ${row.files}`);
        return;
      }
      const { documentId, fileCount } = await importRow(pool, row);
      console.log(`OK - document_id ${documentId} (${fileCount} file(s))`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
