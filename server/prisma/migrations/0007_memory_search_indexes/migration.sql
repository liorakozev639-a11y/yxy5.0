CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Memory_title_trgm_idx"
ON "Memory" USING GIN (lower("title") gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Memory_note_trgm_idx"
ON "Memory" USING GIN (lower("note") gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Memory_statuses_gin_idx"
ON "Memory" USING GIN ("statuses");
