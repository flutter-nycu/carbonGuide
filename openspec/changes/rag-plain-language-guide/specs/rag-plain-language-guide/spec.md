## ADDED Requirements

### Requirement: Plain-language companion PDF
The documentation SHALL provide a separate Traditional Chinese PDF that explains the existing RAG plan through short sentences, concrete examples and diagrams.

#### Scenario: A nontechnical reader opens the guide
- **WHEN** the reader follows the library analogy
- **THEN** the guide explains ingestion, retrieval, grounded answers, versions, review, cost and access control
- **AND** technical names are secondary to their plain-language meanings

### Requirement: Evidence boundaries remain explicit
The guide SHALL distinguish historical observations, current documented behavior and future proposals without asserting fresh live verification.

#### Scenario: The reader checks readiness
- **WHEN** the guide describes ready data, evaluation results and cloud workers
- **THEN** it distinguishes readiness from human approval and public availability
- **AND** it labels the Cloud Run Jobs design as not deployed

### Requirement: Rendered artifact verification
The new PDF SHALL be reproducible, retain readable Traditional Chinese text and pass page rendering review.

#### Scenario: The artifact is delivered
- **WHEN** the PDF has been built
- **THEN** every page is rendered and visually reviewed
- **AND** page count, bookmarks, font embedding and text bounds are checked
- **AND** the original PDF remains unchanged
