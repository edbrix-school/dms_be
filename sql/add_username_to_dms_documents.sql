-- PostgreSQL: optional login / display username on document master (run once per env).
ALTER TABLE dms_documents
  ADD COLUMN IF NOT EXISTS username VARCHAR(255);
