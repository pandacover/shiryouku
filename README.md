# Shiryouku

**Shiryouku** is a research workspace for turning messy source material into searchable, citeable context.

It ingests uploaded documents and live website pages, splits them into linked chunks, indexes them with both keyword and semantic search, and uses that retrieval layer to ground AI-assisted research conversations.

---

## Product Overview

Shiryouku is designed for a single outcome: **faster, higher-signal research from heterogeneous sources**.

Instead of relying on raw chat prompts, the system builds a retrieval graph over your corpus so answers can be generated from relevant context rather than memory alone.

### Core capabilities

- **Document ingestion** for indexable text sources
- **Website source capture** with canonical URL handling and text extraction
- **Chunk graph construction** with sibling chunk links (`prev` / `next`)
- **Hybrid retrieval** combining BM25 keyword search + vector similarity search
- **RRF ranking** (Reciprocal Rank Fusion) to blend search modes
- **AI research chat** with retrieval as a tool in the reasoning loop
- **Constellation view** for visualizing document–chunk relationships

---

## Technology Stack

### Frontend

- **Next.js 16** + **React 19**
- **React Router 7** (dashboard routing)
- **Tailwind CSS 4** + custom UI primitives
- **SWR** for client-side data fetching and mutation

### Backend & API

- **Hono** for HTTP routes
- **Effect TS** for typed effects, dependency injection, layers, and error modeling
- **Zod** for schema validation at API boundaries

### Search & Retrieval

- **fast-bm25** for lexical relevance
- **ChromaDB** for vector storage and nearest-neighbor retrieval
- **OpenRouter embeddings** pipeline
- **rerank / reciprocal-rank-fusion** for result fusion

### AI Runtime

- **Vercel AI SDK** tool loop agent
- **Ollama model integration** for response generation
- **MCP SDK** support for tool-facing interfaces

### Data Layer

- **Supabase PostgreSQL** (documents, contents, chunks, metadata)
- Chunk persistence with positional/token metadata and adjacency links

---

## Workflow

### 1) Source acquisition

Shiryouku accepts:

- Uploaded files (supported indexable text formats)
- Website URLs (fetched, normalized, cleaned, and stored as source documents)

### 2) Normalization and chunking

Each source is transformed into chunks with:

- Stable chunk IDs
- Character start/end spans
- Token count estimates
- Previous/next chunk references
- Whitespace-normalized chunk text for cleaner indexing and retrieval

### 3) Multi-store indexing

The chunk set is synchronized across stores:

- **Postgres** for durable chunk records
- **BM25 in-memory index** for keyword recall
- **ChromaDB** for semantic vector retrieval

### 4) Hybrid retrieval

At query time, Shiryouku:

1. Runs keyword search over BM25
2. Generates query embeddings
3. Runs semantic similarity search in ChromaDB
4. Fuses both rankings with RRF
5. Annotates context with source metadata and chunk neighborhood

### 5) Research response generation

The chat agent calls retrieval as a tool, receives grounded context, and answers using indexed evidence from the corpus.

---

## Interface Model

The dashboard is organized into four working surfaces:

- **Home** — overview space
- **Documents** — uploaded corpus management and reindexing
- **Sources** — website source ingestion/refresh and content preview
- **Research** — retrieval-grounded conversational research

---

## Architectural Notes

- Service boundaries are implemented with the `Context.Tag` pattern in Effect TS.
- Runtime composition is layer-based, enabling explicit dependency wiring.
- Error domains are modeled with tagged errors for predictable failure handling.
- Ingestion is idempotent per document: old chunk/index state is removed before re-ingest.

---

Shiryouku’s core philosophy is simple: **index first, answer second**.