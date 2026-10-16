-- RAG protocol storage (requires pgvector on Neon)

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS protocol_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  version text NOT NULL DEFAULT '1.0',
  approved_at timestamptz NULL,
  source_uri text NULL,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS protocol_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES protocol_documents(id) ON DELETE CASCADE,
  chunk_index int NOT NULL,
  section_title text NULL,
  content text NOT NULL,
  embedding vector(1024),
  created_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS protocol_chunks_document_id_idx
  ON protocol_chunks (document_id, chunk_index);
