## ADDED Requirements

### Requirement: Explicit operation consequences
The administrator SHALL see whether an action edits a local draft, saves data or creates a new candidate. Citation removal SHALL remain local until save; empty saved citations SHALL be identified as ineligible for snapshots. Chunk correction SHALL explain new identities, embedding readiness and re-binding dependent citations.

#### Scenario: Remove the last citation
- **WHEN** an administrator removes the final citation
- **THEN** no write occurs until save
- **AND** saving explains that at least one valid citation is required before version inclusion

### Requirement: Faithful outcome presentation
History SHALL show the stored final response including refusal verbatim. Missing, failed, uncertain, running and expired details SHALL have distinct explanations and SHALL NOT be replaced by a fabricated fallback answer. Unknown-result recovery SHALL have a read-only path even when the new-request quota is exhausted.

#### Scenario: A refusal is retained
- **WHEN** a saved abstained request is opened
- **THEN** its saved refusal and a separate administrator explanation are shown
- **AND** raw diagnostics are available on demand

#### Scenario: No confirmed answer
- **WHEN** a failed or uncertain request has no stored response
- **THEN** the view states that no confirmed final response is available
- **AND** it does not claim what a future Flutter client displayed

### Requirement: Accessible guidance and documentation
Each main page SHALL provide contextual guidance. Short table actions SHALL remain readable and dialogs SHALL fit desktop and mobile viewports. Technical explanations and a task-oriented button guide SHALL be available as versioned PDFs with reproducible sources.

#### Scenario: Beginner opens a page
- **WHEN** the administrator opens page help
- **THEN** the intended order, action effects and model-cost implications are visible without leaving the task
