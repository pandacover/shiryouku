## ADDED Requirements

### Requirement: Suggest relationships on demand
The system SHALL provide a `POST /api/relationships/suggest` endpoint that takes a `docId` and returns a ranked list of suggested relationships between the given document and other documents in the corpus.

#### Scenario: Successful suggestion
- **WHEN** `POST /api/relationships/suggest` is called with a valid `docId`
- **THEN** the system SHALL analyze the document's content and search overlap with other documents and return a list of suggested relationships with proposed `targetId`, `type`, `weight`, and `reason`

#### Scenario: No suggestions available
- **WHEN** the document has no meaningful overlap with other documents
- **THEN** the system SHALL return an empty suggestions list with HTTP 200

### Requirement: Suggestion based on search overlap
The system SHALL compute relationship suggestions by running the document's content (or representative chunks) through the existing hybrid search and ranking other documents by result frequency and relevance score.

#### Scenario: Overlap-based suggestion
- **WHEN** document A's content chunks produce search results that include document B's chunks
- **THEN** the system SHALL suggest a `relates-to` relationship between document A and document B, with weight proportional to the number and relevance of matching chunks

### Requirement: Suggestion confidence score
Each suggested relationship SHALL include a `confidence` field (0.0–1.0) indicating how strongly the system believes the relationship is valid.

#### Scenario: Confidence scoring
- **WHEN** suggestions are generated
- **THEN** each suggestion SHALL have a `confidence` value computed from the aggregate search relevance scores, normalized to the 0.0–1.0 range

### Requirement: Manual review before creation
The system SHALL NOT automatically persist suggested relationships. Suggestions MUST be presented to the user for review, and only relationships explicitly confirmed by the user SHALL be created via the standard `POST /api/relationships` endpoint.

#### Scenario: Suggestion review flow
- **WHEN** the user requests relationship suggestions for a document
- **THEN** the system SHALL display the suggestions with their confidence scores and allow the user to accept or reject each one individually
- **THEN** accepted suggestions SHALL be forwarded to `POST /api/relationships` for creation