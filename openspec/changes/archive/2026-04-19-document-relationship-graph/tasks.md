## 1. Data Model & Database

- [x] 1.1 Add `doc_relationships` table schema to `src/lib/db.ts` with columns: `id TEXT PRIMARY KEY`, `source_id TEXT NOT NULL REFERENCES docs(id) ON DELETE CASCADE`, `target_id TEXT NOT NULL REFERENCES docs(id) ON DELETE CASCADE`, `type TEXT NOT NULL`, `weight REAL NOT NULL DEFAULT 1.0`, `metadata TEXT NOT NULL DEFAULT '{}'`, `created_at INTEGER NOT NULL DEFAULT 0`, `updated_at INTEGER NOT NULL DEFAULT 0`
- [x] 1.2 Add indexes on `source_id` and `target_id` columns for the `doc_relationships` table
- [x] 1.3 Add Zod schemas in `src/api/schemas/relationship.ts`: `createRelationshipSchema`, `updateRelationshipSchema`, `relationshipRowSchema`, and the predefined type union with custom type opt-in

## 2. API Endpoints

- [x] 2.1 Create `src/api/routes/relationships.ts` with Hono router and mount it on the main Hono app in `src/api/index.ts`
- [x] 2.2 Implement `POST /api/relationships` — create a new relationship with validation, self-reference prevention, and duplicate detection (HTTP 409)
- [x] 2.3 Implement `GET /api/relationships` — list relationships with query params: `docId`, `sourceId`, `targetId`, `type`, `direction` (outgoing/incoming/both)
- [x] 2.4 Implement `GET /api/relationships/:id` — get single relationship by ID (404 if not found)
- [x] 2.5 Implement `PATCH /api/relationships/:id` — update `weight` and/or `metadata`; reject mutable `type`/`sourceId`/`targetId` with 400
- [x] 2.6 Implement `DELETE /api/relationships/:id` — delete relationship (404 if not found, 204 on success)

## 3. Client Types & Hooks

- [x] 3.1 Add relationship types to `src/lib/api.ts`: `RelationshipResponse`, `CreateRelationshipInput`, `UpdateRelationshipInput`, `RelationshipListParams`
- [x] 3.2 Add client fetch helpers in `src/lib/api.ts`: `createRelationship`, `updateRelationship`, `deleteRelationship`, `fetchRelationships`
- [x] 3.3 Add SWR hooks in `src/lib/hooks/use-docs.ts`: `useRelationships(filters)`, `useCreateRelationship()`, `useUpdateRelationship()`, `useDeleteRelationship()` with optimistic updates

## 4. Relationship Graph View

- [x] 4.1 Create `src/components/dashboard/views/relationship-graph.tsx` — graphology + sigma component that renders documents as nodes and relationships as directed edges
- [x] 4.2 Implement node interaction: click to select and highlight connected edges, display document metadata (name, fileType, size) in a sidebar/tooltip
- [x] 4.3 Implement edge interaction: click to display relationship type, weight, and metadata
- [x] 4.4 Implement graph filtering: filter by relationship type (multi-select) and search by document name (highlight matches, dim non-matches)
- [x] 4.5 Implement "add relationship" mode: select source node → target node → choose type → create via API
- [x] 4.6 Implement edge deletion from the graph: select edge → confirm deletion → call API → update graph
- [x] 4.7 Implement double-click navigation from graph node to document detail/preview view

## 5. Relationship Discovery

- [x] 5.1 Implement `POST /api/relationships/suggest` endpoint that takes a `docId` and returns suggested relationships with `targetId`, `type`, `weight`, `confidence`, and `reason`
- [x] 5.2 Implement suggestion logic using hybrid search: run document content through `hybridSearch()`, aggregate results by target document, compute `relates-to` type, and derive weight and confidence from search scores
- [x] 5.3 Create UI for suggestion review: display suggestions with confidence scores, accept/reject each individually, accepted suggestions forwarded to `POST /api/relationships`

## 6. Dashboard Integration

- [x] 6.1 Add a "Relationships" view/tab to the dashboard navigation in `src/components/dashboard/sidebar-navigation.tsx`
- [x] 6.2 Update `dashboard-types.ts` to include `"relationships"` in `DashboardView` type
- [x] 6.3 Integrate the relationship graph view into the dashboard shell routing