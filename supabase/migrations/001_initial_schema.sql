-- Enable UUID extension (if needed for future features)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Documents table
CREATE TABLE IF NOT EXISTS docs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Document contents table
CREATE TABLE IF NOT EXISTS doc_contents (
  id TEXT PRIMARY KEY,
  doc_id TEXT NOT NULL UNIQUE REFERENCES docs(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Document chunks table
CREATE TABLE IF NOT EXISTS doc_chunks (
  chunk_id TEXT PRIMARY KEY,
  doc_id TEXT NOT NULL REFERENCES docs(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  start_index INTEGER,
  end_index INTEGER,
  token_count INTEGER,
  prev_chunk_id TEXT,
  next_chunk_id TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_doc_contents_doc_id ON doc_contents(doc_id);
CREATE INDEX IF NOT EXISTS idx_docs_updated_at ON docs(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_doc_chunks_doc_id ON doc_chunks(doc_id);
CREATE INDEX IF NOT EXISTS idx_doc_chunks_prev_chunk ON doc_chunks(prev_chunk_id);
CREATE INDEX IF NOT EXISTS idx_doc_chunks_next_chunk ON doc_chunks(next_chunk_id);

-- Trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_docs_updated_at BEFORE UPDATE ON docs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_doc_contents_updated_at BEFORE UPDATE ON doc_contents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
