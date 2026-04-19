## Why

Documents in Shiryouku are currently isolated entities — there is no way to express, discover, or visualize how documents relate to each other (e.g., citations, references, thematic overlap, temporal ordering). A relationship graph data structure will connect documents through typed, weighted edges, enabling users to explore inter-document relationships and navigate the corpus as a connected network rather than a flat list.

## What Changes

- Add a `doc_relationships` SQL table storing typed, weighted, directed edges between documents
- Add CRUD API endpoints for creating, reading, deleting, and querying relationships
- Add Zod schemas and client types for relationship data
- Add a new graph-based visualization view that renders the document relationship graph alongside the existing chunk constellation
- Integrate relationship discovery into the research/chat pipeline so the LLM can reference connected documents

## Capabilities

### New Capabilities
- `doc-relationships`: Data model, storage, and API for typed directed edges between documents (source, target, type, weight, metadata)
- `relationship-graph-view`: Frontend visualization of the document relationship network using graphology + sigma
- `relationship-discovery`: Logic to suggest or auto-detect relationships between documents (e.g., via search overlap, shared references)

### Modified Capabilities

_(No existing specs to modify — openspec/specs/ is currently empty)_

## Impact

- **Database**: New `doc_relationships` table in SQLite; migration logic in `src/lib/db.ts`
- **API**: New route file (e.g., `src/api/routes/relationships.ts`) mounted on the Hono app
- **Schemas**: New file `src/api/schemas/relationship.ts`
- **Client**: New types in `src/lib/api.ts`, new SWR hooks in `src/lib/hooks/use-docs.ts` or a new hook file
- **UI**: New graph view component in `src/components/dashboard/views/`, sidebar navigation update
- **Ingest**: Optional — relationship inference could be triggered during document ingestion
- **Search/Retrieval**: `src/lib/retrieval.ts` may use relationships to boost or expand search results