#!/usr/bin/env node
/**
 * ERP GLOBAL_ATTACHMENTS -> DMS (Postgres + Alfresco) migrator.
 *
 * For every pending row in <ORA_SCHEMA>.GLOBAL_ATTACHMENTS:
 *   1. Build the physical file path from FILE_NAME (+ ATTACHMENT_BASE_DIR / FILE_PATH_TEMPLATE)
 *   2. Lock the Oracle row (SELECT ... FOR UPDATE NOWAIT)
 *   3. Create dms_documents row, upload to Alfresco, create dms_document_files row (one PG txn)
 *   4. UPDATE GLOBAL_ATTACHMENTS SET FILE_NAME_MAPPED = 'DMS_' || document_id
 *   5. Commit Postgres, then commit Oracle
 * On any failure before step 5 the PG txn is rolled back, the Alfresco node is
 * deleted and the Oracle txn is rolled back, so nothing is half-written.
 *
 * "Pending" = ACTIVE = 'Y', DELETED is N/blank, FILE_NAME not null, and
 * FILE_NAME_MAPPED not already starting with 'DMS_'. Re-running the script is
 * therefore safe: already-migrated rows are skipped automatically.
 *
 *   npm install pg oracledb axios form-data dotenv
 *
 * Required env:
 *   DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD                 (DMS Postgres)
 *   ALFRESCO_URL, ALFRESCO_ID, ALFRESCO_USERNAME, ALFRESCO_PASSWORD (Alfresco)
 *   ORA_USER, ORA_PASSWORD                                          (Oracle)
 *   ATTACHMENT_BASE_DIR   folder where the ERP attachment files physically live
 * Optional env:
 *   ORA_CONNECT_STRING    default 10.100.200.85:1521/ORAVADF
 *   ORA_SCHEMA            default ERP_UAT_NEW
 *   ORA_THICK_MODE=true   use Oracle Instant Client (needed for Oracle DB < 12.1)
 *   ORA_CLIENT_LIB_DIR    Instant Client dir (Windows/macOS thick mode)
 *   FILE_PATH_TEMPLATE    path under ATTACHMENT_BASE_DIR, default "{FILE_NAME}".
 *                         Any column can be used, e.g. "{DOC_ID}/{DOC_KEY_POID}/{FILE_NAME}"
 *   DB_SSL=true, DB_SSL_REJECT_UNAUTHORIZED=false
 *
 * Usage:
 *   node erpAttachmentsToDms.js --dry-run                      # list what would happen
 *   node erpAttachmentsToDms.js --created-by 1                 # migrate everything pending
 *   node erpAttachmentsToDms.js --doc-id 700-004 --doc-key-poid 82
 *   node erpAttachmentsToDms.js --company-poid 1 --limit 500 --concurrency 3
 *
 * Options:
 *   --group-poid N  --company-poid N  --doc-id X  --doc-key-poid N  --seqno N   (filters)
 *   --limit N                 process at most N rows this run
 *   --created-by N            DMS user id for dms_documents.created_by
 *                             (default: GLOBAL_ATTACHMENTS.CREATED_BY of each row)
 *   --category NAME | --category-id N   DMS category for all imported docs
 *   --folder-id N  --is-private  --asset-type X
 *   --concurrency N           parallel rows (default 3)
 *   --out FILE                results CSV (default ./erp_attachment_import_results.csv)
 *   --dry-run                 no uploads, no DB writes
 */

"use strict";

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const oracledb = require("oracledb");
const axios = require("axios");
const FormData = require("form-data");

// ---------------------------------------------------------------------------
// Config / env
// ---------------------------------------------------------------------------

const REQUIRED_ENV = [
  "DB_HOST", "DB_NAME", "DB_USER",
  "ALFRESCO_URL", "ALFRESCO_ID", "ALFRESCO_USERNAME", "ALFRESCO_PASSWORD",
  "ORA_USER", "ORA_PASSWORD",
  "ATTACHMENT_BASE_DIR",
];

const ORA_CONNECT_STRING = process.env.ORA_CONNECT_STRING || "10.100.200.85:1521/ORAVADF";
const ORA_SCHEMA = (process.env.ORA_SCHEMA || "ERP_UAT_NEW").trim().toUpperCase();
const ATT_TABLE = `${ORA_SCHEMA}.GLOBAL_ATTACHMENTS`;

