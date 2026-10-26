## ADDED Requirements

### Requirement: Private complete corpus preparation
The system SHALL register and privately store each supplied source, verify its identity, expose processing progress and preserve failure/quality status without automatically approving content.

#### Scenario: Duplicate or interrupted ingestion
- **WHEN** the same source or processing task is submitted again
- **THEN** validated existing artifacts are reused without duplicate records or silent paid retries
- **AND** a conflicting artifact is rejected and leaves existing data intact

### Requirement: Immutable human-reviewed versions
The system SHALL freeze corpus and answer configuration into a version and require explicit owner review of that exact version before publication.

#### Scenario: Content changes after review
- **WHEN** a candidate's chunks, QA, prompt, persona, settings or calculation data change
- **THEN** a new snapshot requires new review and cannot inherit an old approval

### Requirement: Bounded model execution
The system SHALL enforce server-side authorization, finite approved budgets, per-round and per-user limits, expiry, idempotency and stop controls before paid work.

#### Scenario: Cleanup or unknown provider outcome
- **WHEN** detailed logs expire or a provider response is lost
- **THEN** accounting remains conservative and no previously spent capacity is recreated

### Requirement: Explainable evaluation and costs
The system SHALL expose each executed, failed or skipped step, its versioned inputs' identifiers, usage, reservations, estimates and available reconciliation evidence.

#### Scenario: Missing billing data
- **WHEN** usage or billed amount is unavailable
- **THEN** the UI shows unknown rather than zero and does not claim full cost reconciliation

### Requirement: Review-ready delivery without Flutter
The delivered system SHALL provide documented non-Flutter administration and backend workflows while leaving real content approval and public activation to the owner.

#### Scenario: Agent completes preparation
- **WHEN** all implementation and automated checks finish
- **THEN** the owner receives a review checklist, corpus coverage, remaining failures and protected access
- **AND** no Flutter integration or automatic approval of real documents occurs
