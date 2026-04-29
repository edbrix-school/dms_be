-- PostgreSQL: add optional external document key / POID (run once per env).
ALTER TABLE dms_documents
  ADD COLUMN IF NOT EXISTS doc_key_poid VARCHAR(255);
