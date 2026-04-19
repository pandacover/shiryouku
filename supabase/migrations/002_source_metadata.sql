ALTER TABLE docs
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'file',
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS canonical_url TEXT,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS last_fetched_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS fetch_status TEXT,
  ADD COLUMN IF NOT EXISTS fetch_error TEXT;

CREATE INDEX IF NOT EXISTS idx_docs_source_type ON docs(source_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_docs_website_source_url
  ON docs(source_url)
  WHERE source_type = 'website' AND source_url IS NOT NULL;