function checkEnv() {
  const missing = REQUIRED_ENV.filter((k) => process.env[k] == null || process.env[k] === "");
  if (missing.length > 0) {
    console.error(`Missing required environment variable(s): ${missing.join(", ")}`);
    process.exit(1);
  }
  // Schema is interpolated into SQL (identifiers can't be bound), so validate it.
  if (!/^[A-Z][A-Z0-9_$#]{0,127}$/.test(ORA_SCHEMA)) {
    console.error(`Invalid ORA_SCHEMA: ${ORA_SCHEMA}`);
    process.exit(1);
  }
  const base = process.env.ATTACHMENT_BASE_DIR;
  if (!fs.existsSync(base) || !fs.statSync(base).isDirectory()) {
    console.error(`ATTACHMENT_BASE_DIR does not exist or is not a directory: ${base}`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// DB pools
// ---------------------------------------------------------------------------

function buildPgPool(size) {
  const ssl =
    process.env.DB_SSL === "true"
      ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false" }
      : undefined;
  return new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "5432", 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || "",
    ...(ssl ? { ssl } : {}),
    max: size,
  });
}

async function buildOraPool(size) {
  if (process.env.ORA_THICK_MODE === "true") {
    oracledb.initOracleClient(
      process.env.ORA_CLIENT_LIB_DIR ? { libDir: process.env.ORA_CLIENT_LIB_DIR } : undefined
    );
  }
  oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
  oracledb.autoCommit = false;
  return oracledb.createPool({
    user: process.env.ORA_USER,
    password: process.env.ORA_PASSWORD,
    connectString: ORA_CONNECT_STRING,
    poolMin: 0,
    poolMax: size,
    poolIncrement: 1,
  });
}

// ---------------------------------------------------------------------------
// Alfresco
// ---------------------------------------------------------------------------

async function alfrescoUpload(filePath, { name, title, description, mimetype }) {
  const form = new FormData();
  form.append("filedata", fs.createReadStream(filePath), {
    filename: name,
    contentType: mimetype || "application/octet-stream",
  });
  form.append("name", name);
  // Many ERP attachments share names like "report.pdf"; without this Alfresco
  // returns 409 for the second one in the same parent folder.
  form.append("autoRename", "true");
  form.append("cm:title", title || name);
  if (description) form.append("cm:description", description);
  try {
    const response = await axios.post(
      `${process.env.ALFRESCO_URL}/${process.env.ALFRESCO_ID}/children`,
      form,
      {
        auth: { username: process.env.ALFRESCO_USERNAME, password: process.env.ALFRESCO_PASSWORD },
        headers: form.getHeaders(),
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      }
    );
    return response.data.entry; // { id, name, ... }
  } catch (error) {
    const message =
      error?.response?.data?.error?.briefSummary ||
      error?.response?.data?.error?.errorKey ||
      error?.response?.data?.message ||
      error?.message ||
      "Alfresco upload failed";
    throw new Error(`Alfresco upload failed: ${message}`);
  }
}

async function alfrescoDelete(nodeId) {
  await axios.delete(`${process.env.ALFRESCO_URL}/${nodeId}`, {
    auth: { username: process.env.ALFRESCO_USERNAME, password: process.env.ALFRESCO_PASSWORD },
  });
}

// ---------------------------------------------------------------------------
// File helpers
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
  const s = String(filename || "");
  return s.includes(".") ? s.split(".").pop().toLowerCase() : "";
}

function guessMimetype(filename) {
  return EXT_MIME[extOf(filename)] || "";
}

function inferMediaType(filename) {
  const ext = extOf(filename);
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico", "heic"].includes(ext)) return "image";
  if (["mp4", "webm", "mov", "avi", "mkv", "m4v", "wmv"].includes(ext)) return "video";
  if (["mp3", "wav", "ogg", "m4a", "flac", "aac"].includes(ext)) return "audio";
  if (["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "rtf", "odt", "ods"].includes(ext)) return "document";
  return "other";
}

/** Build the physical path for an attachment row from FILE_PATH_TEMPLATE. */
function resolveFilePath(att) {
  const base = path.resolve(process.env.ATTACHMENT_BASE_DIR);
  const template = process.env.FILE_PATH_TEMPLATE || "{FILE_NAME}";
  const rel = template.replace(/\{([A-Z_]+)\}/g, (_, key) => {
    if (!(key in att)) throw new Error(`FILE_PATH_TEMPLATE uses unknown column {${key}}`);
    const v = att[key];
    if (v == null || String(v).trim() === "") throw new Error(`Column ${key} is empty; cannot build file path`);
    return String(v).trim();
  });
  const full = path.resolve(base, rel);
  if (full !== base && !full.startsWith(base + path.sep)) {
    throw new Error(`Resolved path escapes ATTACHMENT_BASE_DIR: ${full}`);
  }
  return full;
}

// ---------------------------------------------------------------------------
// DMS category lookup (unchanged from original)
// ---------------------------------------------------------------------------

const categoryCache = new Map();

async function resolveCategoryId(pgPool, args) {
  if (args.categoryId) return parseInt(args.categoryId, 10);
  const name = (args.category || "").trim();
  if (!name) return null;
  const key = name.toLowerCase();
  if (categoryCache.has(key)) return categoryCache.get(key);
  const { rows } = await pgPool.query(
    "SELECT category_id FROM dms_categories WHERE LOWER(name) = LOWER($1)",
    [name]
  );
  if (rows.length === 0) throw new Error(`No category named "${name}" in dms_categories.`);
  if (rows.length > 1) throw new Error(`Category "${name}" is ambiguous; use --category-id.`);
  categoryCache.set(key, rows[0].category_id);
  return rows[0].category_id;
}

// ---------------------------------------------------------------------------
// Oracle: fetch pending attachments
// ---------------------------------------------------------------------------

async function fetchPendingAttachments(oraPool, args) {
  const where = [
    "ACTIVE = 'Y'",
    "NVL(TRIM(DELETED), 'N') = 'N'",
    "FILE_NAME IS NOT NULL",
    "(FILE_NAME_MAPPED IS NULL OR FILE_NAME_MAPPED NOT LIKE 'DMS\\_%' ESCAPE '\\')",
  ];
  const binds = {};
  const filters = [
    ["groupPoid", "GROUP_POID"],
    ["companyPoid", "COMPANY_POID"],
    ["docId", "DOC_ID"],
    ["docKeyPoid", "DOC_KEY_POID"],
    ["seqno", "SEQNO"],
  ];
  for (const [arg, col] of filters) {
    if (args[arg] != null) {
      where.push(`${col} = :${arg}`);
      binds[arg] = args[arg];
    }
  }

  let sql = `
    SELECT ROWIDTOCHAR(ROWID) AS RID,
           GROUP_POID, COMPANY_POID, DOC_ID, DOC_KEY_POID, SEQNO,
           FILE_NAME, FILE_REMARKS, CHECKLIST_NAME, CREATED_BY, FILE_NAME_MAPPED
      FROM ${ATT_TABLE}
     WHERE ${where.join("\n       AND ")}
     ORDER BY DOC_ID, DOC_KEY_POID, SEQNO`;
  if (args.limit) {
    sql = `SELECT * FROM (${sql}) WHERE ROWNUM <= :lim`;
    binds.lim = args.limit;
  }

  const conn = await oraPool.getConnection();
  try {
    const result = await conn.execute(sql, binds);
    return result.rows;
  } finally {
    await conn.close();
  }
}

// ---------------------------------------------------------------------------
// Process one attachment row
// ---------------------------------------------------------------------------

async function processAttachment(pgPool, oraPool, att, args) {
  const result = {
    rid: att.RID, doc_id: att.DOC_ID, doc_key_poid: att.DOC_KEY_POID, seqno: att.SEQNO,
    file_name: att.FILE_NAME, old_mapped: att.FILE_NAME_MAPPED || "",
    file_path: "", status: "", document_id: "", new_mapped: "", error: "",
  };

  // 1. Resolve and check the physical file before touching any DB.
  let filePath;
  try {
    filePath = resolveFilePath(att);
    result.file_path = filePath;
  } catch (e) {
    return { ...result, status: "failed", error: e.message };
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return { ...result, status: "file_missing", error: `Not found: ${filePath}` };
  }
  if (args.dryRun) return { ...result, status: "dry_run_ok" };

  const createdBy = args.createdBy != null ? args.createdBy : att.CREATED_BY;
  if (createdBy == null) return { ...result, status: "failed", error: "No created_by (row CREATED_BY empty and no --created-by)" };

  const displayName = String(att.FILE_NAME).trim();
  const ora = await oraPool.getConnection();
  let pg = null;
  let nodeId = null;
  let pgCommitted = false;

  try {
    // 2. Lock the Oracle row and re-check it wasn't migrated meanwhile.
    let lock;
    try {
      lock = await ora.execute(
        `SELECT FILE_NAME_MAPPED FROM ${ATT_TABLE}
          WHERE ROWID = CHARTOROWID(:rid) AND SEQNO = :seqno
          FOR UPDATE NOWAIT`,
        { rid: att.RID, seqno: att.SEQNO }
      );
    } catch (e) {
      if (e.errorNum === 54) return { ...result, status: "skipped_locked", error: "Row locked by another session" };
      throw e;
    }
    if (lock.rows.length !== 1) throw new Error("Row no longer exists (ROWID/SEQNO mismatch)");
    const current = lock.rows[0].FILE_NAME_MAPPED;
    if (current && String(current).startsWith("DMS_")) {
      return { ...result, status: "skipped_already_mapped", new_mapped: current };
    }

    // 3. DMS document + Alfresco upload + file row, in one PG transaction.
    const categoryId = await resolveCategoryId(pgPool, args);
    pg = await pgPool.connect();
    await pg.query("BEGIN");

    const docInsert = await pg.query(
      `INSERT INTO dms_documents (title, description, tags, category_id, created_by, cover_image, distribution, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING document_id`,
      [displayName, att.FILE_REMARKS || null, null, categoryId, createdBy, null, null]
    );
    const documentId = docInsert.rows[0].document_id;
    result.document_id = documentId;

    const entry = await alfrescoUpload(filePath, {
      name: displayName,
      title: displayName,
      description: att.FILE_REMARKS,
      mimetype: guessMimetype(displayName) || guessMimetype(filePath),
    });
    nodeId = entry.id;

    await pg.query(
      `INSERT INTO dms_document_files (document_id, file_name, file_type, media_type, asset_type, file_size, file_id, folder_id, is_private, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [
        documentId,
        displayName,
        extOf(displayName) || extOf(filePath),
        inferMediaType(displayName),
        args.assetType || null,
        fs.statSync(filePath).size,
        nodeId,
        args.folderId || null,
        !!args.isPrivate,
      ]
    );

    // 4. Write DMS_{document_id} back to Oracle (not committed yet).
    const mapped = `DMS_${documentId}`;
    const upd = await ora.execute(
      `UPDATE ${ATT_TABLE} SET FILE_NAME_MAPPED = :mapped WHERE ROWID = CHARTOROWID(:rid)`,
      { mapped, rid: att.RID }
    );
    if (upd.rowsAffected !== 1) throw new Error(`Oracle UPDATE affected ${upd.rowsAffected} rows, expected 1`);

    // 5. Commit PG first, then Oracle.
    await pg.query("COMMIT");
    pgCommitted = true;
    try {
      await ora.commit();
    } catch (e) {
      // PG + Alfresco are committed but Oracle isn't: must be fixed by hand.
      return {
        ...result, status: "oracle_commit_failed", new_mapped: mapped,
        error: `DMS document ${documentId} created but Oracle commit failed: ${e.message}. ` +
               `Run: UPDATE ${ATT_TABLE} SET FILE_NAME_MAPPED='${mapped}' WHERE ROWID=CHARTOROWID('${att.RID}')`,
      };
    }
    return { ...result, status: "success", new_mapped: mapped };
  } catch (err) {
    if (!pgCommitted) {
      if (pg) await pg.query("ROLLBACK").catch(() => {});
      if (nodeId) await alfrescoDelete(nodeId).catch(() => {});
      result.document_id = "";
    }
    await ora.rollback().catch(() => {});
    return { ...result, status: "failed", error: err.message };
  } finally {
    if (pg) pg.release();
    await ora.close().catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// CLI, concurrency, main
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { concurrency: 3, out: "./erp_attachment_import_results.csv" };
  const num = (v, name) => {
    const n = Number(v);
    if (!Number.isFinite(n)) { console.error(`${name} must be a number`); process.exit(1); }
    return n;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case "--group-poid": args.groupPoid = num(next(), a); break;
      case "--company-poid": args.companyPoid = num(next(), a); break;
      case "--doc-id": args.docId = next(); break;
      case "--doc-key-poid": args.docKeyPoid = num(next(), a); break;
      case "--seqno": args.seqno = num(next(), a); break;
      case "--limit": args.limit = num(next(), a); break;
      case "--created-by": args.createdBy = num(next(), a); break;
      case "--category": args.category = next(); break;
      case "--category-id": args.categoryId = next(); break;
      case "--folder-id": args.folderId = next(); break;
      case "--is-private": args.isPrivate = true; break;
      case "--asset-type": args.assetType = next(); break;
      case "--concurrency": args.concurrency = Math.max(1, num(next(), a)); break;
      case "--out": args.out = next(); break;
      case "--dry-run": args.dryRun = true; break;
      case "--help": case "-h":
        console.log(fs.readFileSync(__filename, "utf8").split("*/")[0]);
        process.exit(0);
      default:
        console.error(`Unknown argument: ${a}`);
        process.exit(1);
    }
  }
  return args;
}

async function runWithConcurrency(items, limit, worker) {
  let index = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const i = index++;
      await worker(items[i], i);
    }
  });
  await Promise.all(runners);
}

function writeResultsCsv(file, results) {
  const cols = ["rid", "doc_id", "doc_key_poid", "seqno", "file_name", "file_path", "status",
                "document_id", "old_mapped", "new_mapped", "error"];
  const esc = (v) => `"${String(v == null ? "" : v).replace(/[\r\n]+/g, " ").replace(/"/g, '""')}"`;
  const lines = results.map((r) => cols.map((c) => esc(r[c])).join(","));
  fs.writeFileSync(file, cols.join(",") + "\n" + lines.join("\n") + "\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  checkEnv();

  const oraPool = await buildOraPool(args.concurrency + 1);
  const pgPool = buildPgPool(args.concurrency + 1);

  try {
    const rows = await fetchPendingAttachments(oraPool, args);
    console.log(`Pending attachments in ${ATT_TABLE}: ${rows.length}` + (args.dryRun ? " [dry run]" : ""));
    if (rows.length === 0) return;

    const results = [];
    await runWithConcurrency(rows, args.concurrency, async (att, i) => {
      const r = await processAttachment(pgPool, oraPool, att, args);
      results.push(r);
      const tag = `[${i + 1}/${rows.length}] ${att.DOC_ID}/${att.DOC_KEY_POID}/#${att.SEQNO} "${att.FILE_NAME}"`;
      if (r.status === "success") console.log(`${tag} -> ${r.new_mapped}`);
      else if (r.status === "dry_run_ok") console.log(`${tag} -> would upload ${r.file_path}`);
      else console.error(`${tag} -> ${r.status.toUpperCase()}${r.error ? ": " + r.error : ""}`);
    });

    writeResultsCsv(args.out, results);
    const count = (s) => results.filter((r) => r.status === s).length;
    console.log(`\nResults written to ${args.out}`);
    console.log(
      `success=${count("success")} failed=${count("failed")} file_missing=${count("file_missing")} ` +
      `skipped=${count("skipped_locked") + count("skipped_already_mapped")} ` +
      `oracle_commit_failed=${count("oracle_commit_failed")}` +
      (args.dryRun ? ` dry_run_ok=${count("dry_run_ok")}` : "")
    );
    if (results.some((r) => ["failed", "file_missing", "oracle_commit_failed"].includes(r.status))) {
      process.exitCode = 1;
    }
  } finally {
    await pgPool.end().catch(() => {});
    await oraPool.close(10).catch(() => {});
  }
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
