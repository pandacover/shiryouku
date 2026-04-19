## Context

Shiryouku is a research assistant with hybrid keyword and semantic search across a document corpus. Documents are currently isolated — stored as rows in a `docs` table with `doc_contents` and `doc_chunks` child tables. The chunk constellation view (graphology + sigma) visualizes chunks *within* a single document but cannot show inter-document relationships. There is no data model or API for expressing how one document relates to another (e.g., cites, references, supersedes, relates-to).

Current stack: sql.js (SQLite) for persistence, Hono for API routes, Zod for validation, SWR for client state, graphology + sigma for graph rendering.

## Goals / Non-Goals

**Goals:**
- Model typed, directed, weighted relationships between documents
- Provide full CRUD API for relationship management
- Render an interactive document-level relationship graph in the dashboard
- Enable relationship-aware search expansion (optional boost from connected docs)

**Non-Goals:**
- Automatic NLP-based relationship extraction from document content (future scope)
- Relationships between individual chunks (document-level only)
- Real-time collaborative editing of the graph
- Import/export of graph data in standard formats (GraphML, GEXF, etc.)

## Decisions

### 1. Edge-centric table design over adjacency list pattern

**Decision**: Use a single `doc_relationships` table with `source_id`, `target_id`, `type`, `weight`, and `metadata` columns, rather than separate join tables per relationship type.

**Rationale**: A single table supports arbitrary relationship types without schema migrations, keeps query logic simple, and aligns with the existing pattern of raw SQL in `db.ts`. The `type` field is a free-text string constrained by application-level validation.

**Alternatives considered**:
- Separate tables per type (e.g., `doc_citations`, `doc_references`) — rejected due to migration overhead for each new type
- JSON adjacency list stored on the `docs` row — rejected for poor query performance and normalization

### 2. Directed edges with bidirectional query helper

**Decision**: Relationships are directed (source → target). A query parameter `direction=both` allows retrieving edges in either direction.

**Rationale**: Directionality is essential for asymmetric relationships (e.g., "cites" vs "is cited by"). The `direction=both` option covers the common symmetric use case without duplicating rows.

### 3. Reuse graphology + sigma for document graph

**Decision**: Extend the existing graphology + sigma visualization pipeline already used in the chunk constellation view, creating a separate graph instance for document-level relationships.

**Rationale**: Avoids adding a new graph library. The team already has graphology expertise. Sigma handles medium-sized graphs well (< 10k nodes), which fits a personal research corpus.

### 4. Lightweight relationship types via validation, not enum column

**Decision**: Store `type` as TEXT with a Zod union of predefined types (`cites`, `references`, `relates-to`, `supersedes`, `derived-from`) plus a free-form option. Validate at the API layer, not the database.

**Rationale**: Avoids the need for migrations when adding new types. The predefined set provides autocomplete and UI affordances while allowing extensibility.

### 5. SWR hooks in existing hooks file

**Decision**: Add relationship SWR hooks to the existing `use-docs.ts` file rather than a separate file.

**Rationale**: Keeps all document-related data fetching co-located. The file already handles docs, search, and constellation.

## Risks / Trade-offs

- **[Scalability on large corpora]** Graphology + sigma may lag beyond ~10k nodes. → Mitigation: Implement graph filtering/search and lazy neighbor loading. For personal research corpora this is unlikely to be an issue.

- **[Data integrity — dangling references]** Deleting a document leaves orphaned relationship edges. → Mitigation: Add `ON DELETE CASCADE` foreign keys on `source_id` and `target_id` referencing `docs(id)`.

- **[Inconsistent relationship types]** Free-text `type` could lead to near-duplicate types (e.g., "cite" vs "cites"). → Mitigation: Zod validation provides a predefined set; free-form types require explicit opt-in.

- **[UI complexity]** Adding a new view increases dashboard surface area. → Mitigation: Integrate as a tab within the existing documents view rather than a separate top-level view.

## Open Questions

- Should relationship discovery (auto-suggest) run on ingest, on-demand, or both? Leaning toward on-demand via a "Suggest Relationships" action in the UI.
- Should the graph view default to showing all documents or only the currently selected document's neighborhood?