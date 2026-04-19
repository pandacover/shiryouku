## ADDED Requirements

### Requirement: Relationship data model
The system SHALL store document relationships as directed edges in a `doc_relationships` table with columns: `id TEXT PRIMARY KEY`, `source_id TEXT NOT NULL REFERENCES docs(id) ON DELETE CASCADE`, `target_id TEXT NOT NULL REFERENCES docs(id) ON DELETE CASCADE`, `type TEXT NOT NULL`, `weight REAL NOT NULL DEFAULT 1.0`, `metadata TEXT NOT NULL DEFAULT '{}'`, `created_at INTEGER NOT NULL DEFAULT 0`, `updated_at INTEGER NOT NULL DEFAULT 0`.

#### Scenario: Table creation on startup
- **WHEN** the application initializes the database
- **THEN** the `doc_relationships` table SHALL be created if it does not exist, including indexes on `source_id` and `target_id`

#### Scenario: Cascading delete
- **WHEN** a document is deleted
- **THEN** all relationships where that document is either `source_id` or `target_id` SHALL be automatically deleted

### Requirement: Relationship type validation
The system SHALL accept the following predefined relationship types: `cites`, `references`, `relates-to`, `supersedes`, `derived-from`. The `type` field SHALL also accept any free-form string when the client explicitly opts in via a flag.

#### Scenario: Valid predefined type
- **WHEN** a relationship is created with `type` set to one of the predefined values
- **THEN** the system SHALL accept it without error

#### Scenario: Free-form type
- **WHEN** a relationship is created with a `type` not in the predefined list and the request includes `allowCustomType=true`
- **THEN** the system SHALL accept the custom type string

#### Scenario: Invalid type rejection
- **WHEN** a relationship is created with a `type` not in the predefined list and `allowCustomType` is not set
- **THEN** the system SHALL reject the request with a validation error

### Requirement: Create relationship
The system SHALL expose a `POST /api/relationships` endpoint that creates a new relationship between two documents. The request body MUST include `sourceId`, `targetId`, and `type`, and MAY include `weight` and `metadata`.

#### Scenario: Successful creation
- **WHEN** a valid request is sent to create a relationship
- **THEN** the system SHALL persist the relationship, assign a nanoid, and return the full relationship object with HTTP 201

#### Scenario: Self-reference prevention
- **WHEN** a request attempts to create a relationship where `sourceId` equals `targetId`
- **THEN** the system SHALL reject the request with HTTP 400

#### Scenario: Duplicate prevention
- **WHEN** a request attempts to create a relationship with the same `sourceId`, `targetId`, and `type` as an existing relationship
- **THEN** the system SHALL reject the request with HTTP 409

### Requirement: List relationships
The system SHALL expose a `GET /api/relationships` endpoint that returns relationships filtered by optional query parameters: `docId` (returns all edges involving that document), `sourceId` (outgoing edges), `targetId` (incoming edges), `type`, and `direction` (`outgoing`, `incoming`, `both`; default `both` when `docId` is provided).

#### Scenario: Filter by document
- **WHEN** `GET /api/relationships?docId=abc123` is requested
- **THEN** the system SHALL return all relationships where the document is either source or target

#### Scenario: Filter by direction
- **WHEN** `GET /api/relationships?docId=abc123&direction=outgoing` is requested
- **THEN** the system SHALL return only relationships where the document is the source

#### Scenario: Filter by type
- **WHEN** `GET /api/relationships?type=cites` is requested
- **THEN** the system SHALL return only relationships of type `cites`

### Requirement: Get single relationship
The system SHALL expose a `GET /api/relationships/:id` endpoint that returns a single relationship by ID.

#### Scenario: Existing relationship
- **WHEN** a valid relationship ID is requested
- **THEN** the system SHALL return the relationship object

#### Scenario: Non-existent relationship
- **WHEN** a non-existent relationship ID is requested
- **THEN** the system SHALL return HTTP 404

### Requirement: Update relationship
The system SHALL expose a `PATCH /api/relationships/:id` endpoint that updates `weight` and/or `metadata` on an existing relationship. The `type`, `sourceId`, and `targetId` fields SHALL NOT be mutable.

#### Scenario: Successful update
- **WHEN** a valid request updates `weight` or `metadata`
- **THEN** the system SHALL persist the changes and return the updated relationship

#### Scenario: Immutable fields rejected
- **WHEN** a request attempts to change `type`, `sourceId`, or `targetId`
- **THEN** the system SHALL reject the request with HTTP 400

### Requirement: Delete relationship
The system SHALL expose a `DELETE /api/relationships/:id` endpoint that removes a relationship.

#### Scenario: Successful deletion
- **WHEN** a valid relationship ID is sent for deletion
- **THEN** the system SHALL remove the relationship and return HTTP 204

#### Scenario: Non-existent relationship deletion
- **WHEN** a non-existent relationship ID is sent for deletion
- **THEN** the system SHALL return HTTP 404

### Requirement: Zod validation schemas
The system SHALL define Zod schemas for relationship creation and update in `src/api/schemas/relationship.ts`, including `createRelationshipSchema`, `updateRelationshipSchema`, and `relationshipRowSchema`.

#### Scenario: Schema validation
- **WHEN** any relationship endpoint receives a request
- **THEN** the request body SHALL be validated against the corresponding Zod schema before processing