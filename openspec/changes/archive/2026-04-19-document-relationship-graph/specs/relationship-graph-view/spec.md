## ADDED Requirements

### Requirement: Document relationship graph visualization
The system SHALL provide a graph visualization view that renders documents as nodes and relationships as directed edges using graphology and sigma.

#### Scenario: Rendering the graph
- **WHEN** the user navigates to the relationship graph view
- **THEN** the system SHALL fetch all documents and their relationships and render an interactive force-directed graph where each document is a node and each relationship is a directed edge labeled with its type

#### Scenario: Empty corpus
- **WHEN** no documents or relationships exist
- **THEN** the system SHALL display an empty-state message prompting the user to add documents or relationships

### Requirement: Node interaction
The system SHALL allow users to click on a document node to view document metadata and to highlight all connected edges.

#### Scenario: Node selection
- **WHEN** a user clicks on a document node in the graph
- **THEN** the system SHALL highlight all edges connected to that node and display a sidebar or tooltip with the document `name`, `fileType`, and `size`

#### Scenario: Node deselection
- **WHEN** a user clicks on the graph background or presses Escape
- **THEN** the system SHALL clear the selection and remove highlights

### Requirement: Edge interaction
The system SHALL allow users to click on an edge to view relationship details (type, weight, metadata).

#### Scenario: Edge selection
- **WHEN** a user clicks on an edge
- **THEN** the system SHALL display the relationship type, weight, and metadata in a tooltip or side panel

### Requirement: Graph filtering
The system SHALL provide controls to filter the graph by relationship type and by document search term.

#### Scenario: Filter by type
- **WHEN** a user selects one or more relationship types from a filter control
- **THEN** the system SHALL show only edges matching those types and hide nodes with no visible edges

#### Scenario: Search by document name
- **WHEN** a user types a search term into the graph filter
- **THEN** the system SHALL highlight matching nodes and dim non-matching nodes

### Requirement: Add relationship from graph
The system SHALL allow users to create a new relationship between two documents by selecting a source node, a target node, and specifying a type from within the graph view.

#### Scenario: Creating a relationship
- **WHEN** a user initiates "add relationship" mode, selects a source node, selects a target node, and chooses a relationship type
- **THEN** the system SHALL create the relationship via the API and update the graph accordingly

### Requirement: Delete relationship from graph
The system SHALL allow users to delete a relationship by selecting an edge and confirming deletion.

#### Scenario: Deleting a relationship from the graph
- **WHEN** a user selects an edge and clicks delete
- **THEN** the system SHALL remove the relationship via the API and update the graph accordingly

### Requirement: Navigation from graph to document
The system SHALL allow users to navigate from a selected document node to the full document view.

#### Scenario: Opening a document from the graph
- **WHEN** a user double-clicks a document node or selects "Open Document" from a context menu
- **THEN** the system SHALL navigate to the document detail/preview view for that document

### Requirement: SWR hooks for relationships
The system SHALL provide SWR hooks in `src/lib/hooks/use-docs.ts` for fetching and mutating relationship data: `useRelationships(filters)`, `useCreateRelationship()`, `useDeleteRelationship()`, `useUpdateRelationship()`.

#### Scenario: Fetching relationships
- **WHEN** a component calls `useRelationships({ docId: "abc" })` 
- **THEN** the hook SHALL fetch `GET /api/relationships?docId=abc` and return the data with SWR caching

#### Scenario: Optimistic creation
- **WHEN** `useCreateRelationship()` is called with valid input
- **THEN** the hook SHALL POST to `/api/relationships`, optimistically update the SWR cache, and revalidate